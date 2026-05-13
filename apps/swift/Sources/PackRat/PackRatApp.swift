import SwiftUI
import SwiftData
#if os(macOS)
import AppKit
#endif

@main
struct PackRatApp: App {
    @State private var authManager = AuthManager()
    #if os(macOS)
    @NSApplicationDelegateAdaptor(PackRatMacAppDelegate.self) private var appDelegate
    #endif

    init() {
        #if os(macOS)
        if ProcessInfo.processInfo.arguments.contains("--reset-auth") {
            UserDefaults.standard.set(true, forKey: "ApplePersistenceIgnoreState")
            UserDefaults.standard.set(false, forKey: "NSQuitAlwaysKeepsWindows")
        }
        #endif
    }

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

#if os(macOS)
final class PackRatMacAppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        guard ProcessInfo.processInfo.arguments.contains("--reset-auth") else { return }

        NSApp.setActivationPolicy(.regular)
        DispatchQueue.main.async {
            NSApp.unhide(nil)
            NSApp.activate(ignoringOtherApps: true)
            if NSApp.windows.isEmpty {
                NSApp.sendAction(Selector(("newWindow:")), to: nil, from: nil)
            }
        }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag {
            NSApp.sendAction(Selector(("newWindow:")), to: nil, from: nil)
        }
        return true
    }
}
#endif
