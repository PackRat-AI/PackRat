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
        .commands {
            CommandGroup(replacing: .newItem) {}
            CommandGroup(after: .appInfo) {
                Button("Sign Out") {
                    Task { try? await authManager.logout() }
                }
                .disabled(!authManager.isAuthenticated)
            }
        }
        #endif
    }
}
