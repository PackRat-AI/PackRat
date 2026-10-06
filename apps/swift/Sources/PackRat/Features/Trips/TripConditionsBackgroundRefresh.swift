#if os(iOS)
import BackgroundTasks
import Foundation
import SwiftData

/// Keeps pre-trip reminders current when the app isn't opened for days: iOS
/// wakes the app now and then, the destination forecast is refetched, new
/// weather alerts are announced, and the pending reminders are rewritten with
/// the latest copy. Works from the on-device cache — no UI is running.
enum TripConditionsBackgroundRefresh {
    static let identifier = "world.packrat.trip-conditions"
    /// iOS treats this as a floor; it decides the real time from usage.
    static let interval: TimeInterval = 4 * 60 * 60

    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: identifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: interval)
        try? BGTaskScheduler.shared.submit(request)
    }

    @MainActor
    static func run() async {
        // Chain the next wake first, so an expired run still leaves one queued.
        schedule()
        let context = PersistenceController.shared.container.mainContext
        let trips = ((try? context.fetch(FetchDescriptor<CachedTrip>())) ?? [])
            .compactMap { $0.toTrip() }
            .activeTrips
        guard trips.contains(where: { TripConditionsStore.needsForecast($0, now: Date()) }) else { return }
        let packs = ((try? context.fetch(FetchDescriptor<CachedPack>())) ?? []).compactMap { $0.toPack() }
        await TripConditionsStore.shared.refresh(trips: trips, force: true)
        await TripReminderScheduler.sync(trips: trips, packs: packs)
    }
}
#endif
