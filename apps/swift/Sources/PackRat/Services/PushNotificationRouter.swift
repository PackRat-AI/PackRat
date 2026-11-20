import Foundation
import UserNotifications

/// Notification presentation and tap routing shared by the iOS and macOS app
/// delegates, so a weather alert, trip reminder or feed push opens the same
/// screen on both.
enum PushNotificationRouter {
    /// The trip a reminder or trail-report push belongs to.
    static let tripIdKey = "tripId"

    /// Foreground presentation while the app is open — still show the
    /// banner/sound so a watched alert isn't silently swallowed just because
    /// the app happened to be frontmost.
    static let foregroundPresentation: UNNotificationPresentationOptions = [.banner, .sound, .badge]

    /// Notification tap — deep-links a trip reminder to its trip, or a weather
    /// alert to the alerting location's detail, via
    /// the same `DeepLink`/`AppState.apply` path a `packrat://` URL uses.
    static func routeTap(_ userInfo: [AnyHashable: Any]) {
        // Feed tag, comment and reply notifications carry the post's id.
        if let postId = (userInfo["postId"] as? Int) ?? (userInfo["postId"] as? String).flatMap(Int.init) {
            NotificationCenter.default.post(
                name: .feedPostNotificationTapped,
                object: nil,
                userInfo: ["postId": postId]
            )
            return
        }
        if let tripId = userInfo[tripIdKey] as? String {
            // Trail-report pushes also name the report, opened over its trip.
            var routed: [String: String] = [tripIdKey: tripId]
            routed["reportId"] = userInfo["reportId"] as? String
            NotificationCenter.default.post(
                name: .tripReminderNotificationTapped,
                object: nil,
                userInfo: routed
            )
            return
        }
        guard let weatherLocationId = userInfo["weatherLocationId"] as? Int
        else { return }
        NotificationCenter.default.post(
            name: .weatherAlertNotificationTapped,
            object: nil,
            userInfo: ["weatherLocationId": weatherLocationId]
        )
    }
}

extension Notification.Name {
    static let weatherAlertNotificationTapped = Notification.Name("weatherAlertNotificationTapped")
    static let feedPostNotificationTapped = Notification.Name("feedPostNotificationTapped")
    static let tripReminderNotificationTapped = Notification.Name("tripReminderNotificationTapped")
}
