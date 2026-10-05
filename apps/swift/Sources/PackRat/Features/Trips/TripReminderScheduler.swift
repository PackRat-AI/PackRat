#if os(iOS)
import Foundation
import Sentry
import UserNotifications

/// Keeps the device's pending pre-trip reminders in step with the user's trips.
///
/// Reminders are local notifications, so they fire with no signal. Each sync
/// clears every pending trip reminder and schedules afresh from current state:
/// that one rule covers new trips, moved dates, deleted trips and packing
/// progress without tracking any of them individually.
@MainActor
enum TripReminderScheduler {
    static let flagKey = TripReminderPlanner.flagKey
    static let tripIdKey = "tripId"

    /// iOS keeps at most 64 pending local notifications per app; leave headroom
    /// for anything else the app schedules.
    private static let maxPending = 48

    static func sync(
        trips: [Trip],
        packs: [Pack],
        packing: PackingModeStore = .shared,
        settings: TripReminderSettings = .shared,
        now: Date = Date()
    ) async {
        let center = UNUserNotificationCenter.current()
        let stale = await center.pendingNotificationRequests()
            .map(\.identifier)
            .filter { $0.hasPrefix(TripReminderPlanner.identifierPrefix) }
        center.removePendingNotificationRequests(withIdentifiers: stale)

        guard FeatureFlagStore.shared.isEnabled(flagKey), settings.isEnabled else { return }
        let status = await center.notificationSettings().authorizationStatus
        guard status == .authorized || status == .provisional else { return }

        var reminders = trips.filter { !settings.isMuted($0.id) }.flatMap { trip in
            let pack = trip.packId.flatMap { id in packs.first { $0.id == id } }
            let packed = pack.map { Set(packing.packedItems(in: $0.id).keys) } ?? []
            return TripReminderPlanner.reminders(for: trip, pack: pack, packedItemIds: packed, now: now)
        }
        .sorted { $0.fireDate < $1.fireDate }
        .prefix(maxPending)
        .map { $0 }

        #if DEBUG
        if ProcessInfo.processInfo.environment["PACKRAT_TRIP_REMINDER_DEMO"] == "1" {
            reminders = demoSchedule(reminders, now: now)
        }
        #endif

        for reminder in reminders {
            do {
                try await center.add(request(for: reminder))
            } catch {
                captureError(error, reminder: reminder)
            }
        }
    }

    /// Asks for notification permission at the moment it makes sense: the user
    /// just gave a trip a date. No-op once the user has answered either way.
    static func requestAuthorizationIfNeeded() async {
        guard FeatureFlagStore.shared.isEnabled(flagKey), TripReminderSettings.shared.isEnabled else { return }
        let center = UNUserNotificationCenter.current()
        guard await center.notificationSettings().authorizationStatus == .notDetermined else { return }
        _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
    }

    private static func request(for reminder: TripReminder) -> UNNotificationRequest {
        let content = UNMutableNotificationContent()
        content.title = reminder.title
        content.body = reminder.body
        content.sound = .default
        content.threadIdentifier = "\(TripReminderPlanner.identifierPrefix)\(reminder.tripId)"
        content.userInfo = [tripIdKey: reminder.tripId]
        let components = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute, .second], from: reminder.fireDate
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        return UNNotificationRequest(identifier: reminder.identifier, content: content, trigger: trigger)
    }

    private static func captureError(_ error: Error, reminder: TripReminder) {
        SentrySDK.capture(error: error) { scope in
            scope.setTag(value: "tripReminders", key: "feature")
            scope.setTag(value: "schedule", key: "action")
            scope.setExtra(value: reminder.tripId, key: "tripId")
            scope.setExtra(value: reminder.moment.rawValue, key: "moment")
        }
    }

    #if DEBUG
    /// Fires the soonest trip's reminders 10 s apart so the whole countdown can
    /// be watched in under a minute. Launch with PACKRAT_TRIP_REMINDER_DEMO=1.
    private static func demoSchedule(_ reminders: [TripReminder], now: Date) -> [TripReminder] {
        guard let tripId = reminders.first?.tripId else { return [] }
        return reminders.filter { $0.tripId == tripId }.enumerated().map { index, reminder in
            TripReminder(
                tripId: reminder.tripId,
                moment: reminder.moment,
                fireDate: now.addingTimeInterval(Double(index + 1) * 10),
                title: reminder.title,
                body: reminder.body
            )
        }
    }
    #endif
}
#endif
