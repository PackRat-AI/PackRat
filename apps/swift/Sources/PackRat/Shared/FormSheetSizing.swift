import SwiftUI

extension View {
    @ViewBuilder
    func formSheetSize(minWidth: CGFloat = 520, idealWidth: CGFloat? = nil, minHeight: CGFloat = 520, idealHeight: CGFloat? = nil) -> some View {
        #if os(macOS)
        self.frame(
            minWidth: minWidth,
            idealWidth: idealWidth ?? minWidth,
            minHeight: minHeight,
            idealHeight: idealHeight ?? minHeight
        )
        #else
        self
        #endif
    }

    @ViewBuilder
    func packRatFormStyle() -> some View {
        self.formStyle(.grouped)
    }
}
