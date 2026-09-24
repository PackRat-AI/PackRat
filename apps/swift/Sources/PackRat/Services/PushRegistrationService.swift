import Foundation
import UserNotifications
#if os(iOS)
import UIKit
#endif

/// Requests notification permission and registers this device for weather
/// alert push, contextually — at the moment a user first adds a location to
/// their watch list, not at app launch (Apple's own guidance: don't ask
/// before the value is obvious). See docs/features/weather-alerts.md.
@MainActor
enum PushRegistrationService {
    /// Call after a successful `watchLocation`/`watchSelectedLocation`. A
    /// user who has already granted or denied notifications is a fast no-op
    /// (`requestAuthorization` is safe to call repeatedly); a user who has
    /// never been asked sees the system prompt now, for the first time.
    static func registerForPushIfNeeded() async {
        #if os(iOS)
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .notDetermined || settings.authorizationStatus == .authorized else {
            return // denied/restricted/ephemeral — nothing to do, and re-asking would be a no-op anyway
        }
        if settings.authorizationStatus == .notDetermined {
            guard let granted = try? await center.requestAuthorization(options: [.alert, .sound, .badge]),
                  granted else { return }
        }
        UIApplication.shared.registerForRemoteNotifications()
        #endif
    }

    static func handleDeviceToken(_ deviceToken: Data) {
        let tokenString = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task {
            try? await WeatherMonitoringService.shared.registerDeviceToken(
                RegisterDeviceTokenRequest(platform: "ios", deviceToken: tokenString)
            )
        }
    }
}
