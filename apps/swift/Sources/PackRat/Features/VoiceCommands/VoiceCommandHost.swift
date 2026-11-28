#if os(iOS)
import Foundation
import SwiftData

/// What Siri and spoken safety alerts need from the running app, away from
/// any trip page: the trips, and the stores the trip page acts through.
/// Attached by the navigation root once the app's UI is up.
@MainActor
final class VoiceCommandHost {
    static let shared = VoiceCommandHost()

    private weak var appState: AppState?
    private var modelContext: ModelContext?

    func attach(_ appState: AppState, modelContext: ModelContext) {
        self.appState = appState
        self.modelContext = modelContext
    }

    var isAttached: Bool { appState != nil && modelContext != nil }

    var trips: [Trip] { appState?.tripsVM.trips ?? [] }

    /// The trip a command from outside the trip page is about.
    func context(now: Date = Date()) -> VoiceCommandController.Context? {
        guard let appState, let modelContext else { return nil }
        let busy = [TrackRecorder.shared.track?.tripId, TripGuide.shared.session?.tripId].compactMap { $0 }
        guard let trip = Self.activeTrip(in: appState.tripsVM.trips, preferring: busy, now: now) else { return nil }
        let pack = trip.packId.flatMap { id in appState.packsVM.packs.first { $0.id == id } }
        return .init(trip: trip, pack: pack, viewModel: appState.tripsVM, modelContext: modelContext)
    }

    /// The trip being tracked or guided, otherwise the one in progress that
    /// started last, otherwise one starting today, so "start my trip" works.
    nonisolated static func activeTrip(in trips: [Trip], preferring ids: [String], now: Date) -> Trip? {
        let live = trips.filter { !$0.deleted }
        if let busy = live.first(where: { ids.contains($0.id) && $0.lifecycle != .complete }) { return busy }
        let started = live.filter { $0.lifecycle == .inProgress }
        if let latest = started.max(by: { ($0.startedAt ?? $0.startDate ?? "") < ($1.startedAt ?? $1.startDate ?? "") }) {
            return latest
        }
        return live.first { trip in
            guard trip.lifecycle == .planned, let start = trip.startDate?.toDate() else { return false }
            return Calendar.current.isDate(start, inSameDayAs: now)
        }
    }

    /// The trip in progress, for safety alerts.
    func tripInProgress(now: Date = Date()) -> Trip? {
        let trip = Self.activeTrip(in: trips, preferring: [], now: now)
        return trip?.lifecycle == .inProgress ? trip : nil
    }
}
#endif
