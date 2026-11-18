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
