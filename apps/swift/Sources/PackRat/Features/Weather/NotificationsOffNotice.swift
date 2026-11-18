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
    /// nothing to miss, and only once notifications are known to be refused.
    nonisolated static func showsNotice(status: UNAuthorizationStatus?, alertsOn: Bool) -> Bool {
        alertsOn && status == .denied
    }

    func showsNotice(alertsOn: Bool) -> Bool {
        Self.showsNotice(status: status, alertsOn: alertsOn)
    }
}

/// Says trip alerts can't arrive while notifications are off for PackRat, with
/// the way to turn them back on. Product behaviour: docs/features/weather-alerts.md.
struct NotificationsOffNotice: View {
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
                Button("Open Settings") {
                    SentrySDK.addBreadcrumb(Self.openedSettingsCrumb)
                    if let settingsURL { openURL(settingsURL) }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .accessibilityIdentifier("notifications_off_notice_settings")
            }
            Spacer(minLength: 0)
        }
    }

    private static var openedSettingsCrumb: Breadcrumb {
        let crumb = Breadcrumb(level: .info, category: "notifications")
        crumb.message = "Opened notification settings from the notifications-off notice"
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
    }
}
