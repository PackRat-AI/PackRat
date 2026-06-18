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

    private override init() {
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
            pack: WatchPackSnapshot(
                name: pack?.name ?? "No Pack Selected",
                baseWeightText: formatWeight(pack?.baseWeight ?? pack?.totalWeight),
                packedItemCount: pack?.activeItems.count ?? 0,
                totalItemCount: pack?.activeItems.count ?? 0,
                checklist: makeChecklist(from: pack)
            ),
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
                temperatureText: weather?.current?.tempF.map { "\(Int($0.rounded()))°" } ?? "--",
                conditionText: weather?.current?.condition?.text ?? "Open iPhone app to sync weather.",
                symbolName: weather?.current?.condition?.sfSymbol ?? "cloud"
            ),
            trail: WatchTrailSnapshot(
                title: report?.trailName ?? "Trail Report",
                conditionText: report?.overallCondition.capitalized ?? "Ready for a field note.",
                hazardCount: report?.hazards.count ?? 0
            )
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

    private func makeChecklist(from pack: Pack?) -> [WatchChecklistItemSnapshot] {
        (pack?.activeItems ?? [])
            .prefix(8)
            .map {
                WatchChecklistItemSnapshot(
                    id: $0.id,
                    title: $0.name,
                    symbolName: symbol(for: $0.category),
                    isPacked: true
                )
            }
    }

    private func symbol(for category: String?) -> String {
        switch category?.lowercased() {
        case "shelter": return "tent"
        case "sleep": return "bed.double"
        case "water": return "drop"
        case "food": return "fork.knife"
        case "clothing": return "jacket"
        case "safety": return "cross.case"
        case "kitchen": return "flame"
        case "pack": return "backpack"
        default: return "checkmark.circle"
        }
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
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        Task { @MainActor in
            WatchCompanionService.shared.handleTrailDraftPayload(message)
        }
    }
}
#endif
