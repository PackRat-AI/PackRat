import SwiftUI

/// Keyboard dismissal helpers.
///
/// Text fields declared with `axis: .vertical` (multi-line) treat Return as
/// "insert a newline", so they never fire `onSubmit` and the software keyboard
/// has no built-in way to close. On iOS that leaves the keyboard covering the
/// screen with no escape. These helpers add the missing affordances.
///
/// macOS has no software keyboard, so every helper compiles down to `self`
/// there — matching the `#if os(macOS)` convention in `FormSheetSizing.swift`.
extension View {
    /// Adds a keyboard accessory toolbar with a trailing "Done" button that
    /// resigns focus. Attach to a view that owns a `@FocusState` binding.
    ///
    /// - Parameter isFocused: The focus binding to clear when Done is tapped.
    @ViewBuilder
    func keyboardDoneButton(isFocused: FocusState<Bool>.Binding) -> some View {
        #if os(macOS)
        self
        #else
        self.toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { isFocused.wrappedValue = false }
                    .fontWeight(.semibold)
                    .accessibilityIdentifier("keyboard_done")
            }
        }
        #endif
    }

    /// Dismisses the keyboard when a scrollable container is dragged.
    /// No-op on macOS, where there is no software keyboard to dismiss.
    @ViewBuilder
    func dismissesKeyboardOnScroll() -> some View {
        #if os(macOS)
        self
        #else
        self.scrollDismissesKeyboard(.interactively)
        #endif
    }
}
