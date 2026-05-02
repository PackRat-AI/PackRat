import SwiftUI

struct PackRatCommands: Commands {
    let authManager: AuthManager

    // Focused values let commands reach into the active view's handlers
    @FocusedValue(\.newPackAction) private var newPack
    @FocusedValue(\.newTripAction) private var newTrip
    @FocusedValue(\.refreshAction) private var refresh
    @FocusedValue(\.sharePackAction) private var sharePack

    var body: some Commands {
        // Replace default File menu
        CommandGroup(replacing: .newItem) {
            Button("New Pack") { newPack?() }
                .keyboardShortcut("n", modifiers: .command)
                .disabled(newPack == nil)

            Button("New Trip") { newTrip?() }
                .keyboardShortcut("n", modifiers: [.command, .shift])
                .disabled(newTrip == nil)
        }

        CommandGroup(replacing: .saveItem) {
            Button("Refresh") { Task { refresh?() } }
                .keyboardShortcut("r", modifiers: .command)
                .disabled(refresh == nil)

            Button("Share Pack…") { sharePack?() }
                .keyboardShortcut("s", modifiers: [.command, .shift])
                .disabled(sharePack == nil)
        }

        CommandGroup(after: .appInfo) {
            Divider()
            Button("Sign Out") {
                Task { try? await authManager.logout() }
            }
            .disabled(!authManager.isAuthenticated)
        }
    }
}

// MARK: - Focused Value Keys

private struct NewPackActionKey: FocusedValueKey {
    typealias Value = () -> Void
}

private struct NewTripActionKey: FocusedValueKey {
    typealias Value = () -> Void
}

private struct RefreshActionKey: FocusedValueKey {
    typealias Value = () -> Void
}

private struct SharePackActionKey: FocusedValueKey {
    typealias Value = () -> Void
}

extension FocusedValues {
    var newPackAction: (() -> Void)? {
        get { self[NewPackActionKey.self] }
        set { self[NewPackActionKey.self] = newValue }
    }
    var newTripAction: (() -> Void)? {
        get { self[NewTripActionKey.self] }
        set { self[NewTripActionKey.self] = newValue }
    }
    var refreshAction: (() -> Void)? {
        get { self[RefreshActionKey.self] }
        set { self[RefreshActionKey.self] = newValue }
    }
    var sharePackAction: (() -> Void)? {
        get { self[SharePackActionKey.self] }
        set { self[SharePackActionKey.self] = newValue }
    }
}
