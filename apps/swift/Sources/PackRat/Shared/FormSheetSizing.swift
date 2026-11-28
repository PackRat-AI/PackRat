import SwiftUI

extension View {
    @ViewBuilder
    func formSheetSize(minWidth: CGFloat = 520, idealWidth: CGFloat? = nil, minHeight: CGFloat = 520, idealHeight: CGFloat? = nil) -> some View {
        #if os(macOS)
        let macWidth = max(minWidth, 540)
        // A sheet taller than the screen pushes its Create/Submit toolbar
        // under the Dock, out of reach. Cap it to the visible screen, less
        // room for the parent window's title bar, and let the form scroll.
        let screenHeight = NSScreen.main?.visibleFrame.height ?? .infinity
        let macHeight = min(max(minHeight, 560), screenHeight - 120)
        self.frame(
            minWidth: macWidth,
            idealWidth: idealWidth ?? macWidth,
            minHeight: macHeight,
            idealHeight: min(idealHeight ?? macHeight, screenHeight - 120)
        )
        #else
        self
        #endif
    }

    @ViewBuilder
    func packRatFormStyle() -> some View {
        #if os(macOS)
        self
            .formStyle(.grouped)
            .controlSize(.regular)
        #else
        self.formStyle(.grouped)
        #endif
    }
}

extension View {
    /// A Mac form puts a field's title beside it and its text on the trailing
    /// edge, which reads wrong for multi-line text. Hide the title there so the
    /// text fills the row from the leading edge; pass a `prompt` so the field
    /// still says what it's for.
    @ViewBuilder
    func formMultilineField() -> some View {
        #if os(macOS)
        self.labelsHidden()
        #else
        self
        #endif
    }
}
