import SwiftUI
import Sentry
import UserNotifications

/// Whether PackRat may post notifications, reread each time the app returns to
/// the foreground so a change made in system settings shows up at once.
@MainActor
@Observable
final class NotificationAuthorization {
    /// nil until the first read.
    private(set) var status: UNAuthorizationStatus?

    func refresh() async {
        status = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    /// Only where alerts are on, since an alert that is switched off has
    /// nothing to miss, and only once notifications are known to be off:
    /// refused, or never asked for.
    nonisolated static func showsNotice(status: UNAuthorizationStatus?, alertsOn: Bool) -> Bool {
        alertsOn && (status == .denied || status == .notDetermined)
    }

    /// Never asked: the system prompt can still be shown, so the notice asks in
    /// context. Refused: iOS won't prompt again, so it points to Settings.
    var canAsk: Bool { status == .notDetermined }

    func request() async {
        #if os(iOS) || os(macOS)
        await PushRegistrationService.registerForPushIfNeeded()
        #else
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
        #endif
        await refresh()
    }

    func showsNotice(alertsOn: Bool) -> Bool {
        Self.showsNotice(status: status, alertsOn: alertsOn)
    }
}

/// Says trip alerts can't arrive while notifications are off for PackRat, with
/// the way to turn them back on. Product behaviour: docs/features/weather-alerts.md.
struct NotificationsOffNotice: View {
    let authorization: NotificationAuthorization
    @Environment(\.openURL) private var openURL

    private var settingsURL: URL? {
        #if os(iOS)
        URL(string: UIApplication.openNotificationSettingsURLString)
        #else
        URL(string: "x-apple.systempreferences:com.apple.Notifications-Settings.extension?id=\(Bundle.main.bundleIdentifier ?? "")")
        #endif
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "bell.slash")
                .font(.title3)
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 10) {
                Text("Turn on notifications for PackRat to get weather alerts for your trips.")
                    .font(.callout)
                    .fixedSize(horizontal: false, vertical: true)
                if authorization.canAsk {
                    Button("Turn On Notifications") {
                        SentrySDK.addBreadcrumb(Self.crumb("Asked for notifications from the notifications-off notice"))
                        Task { await authorization.request() }
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .accessibilityIdentifier("notifications_off_notice_ask")
                } else {
                    Button("Open Settings") {
                        SentrySDK.addBreadcrumb(Self.crumb("Opened notification settings from the notifications-off notice"))
                        if let settingsURL { openURL(settingsURL) }
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .accessibilityIdentifier("notifications_off_notice_settings")
                }
            }
            Spacer(minLength: 0)
        }
    }

    private static func crumb(_ message: String) -> Breadcrumb {
        let crumb = Breadcrumb(level: .info, category: "notifications")
        crumb.message = message
        return crumb
    }
}

extension View {
    /// Keeps `authorization` current: read on appear and again whenever the
    /// app comes back to the foreground.
    func tracksNotificationAuthorization(_ authorization: NotificationAuthorization) -> some View {
        modifier(NotificationAuthorizationTracking(authorization: authorization))
    }
}

private struct NotificationAuthorizationTracking: ViewModifier {
    let authorization: NotificationAuthorization
    @Environment(\.scenePhase) private var scenePhase

    func body(content: Content) -> some View {
        content
            .task { await authorization.refresh() }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active { Task { await authorization.refresh() } }
            }
            #if os(macOS)
            // A Mac window's scene stays active while another app is in front,
            // so coming back from System Settings never changes scenePhase.
            .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
                Task { await authorization.refresh() }
            }
            #endif
    }
}
