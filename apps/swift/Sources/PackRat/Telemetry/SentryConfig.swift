import Foundation
import Sentry

/// Centralised Sentry lifecycle.
///
/// `SentryConfig.start()` is called once from `PackRatApp.init()` before any
/// `WindowGroup` is built. The DSN comes from `Info.plist["SENTRY_DSN"]`
/// (sourced from xcconfig at build time). An empty/missing DSN is treated as
/// "telemetry disabled" — the call is a silent no-op, mirroring the Expo
/// behavior when `EXPO_PUBLIC_SENTRY_DSN` is absent.
///
/// `setUser(_:)` and `clearUser()` are invoked from `AuthManager` so the
/// scope tracks the currently authenticated user. Crash reports surface
/// with the user identity attached, matching the Expo iOS app's behavior.
public enum SentryConfig {
    /// Pulls the DSN from an Info.plist-shaped dictionary. Extracted so the
    /// resolver can be unit-tested without touching `Bundle.main`.
    public static func dsnFromInfo(_ info: [String: Any]?) -> String? {
        guard let raw = info?["SENTRY_DSN"] as? String else { return nil }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    /// Initialise Sentry. Safe to call at most once per process; idempotent
    /// guards against the SDK's own re-init protection.
    public static func start(info: [String: Any]? = Bundle.main.infoDictionary) {
        guard let dsn = dsnFromInfo(info) else { return }
        SentrySDK.start { options in
            options.dsn = dsn
            options.tracesSampleRate = 0.2
            options.enableAutoPerformanceTracing = true
            options.environment = (info?["PACKRAT_ENV"] as? String) ?? "unknown"
            options.releaseName = (info?["CFBundleShortVersionString"] as? String).map {
                "PackRat@\($0)"
            }
        }
    }

    public static func setUser(id: String, email: String?) {
        SentrySDK.configureScope { scope in
            // Sentry.User collides with PackRat.User (the auth model); fully qualify.
            let user = Sentry.User(userId: id)
            user.email = email
            scope.setUser(user)
        }
    }

    public static func clearUser() {
        SentrySDK.configureScope { scope in
            scope.setUser(nil)
        }
    }
}
