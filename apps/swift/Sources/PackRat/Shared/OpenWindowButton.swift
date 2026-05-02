#if os(macOS)
import SwiftUI

struct OpenWindowButton: View {
    let id: String
    let value: String
    let label: String

    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Button(label, systemImage: "rectangle.on.rectangle") {
            openWindow(id: id, value: value)
        }
    }
}
#endif
