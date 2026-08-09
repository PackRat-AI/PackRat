import SwiftUI

extension View {
    @ViewBuilder
    func formSheetSize(minWidth: CGFloat = 520, idealWidth: CGFloat? = nil, minHeight: CGFloat = 520, idealHeight: CGFloat? = nil) -> some View {
        #if os(macOS)
        let macWidth = max(minWidth, 540)
        let macHeight = max(minHeight, 560)
        self.frame(
            minWidth: macWidth,
            idealWidth: idealWidth ?? macWidth,
            minHeight: macHeight,
            idealHeight: idealHeight ?? macHeight
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
