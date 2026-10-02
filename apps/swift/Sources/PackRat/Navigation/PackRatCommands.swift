import SwiftUI

// Menu-bar commands are a macOS concept; `.windowList` in particular does not
// exist on iOS. The focused-value keys below are shared by both platforms and
// stay outside the guard.
#if os(macOS)
struct PackRatCommands: Commands {
    let authManager: AuthManager

    @Environment(\.openWindow) private var openWindow

    // Bool bindings avoid recreating function closures on every render,
    // which caused "FocusedValue update tried to update multiple times per frame."
    @FocusedBinding(\.newPackAction) private var showingNewPack: Bool?
    @FocusedBinding(\.newTripAction) private var showingNewTrip: Bool?
    @FocusedBinding(\.refreshAction) private var needsRefresh: Bool?
    @FocusedBinding(\.sharePackAction) private var triggerShare: Bool?
    @FocusedBinding(\.globalSearchAction) private var showingSearch: Bool?

    var body: some Commands {
        // Guideline 4 — replacing `.newItem` wholesale removed AppKit's default
        // "New Window", leaving no way to reopen the app after closing its last
        // window. Put an explicit one back at the top of the File menu.
        CommandGroup(replacing: .newItem) {
            Button("New Window") { openWindow(id: PackRatApp.mainWindowSceneID) }
                .keyboardShortcut("n", modifiers: [.command, .option])

            Divider()

            Button("New Pack") { showingNewPack = true }
                .keyboardShortcut("n", modifiers: .command)
                .disabled(showingNewPack == nil)

            Button("New Trip") { showingNewTrip = true }
                .keyboardShortcut("n", modifiers: [.command, .shift])
                .disabled(showingNewTrip == nil)
        }

        CommandGroup(before: .toolbar) {
            Button("Search…") { showingSearch = true }
                .keyboardShortcut("f", modifiers: .command)
        }

        CommandGroup(replacing: .saveItem) {
            Button("Refresh") { needsRefresh = true }
                .keyboardShortcut("r", modifiers: .command)
                .disabled(needsRefresh == nil)

            Button("Share Pack…") { triggerShare = true }
                .keyboardShortcut("s", modifiers: [.command, .shift])
                .disabled(triggerShare == nil)
        }

        // Also surface it under Window, which is where macOS users look for a
        // closed main window.
        CommandGroup(after: .windowList) {
            Divider()
            Button("PackRat") { openWindow(id: PackRatApp.mainWindowSceneID) }
        }

        CommandGroup(after: .appInfo) {
            Divider()
            Button("Sign Out", role: .destructive) {
                Task { try? await authManager.logout() }
            }
            .disabled(!authManager.isAuthenticated)
        }
    }
}

#endif

// MARK: - Focused Value Keys
// @FocusedBinding requires Value = Binding<T> so SwiftUI compares the wrapped
// Bool (not the Binding reference) — prevents per-frame update spurious triggers.

private struct NewPackActionKey: FocusedValueKey { typealias Value = Binding<Bool> }
private struct NewTripActionKey: FocusedValueKey { typealias Value = Binding<Bool> }
private struct RefreshActionKey: FocusedValueKey { typealias Value = Binding<Bool> }
private struct SharePackActionKey: FocusedValueKey { typealias Value = Binding<Bool> }
private struct GlobalSearchActionKey: FocusedValueKey { typealias Value = Binding<Bool> }

extension FocusedValues {
    var newPackAction: Binding<Bool>? {
        get { self[NewPackActionKey.self] }
        set { self[NewPackActionKey.self] = newValue }
    }
    var newTripAction: Binding<Bool>? {
        get { self[NewTripActionKey.self] }
        set { self[NewTripActionKey.self] = newValue }
    }
    var refreshAction: Binding<Bool>? {
        get { self[RefreshActionKey.self] }
        set { self[RefreshActionKey.self] = newValue }
    }
    var sharePackAction: Binding<Bool>? {
        get { self[SharePackActionKey.self] }
        set { self[SharePackActionKey.self] = newValue }
    }
    var globalSearchAction: Binding<Bool>? {
        get { self[GlobalSearchActionKey.self] }
        set { self[GlobalSearchActionKey.self] = newValue }
    }
}
