import SwiftUI
import SwiftData
#if os(macOS)
import AppKit
#endif

@main
struct PackRatApp: App {
    /// Scene id of the primary `WindowGroup`, so the macOS menu commands can
    /// reopen it via `openWindow(id:)` after the last window is closed.
    static let mainWindowSceneID = "main"

    @State private var authManager = AuthManager()
    #if os(macOS)
    @NSApplicationDelegateAdaptor(PackRatMacAppDelegate.self) private var appDelegate
    #endif

    init() {
        // Telemetry has to start before any view is mounted so launch-time
        // errors are captured. A missing DSN silently disables the SDK.
        SentryConfig.start()

        // RevenueCat is configured from AuthGateView, not here: iOS prewarms
        // apps in the background, and configuring during launch would create a
        // RevenueCat user record for a launch no person ever saw.

        #if os(macOS)
        if ProcessInfo.processInfo.arguments.contains("--reset-auth") {
            UserDefaults.standard.set(true, forKey: "ApplePersistenceIgnoreState")
            UserDefaults.standard.set(false, forKey: "NSQuitAlwaysKeepsWindows")
        }
        #endif
    }

    var body: some Scene {
        // Identified so `openWindow(id:)` from the File/Window menu commands can
        // reopen it after the user closes the last main window (guideline 4).
        WindowGroup(id: PackRatApp.mainWindowSceneID) {
            AuthGateView()
                .environment(authManager)
                .flushesPendingWrites()
                // Only on the main window. The auxiliary Pack/Trip windows on
                // macOS read the same shared stores, so attaching there too
                // would refetch once per open window on every resume.
                .refreshesFeatureStatesOnForeground()
                .providesWeightUnitPreference()
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
                .environment(authManager)
                .providesWeightUnitPreference()
        }

        // These windows host the same detail views as the main window, so they
        // can queue writes on their own. Flush from here too — a standalone
        // window may be the only one the user has open.
        WindowGroup("Pack", id: "pack", for: String.self) { $packId in
            if let id = packId {
                PackWindowView(packId: id)
                    .environment(authManager)
                    .flushesPendingWrites()
                    .providesWeightUnitPreference()
            }
        }
        .modelContainer(PersistenceController.shared.container)
        .defaultSize(width: 800, height: 600)

        WindowGroup("Trip", id: "trip", for: String.self) { $tripId in
            if let id = tripId {
                TripWindowView(tripId: id)
                    .environment(authManager)
                    .flushesPendingWrites()
                    .providesWeightUnitPreference()
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
                Self.openMainWindow()
            }
        }
    }

    /// Clicking the Dock icon with no windows open has to bring the main window
    /// back — the other half of guideline 4's "no way to reopen it" finding.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag {
            Self.openMainWindow()
        }
        return true
    }

    /// SwiftUI installs a responder for `newWindow:` for each `WindowGroup`, so
    /// sending it up the chain reopens the main scene. Falls back to un-minimising
    /// / re-showing an existing window if one is somehow still around.
    static func openMainWindow() {
        if NSApp.sendAction(Selector(("newWindow:")), to: nil, from: nil) { return }
        NSApp.windows.first?.makeKeyAndOrderFront(nil)
    }
}
#endif
