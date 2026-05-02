import SwiftUI
import SwiftData

@main
struct PackRatApp: App {
    @State private var authManager = AuthManager()

    var body: some Scene {
        WindowGroup {
            AuthGateView()
                .environment(authManager)
        }
        .modelContainer(PersistenceController.shared.container)
        #if os(macOS)
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified(showsTitle: true))
        .defaultSize(width: 1100, height: 720)
        .commands {
            PackRatCommands(authManager: authManager)
        }
        #endif

        #if os(macOS)
        Settings {
            PreferencesView()
        }
        #endif
    }
}
