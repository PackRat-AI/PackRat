#if os(iOS)
import UIKit
import UserNotifications

/// Handles APNs registration and notification-tap routing for weather alert
/// push on iOS. macOS does the same from `PackRatMacAppDelegate` in
/// PackRatApp.swift; both route through `PushNotificationRouter`.
final class PackRatIOSAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        // Relaunched in the background for a significant location change:
        // restart monitoring so the update is delivered and queued.
        Task { @MainActor in
            SafetyLocationTracker.shared.resumeIfNeeded()
            // Carry on a hike recording PackRat was closed in the middle of.
            TrackRecorder.shared.resumeIfNeeded()
            TripGuide.shared.resumeIfNeeded()
        }
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

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        PushNotificationRouter.foregroundPresentation
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        await PushNotificationRouter.routeTap(response.notification.request.content.userInfo)
    }
}
#endif
