import SwiftUI

struct ErrorView: View {
    let message: String
    let retry: (() async -> Void)?

    init(_ message: String, retry: (() async -> Void)? = nil) {
        self.message = message
        self.retry = retry
    }

    var body: some View {
        let presentation = FriendlyErrorPresentation(message)

        ContentUnavailableView {
            Label(presentation.title, systemImage: presentation.systemImage)
        } description: {
            Text(presentation.description)
        } actions: {
            if let retry, presentation.allowsRetry {
                AsyncButton("Try Again", action: retry)
                    .buttonStyle(.borderedProminent)
            }
        }
    }
}

struct InlineErrorView: View {
    let message: String

    var body: some View {
        let presentation = FriendlyErrorPresentation(message)

        HStack(spacing: 6) {
            Image(systemName: presentation.inlineSystemImage)
                .foregroundStyle(presentation.inlineColor)
            Text(presentation.description)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(presentation.inlineColor.opacity(0.08), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .accessibilityIdentifier("inline_error")
    }
}

struct FriendlyErrorPresentation {
    let title: String
    let description: String
    let systemImage: String
    let inlineSystemImage: String
    let inlineColor: Color
    let allowsRetry: Bool

    init(_ rawMessage: String) {
        let normalized = rawMessage.lowercased()

        if normalized.contains("401")
            || normalized.contains("unauthorized")
            || normalized.contains("forbidden")
            || normalized.contains("not authenticated")
            || normalized.contains("requires auth")
            || normalized.contains("session")
            || normalized.contains("token") {
            title = "Sign In Required"
            description = "This feature syncs with your PackRat account. Local packs and trips still work in guest mode."
            systemImage = "person.crop.circle.badge.exclamationmark"
            inlineSystemImage = "person.crop.circle.badge.exclamationmark"
            inlineColor = .orange
            allowsRetry = false
        } else if normalized.contains("offline")
            || normalized.contains("network")
            || normalized.contains("internet")
            || normalized.contains("not connected")
            || normalized.contains("timed out")
            || normalized.contains("cannot connect")
            || normalized.contains("could not connect") {
            title = "Connection Needed"
            description = "Connect to the internet to refresh this content. Cached and local data remain available."
            systemImage = "wifi.exclamationmark"
            inlineSystemImage = "wifi.exclamationmark"
            inlineColor = .orange
            allowsRetry = true
        } else if normalized.contains("404")
            || normalized.contains("not found") {
            title = "Not Found"
            description = "This item is no longer available."
            systemImage = "questionmark.folder"
            inlineSystemImage = "questionmark.circle.fill"
            inlineColor = .orange
            allowsRetry = false
        } else {
            title = "Temporarily Unavailable"
            description = "This content could not be loaded right now."
            systemImage = "exclamationmark.triangle"
            inlineSystemImage = "exclamationmark.circle.fill"
            inlineColor = .red
            allowsRetry = true
        }
    }
}
