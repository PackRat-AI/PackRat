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

        ErrorSurfaceView(presentation: presentation, retry: retry)
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

struct GuestLimitedView: View {
    @Environment(AuthManager.self) private var authManager

    let title: String
    let subtitle: String
    let systemImage: String
    let actionTitle: String

    init(
        _ title: String,
        subtitle: String,
        systemImage: String = "person.crop.circle.badge.plus",
        actionTitle: String = "Sign In or Create Account"
    ) {
        self.title = title
        self.subtitle = subtitle
        self.systemImage = systemImage
        self.actionTitle = actionTitle
    }

    var body: some View {
        GeometryReader { proxy in
            if proxy.size.width < 260 {
                compactContent
            } else {
                UnavailableStateView(
                    title: title,
                    subtitle: subtitle,
                    systemImage: systemImage
                ) {
                    signInButton
                }
            }
        }
        .accessibilityIdentifier("guest_limited_state")
    }

    private var compactContent: some View {
        VStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.title2)
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)

            VStack(spacing: 4) {
                Text(title)
                    .font(.callout.weight(.semibold))
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
                    .minimumScaleFactor(0.82)

                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(4)
                    .minimumScaleFactor(0.86)
            }

            signInButton
                .controlSize(.small)
        }
        .padding(.horizontal, 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private var signInButton: some View {
        if authManager.isGuest {
            Button(actionTitle) {
                authManager.signOut()
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("guest_limited_sign_in")
        }
    }
}

struct ConnectionUnavailableView: View {
    let retry: (() async -> Void)?

    init(retry: (() async -> Void)? = nil) {
        self.retry = retry
    }

    var body: some View {
        ErrorSurfaceView(
            presentation: .connectionNeeded,
            retry: retry
        )
    }
}

private struct ErrorSurfaceView: View {
    let presentation: FriendlyErrorPresentation
    let retry: (() async -> Void)?

    var body: some View {
        UnavailableStateView(
            title: presentation.title,
            subtitle: presentation.description,
            systemImage: presentation.systemImage,
            accessibilityIdentifier: presentation.accessibilityIdentifier
        ) {
            if let retry, presentation.allowsRetry {
                AsyncButton(presentation.retryTitle, action: retry)
                    .buttonStyle(.borderedProminent)
            }
        }
        .accessibilityIdentifier(presentation.accessibilityIdentifier)
    }
}

struct FriendlyErrorPresentation {
    let title: String
    let description: String
    let systemImage: String
    let inlineSystemImage: String
    let inlineColor: Color
    let allowsRetry: Bool
    let retryTitle: String
    let accessibilityIdentifier: String

    init(_ rawMessage: String) {
        let normalized = rawMessage.lowercased()

        if normalized.contains("401")
            || normalized.contains("unauthorized")
            || normalized.contains("forbidden")
            || normalized.contains("not authenticated")
            || normalized.contains("requires auth")
            || normalized.contains("session")
            || normalized.contains("token") {
            self = .accountRequired
        } else if normalized.contains("offline")
            || normalized.contains("internet")
            || normalized.contains("not connected")
            || normalized.contains("connection appears")
            || normalized.contains("connection was lost")
            || normalized.contains("timed out")
            || normalized.contains("cannot connect")
            || normalized.contains("could not connect")
            || normalized.contains("urlerror")
            || normalized.contains("nsurlerrordomain") {
            self = .connectionNeeded
        } else if normalized.contains("404")
            || normalized.contains("not found") {
            self = .notFound
        } else {
            self = .temporarilyUnavailable
        }
    }

    private init(
        title: String,
        description: String,
        systemImage: String,
        inlineSystemImage: String,
        inlineColor: Color,
        allowsRetry: Bool,
        retryTitle: String = "Try Again",
        accessibilityIdentifier: String
    ) {
        self.title = title
        self.description = description
        self.systemImage = systemImage
        self.inlineSystemImage = inlineSystemImage
        self.inlineColor = inlineColor
        self.allowsRetry = allowsRetry
        self.retryTitle = retryTitle
        self.accessibilityIdentifier = accessibilityIdentifier
    }

    static let accountRequired = FriendlyErrorPresentation(
        title: "Sign In Required",
        description: "This feature syncs with your PackRat account. Local packs and trips still work in guest mode.",
        systemImage: "person.crop.circle.badge.exclamationmark",
        inlineSystemImage: "person.crop.circle.badge.exclamationmark",
        inlineColor: .orange,
        allowsRetry: false,
        accessibilityIdentifier: "account_required_error_state"
    )

    static let connectionNeeded = FriendlyErrorPresentation(
        title: "Connection Needed",
        description: "Connect to the internet to refresh this content. Cached and local data remain available.",
        systemImage: "wifi.exclamationmark",
        inlineSystemImage: "wifi.exclamationmark",
        inlineColor: .orange,
        allowsRetry: true,
        accessibilityIdentifier: "connection_needed_state"
    )

    static let notFound = FriendlyErrorPresentation(
        title: "Not Found",
        description: "This item is no longer available.",
        systemImage: "questionmark.folder",
        inlineSystemImage: "questionmark.circle.fill",
        inlineColor: .orange,
        allowsRetry: false,
        accessibilityIdentifier: "not_found_state"
    )

    static let temporarilyUnavailable = FriendlyErrorPresentation(
        title: "Temporarily Unavailable",
        description: "This content could not be loaded right now.",
        systemImage: "exclamationmark.triangle",
        inlineSystemImage: "exclamationmark.circle.fill",
        inlineColor: .red,
        allowsRetry: true,
        accessibilityIdentifier: "temporary_error_state"
    )
}
