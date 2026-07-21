import SwiftUI
import NukeUI

/// Drop-in async image loader backed by Nuke with fade-in and placeholder.
struct RemoteImage<Placeholder: View>: View {
    let url: String?
    var contentMode: ContentMode = .fill
    var cornerRadius: CGFloat = 0
    var placeholder: () -> Placeholder

    init(url: String?, contentMode: ContentMode = .fill, cornerRadius: CGFloat = 0,
         @ViewBuilder placeholder: @escaping () -> Placeholder) {
        self.url = url
        self.contentMode = contentMode
        self.cornerRadius = cornerRadius
        self.placeholder = placeholder
    }

    var body: some View {
        if let imageURL = APIClient.resolvedImageURL(url) {
            LazyImage(url: imageURL) { state in
                if let image = state.image {
                    image
                        .resizable()
                        .aspectRatio(contentMode: contentMode)
                        .transition(.opacity)
                } else if state.error != nil {
                    placeholder()
                } else {
                    placeholder()
                        .overlay(ProgressView().controlSize(.small))
                }
            }
            .animation(.easeIn(duration: 0.2), value: true)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        } else {
            placeholder()
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        }
    }
}

private var defaultPlaceholder: some View {
    Rectangle().fill(.fill.secondary)
}

// MARK: - Avatar

struct AvatarView: View {
    let url: String?
    let fallbackText: String
    var size: CGFloat = 36

    var body: some View {
        RemoteImage(url: url, contentMode: .fill, cornerRadius: size / 2) {
            Circle()
                .fill(.tint.opacity(0.12))
                .overlay {
                    Text(fallbackText.prefix(2).uppercased())
                        .font(.system(size: size * 0.35, weight: .bold))
                        .foregroundStyle(.tint)
                }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }
}
