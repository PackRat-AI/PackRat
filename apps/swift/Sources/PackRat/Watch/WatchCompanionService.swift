#if os(iOS)
import Foundation
import WatchConnectivity

@MainActor
final class WatchCompanionService: NSObject {
    static let shared = WatchCompanionService()

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private var session: WCSession?
    private var lastSnapshot: PackRatWatchSnapshot?

    private let packingModeStore: PackingModeStore
    private let defaults: UserDefaults

    /// Retained so a toggle arriving from the watch can push a corrected
    /// snapshot straight back without waiting for the phone UI's 15s republish
    /// loop — the watch needs to see its own change confirmed.
    private weak var lastPublishedAppState: AppState?

    private var temperatureUnit: WatchTemperatureUnit {
        WatchTemperatureUnit.fromDefaults(defaults)
    }

    init(
        packingModeStore: PackingModeStore = .shared,
        defaults: UserDefaults = .standard
    ) {
        self.packingModeStore = packingModeStore
        self.defaults = defaults
        super.init()
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
    }

    func activate() {
        guard WCSession.isSupported(), session == nil else { return }
        let activeSession = WCSession.default
        activeSession.delegate = self
        activeSession.activate()
        session = activeSession
    }

    func publishSnapshot(from appState: AppState) {
        lastPublishedAppState = appState
        let snapshot = makeSnapshot(from: appState)
        guard snapshot != lastSnapshot else { return }
        lastSnapshot = snapshot
        send(snapshot)
    }

    private func send(_ snapshot: PackRatWatchSnapshot) {
        guard let session else { return }
        do {
            let data = try encoder.encode(snapshot)
            let payload = [WatchCompanionMessage.snapshot: data]
            try session.updateApplicationContext(payload)
            session.transferUserInfo(payload)
        } catch {
            print("[Watch] Failed to publish snapshot: \(error.localizedDescription)")
        }
    }

    private func makeSnapshot(from appState: AppState) -> PackRatWatchSnapshot {
        let pack = selectedPack(from: appState)
        let trip = selectedTrip(from: appState)
        let weather = appState.weatherVM.forecast
        let report = appState.trailConditionsVM.reports.first

        return PackRatWatchSnapshot(
            updatedAt: Date(),
            pack: makePackSnapshot(from: pack),
            trip: trip.map {
                WatchTripSnapshot(
                    name: $0.name,
                    locationName: $0.location?.name,
                    dateText: $0.dateRange.isEmpty ? nil : $0.dateRange
                )
            },
            weather: WatchWeatherSnapshot(
                locationName: appState.weatherVM.selectedLocation?.displayName
                    ?? weather?.location?.name
                    ?? "No Location",
                temperatureText: temperatureUnit.format(
                    celsius: weather?.current?.tempC,
                    fahrenheit: weather?.current?.tempF
                ),
                conditionText: weather?.current?.condition?.text ?? "Open iPhone app to sync weather.",
                symbolName: weather?.current?.condition?.sfSymbol ?? "cloud"
            ),
            trail: WatchTrailSnapshot(
                title: report?.trailName ?? "Trail Report",
                conditionText: report?.overallCondition.capitalized ?? "Ready for a field note.",
                hazardCount: report?.hazards.count ?? 0
            ),
            // Resolved on the phone, which owns the RevenueCat SDK. Reads the
            // store's cached answer rather than the network, so publishing a
            // snapshot never blocks on a fetch; an unresolved store reports
            // false, leaving the watch fail-closed.
            isPro: FeatureAccessStore.shared.isPro
        )
    }

    private func selectedPack(from appState: AppState) -> Pack? {
        if let id = appState.selectedPackId,
           let selected = appState.packsVM.packs.first(where: { $0.id == id }) {
            return selected
        }
        if let tripPackId = selectedTrip(from: appState)?.packId,
           let tripPack = appState.packsVM.packs.first(where: { $0.id == tripPackId }) {
            return tripPack
        }
        return appState.packsVM.packs.first
    }

    private func selectedTrip(from appState: AppState) -> Trip? {
        if let id = appState.selectedTripId,
           let selected = appState.tripsVM.trips.first(where: { $0.id == id }) {
            return selected
        }
        return appState.tripsVM.trips.first
    }

    /// Builds the pack half of the snapshot from real packed state.
    ///
    /// Packed state comes from `PackingModeStore`, the phone's source of truth
    /// (see #2694/#2718 — this used to hardcode `isPacked: true`, so the watch
    /// showed a fully ticked list and a count that disagreed with the phone).
    private func makePackSnapshot(from pack: Pack?) -> WatchPackSnapshot {
        guard let pack else {
            return WatchSnapshotBuilder.makePackSnapshot(
                packId: nil,
                name: "No Pack Selected",
                baseWeightText: formatWeight(nil),
                items: [],
                isPacked: { _ in false }
            )
        }

        let packingMode = packingModeStore
        return WatchSnapshotBuilder.makePackSnapshot(
            packId: pack.id,
            name: pack.name,
            baseWeightText: formatWeight(pack.baseWeight ?? pack.totalWeight),
            items: pack.activeItems.map {
                WatchSnapshotBuilder.Item(id: $0.id, name: $0.name, category: $0.category)
            },
            isPacked: { packingMode.isPacked($0, in: pack.id) }
        )
    }

    private func formatWeight(_ grams: Double?) -> String {
        guard let grams, grams > 0 else { return "--" }
        let pounds = grams / 453.592
        return String(format: "%.1f lb", pounds)
    }

    private func handleTrailDraft(_ draft: WatchTrailReportDraft) {
        UserDefaults.standard.set(draft.condition, forKey: "watch.latestTrailDraft.condition")
        UserDefaults.standard.set(draft.note, forKey: "watch.latestTrailDraft.note")
        UserDefaults.standard.set(draft.createdAt, forKey: "watch.latestTrailDraft.createdAt")
    }

    /// Applies a packed/unpacked change made on the watch to the phone's store.
    ///
    /// Returns the applied message so callers (and tests) can tell a real change
    /// from an ignored payload. Idempotent: WatchConnectivity delivers a toggle
    /// over both `sendMessage` and `transferUserInfo` so it survives the phone
    /// being unreachable, which means the same change can arrive twice.
    @discardableResult
    func applyChecklistToggle(_ message: WatchChecklistToggleMessage) -> WatchChecklistToggleMessage {
        packingModeStore.setPacked(
            message.isPacked,
            itemId: message.itemId,
            in: message.packId
        )
        return message
    }

    private func handleChecklistTogglePayload(_ payload: [String: Any]) {
        guard let data = payload[WatchCompanionMessage.checklistToggle] as? Data,
              let message = try? decoder.decode(WatchChecklistToggleMessage.self, from: data)
        else { return }

        applyChecklistToggle(message)

        // Push the corrected state back so the watch's optimistic toggle is
        // confirmed by the phone rather than left to drift until the next
        // periodic republish. `lastSnapshot` is cleared because the pack half
        // changed underneath the equality check that normally suppresses sends.
        guard let appState = lastPublishedAppState else { return }
        lastSnapshot = nil
        publishSnapshot(from: appState)
    }

    private func handleTrailDraftPayload(_ payload: [String: Any]) {
        guard let data = payload[WatchCompanionMessage.trailDraft] as? Data else { return }
        guard let draft = try? decoder.decode(WatchTrailReportDraft.self, from: data) else { return }
        handleTrailDraft(draft)
    }
}

extension WatchCompanionService: WCSessionDelegate {
    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        if let error {
            print("[Watch] Activation failed: \(error.localizedDescription)")
        }
    }

    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}

    nonisolated func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    nonisolated func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        Task { @MainActor in
            WatchCompanionService.shared.handleTrailDraftPayload(userInfo)
            WatchCompanionService.shared.handleChecklistTogglePayload(userInfo)
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        Task { @MainActor in
            WatchCompanionService.shared.handleTrailDraftPayload(message)
            WatchCompanionService.shared.handleChecklistTogglePayload(message)
        }
    }
}
#endif
