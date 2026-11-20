import SwiftUI
import UserNotifications
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

/// Tells the user a feature is held back by a permission they turned off, with
/// the one action that fixes it. Used inline wherever a denied permission would
/// otherwise make a feature stop working without a word.
struct PermissionNotice: View {
    let message: String
    var systemImage = "exclamationmark.triangle.fill"
    var settings: PermissionSettings.Page = .app

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(message, systemImage: systemImage)
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Button("Open Settings") { PermissionSettings.open(settings) }
                .font(.callout.weight(.semibold))
                .accessibilityIdentifier("permission_notice_open_settings")
        }
    }
}

enum PermissionSettings {
    /// Notifications have their own page for the app; location, the microphone
    /// and speech recognition are rows on the app's main settings page.
    enum Page {
        case app
        case notifications
    }

    static func open(_ page: Page = .app) {
        #if os(iOS)
        let string = page == .notifications
            ? UIApplication.openNotificationSettingsURLString
            : UIApplication.openSettingsURLString
        guard let url = URL(string: string) else { return }
        UIApplication.shared.open(url)
        #else
        // System Settings has no page per app: notifications open on this app's
        // row, everything else on Privacy & Security.
        let string = page == .notifications
            ? "x-apple.systempreferences:com.apple.Notifications-Settings.extension?id=\(Bundle.main.bundleIdentifier ?? "")"
            : "x-apple.systempreferences:com.apple.preference.security?Privacy"
        guard let url = URL(string: string) else { return }
        NSWorkspace.shared.open(url)
        #endif
    }

    /// True only once the user has said no; an unasked permission isn't off yet.
    static func notificationsDenied() async -> Bool {
        await UNUserNotificationCenter.current().notificationSettings().authorizationStatus == .denied
    }
}

extension View {
    /// Re-runs `refresh` on appear and whenever the app comes back to the
    /// foreground, which is where a user returns from changing a permission.
    func onPermissionChange(_ refresh: @escaping () async -> Void) -> some View {
        modifier(PermissionRefresh(refresh: refresh))
    }
}

private struct PermissionRefresh: ViewModifier {
    let refresh: () async -> Void
    @Environment(\.scenePhase) private var scenePhase

    func body(content: Content) -> some View {
        content
            .task { await refresh() }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active { Task { await refresh() } }
            }
    }
}

extension View {
    /// The alert shown right after an action whose result depends on
    /// notifications the user has turned off.
    func notificationsOffAlert(isPresented: Binding<Bool>, message: String) -> some View {
        alert("Notifications Are Off", isPresented: isPresented) {
            Button("Open Settings") { PermissionSettings.open(.notifications) }
            Button("Not Now", role: .cancel) {}
        } message: {
            Text(message)
        }
    }
}
