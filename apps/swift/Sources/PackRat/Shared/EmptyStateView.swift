import SwiftUI

struct EmptyStateView: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let action: (() -> Void)?
    let actionLabel: String
    let accessibilityIdentifier: String?

    init(
        _ title: String,
        subtitle: String = "",
        systemImage: String = "tray",
        actionLabel: String = "Create New",
        accessibilityIdentifier: String? = nil,
        action: (() -> Void)? = nil
    ) {
        self.title = title
        self.subtitle = subtitle
        self.systemImage = systemImage
        self.action = action
        self.actionLabel = actionLabel
        self.accessibilityIdentifier = accessibilityIdentifier
    }

    var body: some View {
        UnavailableStateView(
            title: title,
            subtitle: subtitle,
            systemImage: systemImage,
            accessibilityIdentifier: accessibilityIdentifier
        ) {
            if let action {
                Button(actionLabel, action: action)
                    .buttonStyle(.borderedProminent)
            }
        }
    }
}
