import SwiftUI

@main
struct PackRatApp: App {
    @State private var authManager = AuthManager()

    var body: some Scene {
        WindowGroup {
            AuthGateView()
                .environment(authManager)
        }
        #if os(macOS)
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified(showsTitle: true))
        .defaultSize(width: 1100, height: 720)
        .commands {
            CommandGroup(replacing: .newItem) {}
            CommandGroup(after: .appInfo) {
                Divider()
                Button("Sign Out") {
                    Task { try? await authManager.logout() }
                }
                .disabled(!authManager.isAuthenticated)
            }
        }
        #endif
    }
}
