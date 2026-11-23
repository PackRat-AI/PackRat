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

    /// Where a tapped notification leads.
    enum Route: Equatable {
        case deepLink(DeepLink)
        /// A trail-report push also names the report, opened over its trip.
        case trailReport(tripId: String, reportId: String)
    }

    /// The last tap not yet acted on. A tap can arrive before the main window
    /// is up (a cold launch, a session still restoring, or every Mac window
    /// closed), when nothing is listening for the event, so the route waits
    /// here until `AppNavigation` takes it.
    @MainActor private(set) static var pendingRoute: Route?

    /// Notification tap — deep-links a trip reminder to its trip, or a weather
    /// alert to the alerting location's detail, via
    /// the same `DeepLink`/`AppState.apply` path a `packrat://` URL uses.
    @MainActor
    static func routeTap(_ userInfo: [AnyHashable: Any]) {
        guard let route = route(for: userInfo) else { return }
        pendingRoute = route
        NotificationCenter.default.post(name: .pushNotificationTapped, object: nil)
    }

    /// Hands over the pending route once, so it is applied by one window only.
    @MainActor
    static func takePendingRoute() -> Route? {
        defer { pendingRoute = nil }
        return pendingRoute
    }

    static func route(for userInfo: [AnyHashable: Any]) -> Route? {
        // Feed tag, comment and reply notifications carry the post's id.
        if let postId = (userInfo["postId"] as? Int) ?? (userInfo["postId"] as? String).flatMap(Int.init) {
            return .deepLink(.post(id: postId))
        }
        if let tripId = userInfo[tripIdKey] as? String {
            if let reportId = userInfo["reportId"] as? String {
                return .trailReport(tripId: tripId, reportId: reportId)
            }
            return .deepLink(.trip(id: tripId))
        }
        guard let weatherLocationId = userInfo["weatherLocationId"] as? Int else { return nil }
        return .deepLink(.weatherAlert(weatherLocationId: weatherLocationId))
    }
}

extension Notification.Name {
    static let pushNotificationTapped = Notification.Name("pushNotificationTapped")
}
