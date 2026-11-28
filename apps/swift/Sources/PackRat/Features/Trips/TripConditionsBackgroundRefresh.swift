#if os(iOS)
import BackgroundTasks
#elseif os(macOS)
import AppKit
#endif
import Foundation
import SwiftData

/// Keeps pre-trip reminders current when the app isn't looked at for days:
/// the destination forecast is refetched, new weather alerts are announced,
/// and the pending reminders are rewritten with the latest copy. Works from
/// the on-device cache — no UI is running.
///
/// iOS wakes a closed app for this with `BGTaskScheduler`. The Mac has no app
/// refresh tasks, but a Mac app usually stays open in the background for days
/// with its scene phase still active, so foreground hooks never fire; there
/// the same work runs from `NSBackgroundActivityScheduler` while it is open.
enum TripConditionsBackgroundRefresh {
    static let identifier = "world.packrat.trip-conditions"
    /// The system treats this as a floor and picks the real time from usage.
    static let interval: TimeInterval = 4 * 60 * 60

    #if os(iOS)
    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: identifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: interval)
        try? BGTaskScheduler.shared.submit(request)
    }
    #endif

    #if os(macOS)
    @MainActor private static var macActivity: NSBackgroundActivityScheduler?

    /// Starts the repeating refresh once per launch; every window calls this.
    @MainActor
    static func startMacSchedule() {
        guard macActivity == nil else { return }
        let activity = NSBackgroundActivityScheduler(identifier: identifier)
        activity.repeats = true
        activity.interval = interval
        activity.tolerance = interval / 4
        activity.qualityOfService = .utility
        activity.schedule { completion in
            Task { @MainActor in
                await refreshFromCache()
                completion(.finished)
            }
        }
        macActivity = activity
    }
    #endif

    @MainActor
    static func run() async {
        #if os(iOS)
        // Chain the next wake first, so an expired run still leaves one queued.
        schedule()
        #endif
        await refreshFromCache()
    }

    @MainActor
    private static func refreshFromCache() async {
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
