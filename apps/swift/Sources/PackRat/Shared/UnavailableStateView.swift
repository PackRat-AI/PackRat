import SwiftUI

struct UnavailableStateView<Actions: View>: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let minHeight: CGFloat
    let actions: Actions

    init(
        title: String,
        subtitle: String = "",
        systemImage: String,
        minHeight: CGFloat = 360,
        @ViewBuilder actions: () -> Actions = { EmptyView() }
    ) {
        self.title = title
        self.subtitle = subtitle
        self.systemImage = systemImage
        self.minHeight = minHeight
        self.actions = actions()
    }

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: systemImage)
                .symbolRenderingMode(.hierarchical)
        } description: {
            if !subtitle.isEmpty {
                Text(subtitle)
                    .multilineTextAlignment(.center)
            }
        } actions: {
            actions
        }
        .frame(maxWidth: .infinity, minHeight: minHeight)
        .frame(maxHeight: .infinity)
        .padding(.horizontal)
    }
}
