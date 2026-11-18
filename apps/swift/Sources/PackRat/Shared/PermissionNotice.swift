import SwiftUI
#if os(iOS)
import UIKit
import UserNotifications

/// Tells the user a feature is held back by a permission they turned off, with
/// the one action that fixes it. Used inline wherever a denied permission would
/// otherwise make a feature stop working without a word.
struct PermissionNotice: View {
    let message: String
    var systemImage = "exclamationmark.triangle.fill"

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(message, systemImage: systemImage)
                .font(.callout)
                .foregroundStyle(.secondary)
            Button("Open Settings") { PermissionSettings.open() }
                .font(.callout.weight(.semibold))
                .accessibilityIdentifier("permission_notice_open_settings")
        }
    }
}

enum PermissionSettings {
    static func open() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
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
#endif

extension View {
    /// The alert shown right after an action whose result depends on
    /// notifications the user has turned off. iOS only: macOS never reports
    /// notifications as off to its callers.
    @ViewBuilder
    func notificationsOffAlert(isPresented: Binding<Bool>, message: String) -> some View {
        #if os(iOS)
        alert("Notifications Are Off", isPresented: isPresented) {
            Button("Open Settings") { PermissionSettings.open() }
            Button("Not Now", role: .cancel) {}
        } message: {
            Text(message)
        }
        #else
        self
        #endif
    }
}
