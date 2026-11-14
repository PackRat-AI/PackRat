#if os(iOS)
import CoreLocation
import Defaults
import Foundation
import MapboxMaps
import Observation
import Sentry
import UIKit

/// Saves map areas to the device and tracks their downloads.
///
/// Tiles live in Mapbox's default `TileStore`, which every in-app Mapbox map
/// reads from, so an area saved here shows up offline everywhere without the
/// maps knowing about it. Our own record (`OfflineArea`) sits beside it in
/// `Defaults` for what the tile store does not hold.
@Observable
@MainActor
final class OfflineMapStore {
    static let shared = OfflineMapStore()

    static let flagKey = "enableOfflineMaps"
    static var isEnabled: Bool { FeatureFlagStore.shared.isEnabled(flagKey) }

    /// Download progress for one area, 0...1, plus bytes so far.
    struct Progress: Equatable {
        var fraction: Double
        var bytes: Int64
    }

    enum DownloadError: LocalizedError {
        case tooLarge
        case diskFull
        case failed

        var errorDescription: String? {
            switch self {
            case .tooLarge:
                return "This area is too large to save. Make the frame smaller or choose Standard detail."
            case .diskFull:
                return "Your phone is out of space. Free some up and try again."
            case .failed:
                return "The map couldn't be saved. Check your connection and try again."
            }
        }
    }

    private(set) var areas: [OfflineArea] = Defaults[.offlineAreas] {
        didSet { Defaults[.offlineAreas] = areas }
    }
    private(set) var progress: [String: Progress] = [:]
    private(set) var failures: [String: DownloadError] = [:]

    private let tileStore = TileStore.default
    private let offlineManager = OfflineManager()
    private var cancelables: [String: Cancelable] = [:]
    private var backgroundTasks: [String: UIBackgroundTaskIdentifier] = [:]

    private init() {}

    var totalBytes: Int64 { areas.reduce(0) { $0 + $1.sizeBytes } }

    func area(forTrip tripId: String) -> OfflineArea? {
        areas.first { $0.tripId == tripId }
    }

    func area(forTrail trailId: String) -> OfflineArea? {
        areas.first { $0.trailId == trailId }
    }

    func isDownloading(_ id: String) -> Bool { cancelables[id] != nil }

    // MARK: - Estimate

    /// Bytes the area would take on disk at the given detail.
    func estimateSize(bounds: OfflineAreaBounds, detail: OfflineDetailLevel) async throws -> Int64 {
        guard let options = loadOptions(bounds: bounds, detail: detail, allowCellular: true, metadata: nil) else {
            throw DownloadError.failed
        }
        let store = tileStore
        return try await withCheckedThrowingContinuation { continuation in
            store.estimateTileRegion(
                forId: "estimate-\(UUID().uuidString)",
                loadOptions: options,
                progress: { _ in }
            ) { result in
                switch result {
                case .success(let estimate):
                    continuation.resume(returning: Int64(estimate.storageSize))
                case .failure(let error):
                    continuation.resume(throwing: Self.downloadError(from: error))
                }
            }
        }
    }

    /// Largest estimate the picker lets through. Provisional until measured
    /// against Mapbox's 750-tile-pack cap on a real park and state.
    static let maxAreaBytes: Int64 = 1_500_000_000

    /// Saved areas whose removal would make room for `bytes` under the
    /// storage limit, oldest first. Empty when no limit is set or the download
    /// already fits; nil when deleting every area would still not be enough.
    func areasToFree(forAdditional bytes: Int64) -> [OfflineArea]? {
        let limit = Defaults[.offlineMapsStorageLimitBytes]
        guard limit > 0, totalBytes + bytes > limit else { return [] }
        var over = totalBytes + bytes - limit
        var picks: [OfflineArea] = []
        for area in areas.sorted(by: { $0.savedAt < $1.savedAt }) where over > 0 {
            picks.append(area)
            over -= area.sizeBytes
        }
        return over > 0 ? nil : picks
    }

    // MARK: - Download

    /// Starts saving an area. Returns as soon as the download is under way;
    /// watch `progress` and `failures` for how it goes.
    func save(
        name: String,
        bounds: OfflineAreaBounds,
        detail: OfflineDetailLevel,
        tripId: String? = nil,
        tripEndDate: Date? = nil,
        trailId: String? = nil,
        trailLines: [[CLLocationCoordinate2D]] = [],
        allowCellular: Bool
    ) {
        let area = OfflineArea(
            id: UUID().uuidString,
            name: name,
            bounds: bounds,
            detail: detail,
            savedAt: Date(),
            tripId: tripId,
            tripEndDate: tripEndDate,
            trailId: trailId,
            trailLines: trailLines.isEmpty ? nil : trailLines.map { line in
                line.map { OfflinePoint(latitude: $0.latitude, longitude: $0.longitude) }
            }
        )
        areas.append(area)
        load(area, allowCellular: allowCellular)
    }

    /// Re-downloads an area so it carries the latest map data.
    func update(_ area: OfflineArea) {
        load(area, allowCellular: Defaults[.offlineMapsAllowCellular], refreshing: true)
    }

    /// Picks up downloads that stopped when the app was closed.
    func resumeIncomplete() {
        for area in areas where !area.isComplete && cancelables[area.id] == nil {
            load(area, allowCellular: Defaults[.offlineMapsAllowCellular])
        }
    }

    func cancel(_ area: OfflineArea) {
        cancelables[area.id]?.cancel()
        delete(area)
    }

    func rename(_ area: OfflineArea, to name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let index = areas.firstIndex(where: { $0.id == area.id }) else { return }
        areas[index].name = trimmed
    }

    func delete(_ area: OfflineArea) {
        cancelables.removeValue(forKey: area.id)?.cancel()
        progress[area.id] = nil
        failures[area.id] = nil
        endBackgroundTask(area.id)
        areas.removeAll { $0.id == area.id }
        tileStore.removeRegion(forId: area.id) { _ in }
        if areas.isEmpty {
            offlineManager.removeStylePack(for: .outdoors)
        }
    }

    func deleteAll() {
        for area in areas { delete(area) }
    }

    private func load(_ area: OfflineArea, allowCellular: Bool, refreshing: Bool = false) {
        guard let options = loadOptions(
            bounds: area.bounds,
            detail: area.detail,
            allowCellular: allowCellular,
            metadata: ["name": area.name]
        ) else {
            failures[area.id] = .failed
            return
        }

        failures[area.id] = nil
        progress[area.id] = Progress(fraction: 0, bytes: 0)
        beginBackgroundTask(area.id)

        let breadcrumb = Breadcrumb(level: .info, category: "offlineMaps")
        breadcrumb.message = refreshing ? "Update started" : "Download started"
        breadcrumb.data = ["areaId": area.id, "detail": area.detail.rawValue]
        SentrySDK.addBreadcrumb(breadcrumb)

        // The style pack holds fonts and icons the tiles need to draw. It is
        // shared by every area, so loading it again is a cheap no-op.
        offlineManager.loadStylePack(
            for: .outdoors,
            loadOptions: StylePackLoadOptions(glyphsRasterizationMode: .ideographsRasterizedLocally, acceptExpired: false)!
        ) { _ in } completion: { _ in }

        let id = area.id
        cancelables[id] = tileStore.loadTileRegion(forId: id, loadOptions: options) { [weak self] loadProgress in
            let fraction = loadProgress.requiredResourceCount == 0
                ? 0
                : Double(loadProgress.completedResourceCount) / Double(loadProgress.requiredResourceCount)
            let bytes = Int64(loadProgress.completedResourceSize)
            Task { @MainActor in
                guard self?.cancelables[id] != nil else { return }
                self?.progress[id] = Progress(fraction: fraction, bytes: bytes)
            }
        } completion: { [weak self] result in
            Task { @MainActor in
                self?.finish(id, result: result)
            }
        }
    }

    private func finish(_ id: String, result: Result<TileRegion, Error>) {
        cancelables[id] = nil
        progress[id] = nil
        endBackgroundTask(id)
        guard let index = areas.firstIndex(where: { $0.id == id }) else { return }

        switch result {
        case .success(let region):
            areas[index].sizeBytes = Int64(region.completedResourceSize)
            areas[index].isComplete = true
            areas[index].savedAt = Date()
        case .failure(let error):
            if case TileRegionError.canceled = error { return }
            let failure = Self.downloadError(from: error)
            failures[id] = failure
            SentrySDK.capture(error: error) { scope in
                scope.setTag(value: "offlineMaps", key: "feature")
                scope.setTag(value: "loadTileRegion", key: "action")
                scope.setExtra(value: id, key: "areaId")
            }
        }
    }

    // MARK: - Helpers

    private func loadOptions(
        bounds: OfflineAreaBounds,
        detail: OfflineDetailLevel,
        allowCellular: Bool,
        metadata: [String: String]?
    ) -> TileRegionLoadOptions? {
        let descriptor = offlineManager.createTilesetDescriptor(
            for: TilesetDescriptorOptions(styleURI: .outdoors, zoomRange: 0...detail.maxZoom, tilesets: nil)
        )
        return TileRegionLoadOptions(
            geometry: .polygon(Polygon([bounds.ring])),
            descriptors: [descriptor],
            metadata: metadata,
            acceptExpired: true,
            networkRestriction: allowCellular ? .none : .disallowExpensive
        )
    }

    nonisolated private static func downloadError(from error: Error) -> DownloadError {
        switch error {
        case TileRegionError.tileCountExceeded: return .tooLarge
        case TileRegionError.diskFull: return .diskFull
        default: return .failed
        }
    }

    /// Asks iOS for time to finish when the user leaves the app. Downloads
    /// that still run out of time resume on the next launch.
    private func beginBackgroundTask(_ id: String) {
        guard backgroundTasks[id] == nil else { return }
        backgroundTasks[id] = UIApplication.shared.beginBackgroundTask(withName: "offline-map-\(id)") { [weak self] in
            Task { @MainActor in self?.endBackgroundTask(id) }
        }
    }

    private func endBackgroundTask(_ id: String) {
        guard let task = backgroundTasks.removeValue(forKey: id) else { return }
        UIApplication.shared.endBackgroundTask(task)
    }
}
#endif
