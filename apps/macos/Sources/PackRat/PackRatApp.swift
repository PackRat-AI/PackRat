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

        WindowGroup("Pack", id: "pack", for: String.self) { $packId in
            if let id = packId {
                PackWindowView(packId: id)
                    .environment(authManager)
            }
        }
        .modelContainer(PersistenceController.shared.container)
        .defaultSize(width: 800, height: 600)

        WindowGroup("Trip", id: "trip", for: String.self) { $tripId in
            if let id = tripId {
                TripWindowView(tripId: id)
                    .environment(authManager)
            }
        }
        .modelContainer(PersistenceController.shared.container)
        .defaultSize(width: 800, height: 600)
        #endif
    }
}
