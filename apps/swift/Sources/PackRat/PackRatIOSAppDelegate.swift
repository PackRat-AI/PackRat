#if os(iOS)
import UIKit
import UserNotifications

/// Handles APNs registration and notification-tap routing for weather alert
/// push. iOS-only — macOS has its own `PackRatMacAppDelegate` in
/// PackRatApp.swift, unrelated to this (no push story on macOS yet).
final class PackRatIOSAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        PushRegistrationService.handleDeviceToken(deviceToken)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        // No Sentry call here deliberately: this is a Foundation-level
        // registration failure (simulator without push entitlement, no
        // network), not an application error worth paging on. The device
        // simply won't receive push until the next successful registration.
    }

    /// Foreground presentation while the app is open — still show the
    /// banner/sound so a watched alert isn't silently swallowed just because
    /// the app happened to be frontmost.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .badge]
    }

    /// Notification tap — deep-links into the alerting location's detail via
    /// the same `DeepLink`/`AppState.apply` path a `packrat://` URL uses.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        guard let weatherLocationId = response.notification.request.content.userInfo["weatherLocationId"] as? Int
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
}
#endif
