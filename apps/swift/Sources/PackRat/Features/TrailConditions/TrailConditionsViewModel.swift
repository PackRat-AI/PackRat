import Foundation
import Observation
import SwiftData

@Observable
@MainActor
final class TrailConditionsViewModel {
    var reports: [TrailConditionReport] = []
    var isLoading = false
    var error: String?
    var searchText = ""
    /// Who wrote each feed report, by report id. Absent for the hiker's own
    /// unsent reports.
    var authorNames: [String: String] = [:]

    private let service: TrailConditionsService
    private let outbox: OutboxService
    private let context: ModelContext?

    // An isolated singleton cannot be a default argument under the Swift 6
    // language mode, so resolve them in the body.
    init(service: TrailConditionsService = .shared, outbox: OutboxService? = nil, context: ModelContext? = nil) {
        self.service = service
        self.outbox = outbox ?? .shared
        self.context = context ?? PersistenceController.shared.container.mainContext
    }

    func load() async {
        if VisualSampleData.isEnabled && !reports.isEmpty {
            isLoading = false
            error = nil
            return
        }
        if VisualSampleData.isScreenshotCapture {
            isLoading = false
            error = nil
            reports = []
            return
        }

        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let feed = try await service.listReports()
            let queued = queuedReports()
            pendingIds = Set(queued.map(\.id))
            // A queued report the server already has comes back in the feed.
            let sent = Set(feed.map(\.id))
            reports = queued.filter { !sent.contains($0.id) } + feed.map(\.report)
            authorNames = Dictionary(
                feed.compactMap { item in item.authorName.map { (item.id, $0) } },
                uniquingKeysWith: { first, _ in first }
            )
        } catch {
            let queued = queuedReports()
            pendingIds = Set(queued.map(\.id))
            if queued.isEmpty {
                self.error = error.localizedDescription
            } else {
                reports = queued + reports.filter { !pendingIds.contains($0.id) }
            }
        }
    }

    /// Ids of the hiker's reports still waiting in the outbox.
    var pendingIds: Set<String> = []

    /// Submits a report about `place`. `writtenAt` is where the device was when
    /// the hiker wrote it; for a pin, the pin itself is the place.
    ///
    /// Without signal, or when the send fails for a reason a retry can fix, the
    /// report is queued, photos included, and shows in the feed straight away.
    /// Only a report the server rejects outright throws.
    func submitReport(
        place: ReportPlace,
        writtenAt: (latitude: Double, longitude: Double)?,
        surface: String?,
        overallCondition: String,
        hazards: [String],
        notes: String?,
        photos: [ReportPhotoInput] = [],
        photoOwnerId: String?,
        tripId: String? = nil
    ) async throws {
        let coordinate: (latitude: Double, longitude: Double)? = switch place {
        case .trail: writtenAt
        case .pin(_, let latitude, let longitude): (latitude, longitude)
        }
        // The same id goes to the server and to the queue, so a send that did
        // land before the connection dropped can't turn into two reports.
        let id = UUID().uuidString.lowercased()
        let uploadedKeys = photos.compactMap(\.uploadedKey)

        if NetworkMonitor.shared.isConnected && uploadedKeys.count == photos.count {
            do {
                let report = try await service.createReport(
                    id: id,
                    trailId: place.trailId,
                    trailName: place.displayName,
                    trailRegion: nil,
                    latitude: coordinate?.latitude,
                    longitude: coordinate?.longitude,
                    surface: surface,
                    overallCondition: overallCondition,
                    hazards: hazards,
                    notes: notes,
                    photos: uploadedKeys,
                    tripId: tripId
                )
                show(report)
                return
            } catch {
                if case .terminal = outbox.classify(error, operation: .create) { throw error }
            }
        }

        let entries = try photos.map { photo in
            switch photo {
            case .uploaded(let key): key
            case .local(let jpeg): try PendingReportPhotos.save(jpeg, reportId: id)
            }
        }
        let payload = TrailConditionReportMutationPayload(
            trailId: place.trailId,
            trailName: place.displayName,
            latitude: coordinate?.latitude,
            longitude: coordinate?.longitude,
            surface: surface,
            overallCondition: overallCondition,
            hazards: hazards,
            notes: notes,
            photos: entries,
            tripId: tripId,
            photoOwnerId: photoOwnerId
        )
        guard let data = OutboxService.encode(payload) else {
            PendingReportPhotos.remove(reportId: id)
            throw PackRatError.unknown
        }
        outbox.enqueue(
            entityType: .trailConditionReport,
            entityId: id,
            operation: .create,
            payload: data,
            context: context
        )
        pendingIds.insert(id)
        show(Self.pendingReport(id: id, payload: payload, writtenAt: Date()))
    }

    func deleteReport(_ id: String) async throws {
        if pendingIds.contains(id) {
            // Never reached the server: dropping the queued create is the delete.
            outbox.enqueue(entityType: .trailConditionReport, entityId: id, operation: .delete, context: context)
            PendingReportPhotos.remove(reportId: id)
            pendingIds.remove(id)
            reports.removeAll { $0.id == id }
            return
        }
        try await service.deleteReport(id)
        reports.removeAll { $0.id == id }
    }

    private func show(_ report: TrailConditionReport) {
        searchText = ""
        reports.removeAll { $0.id == report.id }
        reports.insert(report, at: 0)
    }

    /// The hiker's reports still in the outbox, newest first, so a report
    /// written without signal stays in the feed across launches until it sends.
    private func queuedReports() -> [TrailConditionReport] {
        guard let context else { return [] }
        let type = OutboxEntityType.trailConditionReport.rawValue
        let create = OutboxOperation.create.rawValue
        var descriptor = FetchDescriptor<PendingMutation>(
            predicate: #Predicate { $0.entityTypeRaw == type && $0.operationRaw == create }
        )
        descriptor.sortBy = [SortDescriptor(\.createdAt, order: .reverse)]
        let queued = (try? context.fetch(descriptor)) ?? []
        return queued.compactMap { mutation in
            guard let data = mutation.payload,
                  let payload = try? JSONDecoder().decode(TrailConditionReportMutationPayload.self, from: data)
            else { return nil }
            return Self.pendingReport(id: mutation.entityId, payload: payload, writtenAt: mutation.createdAt)
        }
    }

    private static func pendingReport(
        id: String,
        payload: TrailConditionReportMutationPayload,
        writtenAt: Date
    ) -> TrailConditionReport {
        let written = writtenAt.iso8601String()
        return TrailConditionReport(
            id: id,
            trailId: payload.trailId,
            trailName: payload.trailName,
            trailRegion: nil,
            latitude: payload.latitude,
            longitude: payload.longitude,
            surface: payload.surface ?? "unknown",
            overallCondition: payload.overallCondition,
            hazards: payload.hazards ?? [],
            waterCrossings: 0,
            waterCrossingDifficulty: nil,
            notes: payload.notes,
            photos: PendingReportPhotos.displayable(payload.photos ?? []),
            userId: payload.photoOwnerId,
            tripId: payload.tripId,
            deleted: false,
            createdAt: written,
            updatedAt: written
        )
    }
}

/// A photo on the submit form: already uploaded, or still only on the device.
enum ReportPhotoInput {
    case uploaded(String)
    case local(Data)

    var uploadedKey: String? {
        if case .uploaded(let key) = self { key } else { nil }
    }
}
