import Foundation
import UserNotifications

/// Local notifications for an active check-in. Scheduled on the phone rather
/// than pushed, so they arrive on time with no signal: an hour before the
/// expected return, and when the overdue alert goes to the contacts.
enum SafetyCheckInNotifications {
    static let reminderLeadTime: TimeInterval = 60 * 60
    /// The key `TripReminderScheduler` uses (iOS-only), so a tap opens the trip.
    static let tripIdKey = "tripId"

    static func reminderId(_ checkInId: String) -> String { "safety-reminder-\(checkInId)" }
    static func overdueId(_ checkInId: String) -> String { "safety-overdue-\(checkInId)" }

    struct Planned: Equatable {
        let id: String
        let fireAt: Date
        let title: String
        let body: String
    }

    /// What to schedule for a check-in, skipping anything already in the past.
    static func plan(for checkIn: LocalSafetyCheckIn, now: Date = Date()) -> [Planned] {
        let returnTime = checkIn.expectedReturnAt.formatted(date: .omitted, time: .shortened)
        let candidates = [
            Planned(
                id: reminderId(checkIn.id),
                fireAt: checkIn.expectedReturnAt.addingTimeInterval(-reminderLeadTime),
                title: "Your contacts are expecting you",
                body: "You're due back from \(checkIn.tripName) at \(returnTime). "
                    + "Mark yourself safe, or push your return time back."
            ),
            Planned(
                id: overdueId(checkIn.id),
                fireAt: checkIn.overdueAt,
                title: "Overdue alert sent",
                body: overdueBody(checkIn)
            ),
        ]
        return candidates.filter { $0.fireAt > now }
    }

    private static func overdueBody(_ checkIn: LocalSafetyCheckIn) -> String {
        let who = checkIn.contactSummary
        let subject = who.prefix(1).uppercased() + who.dropFirst()
        let verb = checkIn.contactNames.count == 1 ? "has" : "have"
        return "\(subject) \(verb) been told you're overdue on \(checkIn.tripName). "
            + "Tap I'm Safe as soon as you can."
    }

    static func schedule(for checkIn: LocalSafetyCheckIn) {
        let center = UNUserNotificationCenter.current()
        cancel(for: checkIn)
        for planned in plan(for: checkIn) {
            let content = UNMutableNotificationContent()
            content.title = planned.title
            content.body = planned.body
            content.sound = .default
            content.userInfo = [tripIdKey: checkIn.tripId]
            let components = Calendar.current.dateComponents(
                [.year, .month, .day, .hour, .minute, .second], from: planned.fireAt
            )
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            center.add(UNNotificationRequest(identifier: planned.id, content: content, trigger: trigger))
        }
    }

    static func cancel(for checkIn: LocalSafetyCheckIn) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: [reminderId(checkIn.id), overdueId(checkIn.id)]
        )
    }
}
