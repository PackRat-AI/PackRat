import Foundation
import UserNotifications
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
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
    /// Returns false when notifications are off, so the caller can say so.
    @discardableResult
    static func registerForPushIfNeeded() async -> Bool {
        #if os(iOS) || os(macOS)
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .notDetermined || settings.authorizationStatus == .authorized else {
            return false // denied/restricted/ephemeral — re-asking would be a no-op
        }
        if settings.authorizationStatus == .notDetermined {
            guard let granted = try? await center.requestAuthorization(options: [.alert, .sound, .badge]),
                  granted else { return false }
        }
        #if os(iOS)
        UIApplication.shared.registerForRemoteNotifications()
        #else
        NSApplication.shared.registerForRemoteNotifications()
        #endif
        #endif
        return true
    }

    #if os(macOS)
    private static let platform = "macos"
    #else
    private static let platform = "ios"
    #endif

    static func handleDeviceToken(_ deviceToken: Data) {
        let tokenString = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task {
            try? await WeatherMonitoringService.shared.registerDeviceToken(
                RegisterDeviceTokenRequest(platform: platform, deviceToken: tokenString)
            )
        }
    }
}
