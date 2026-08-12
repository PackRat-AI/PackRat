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
            Text(presentation.inlineDescription(forRawMessage: message))
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
    let message: String?
    let retry: (() async -> Void)?

    /// - Parameter message: Overrides the generic "connect to refresh" copy for
    ///   features that are wholly unavailable offline rather than merely stale.
    init(message: String? = nil, retry: (() async -> Void)? = nil) {
        self.message = message
        self.retry = retry
    }

    var body: some View {
        ErrorSurfaceView(
            presentation: message.map { .connectionNeeded.withDescription($0) } ?? .connectionNeeded,
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

    /// Inline copy for a raw error string.
    ///
    /// The keyword buckets above are meant for infrastructure failures, where a
    /// reassuring canned sentence beats a raw `NSURLErrorDomain` dump. But an
    /// actionable server message ("User already exists. Use another email.")
    /// matches no bucket and used to fall through to the generic
    /// `temporarilyUnavailable` copy — telling users the service was broken when
    /// they simply needed to pick a different email. Show those verbatim.
    func inlineDescription(forRawMessage rawMessage: String) -> String {
        guard isGenericFallback else { return description }

        let trimmed = rawMessage.trimmingCharacters(in: .whitespacesAndNewlines)
        return FriendlyErrorPresentation.isPresentableToUser(trimmed) ? trimmed : description
    }

    /// A copy of this presentation with different body copy, for callers that
    /// know exactly why a feature is unavailable ("scanning needs a connection")
    /// and can say something more useful than the generic bucket text.
    func withDescription(_ description: String) -> FriendlyErrorPresentation {
        FriendlyErrorPresentation(
            title: title,
            description: description,
            systemImage: systemImage,
            inlineSystemImage: inlineSystemImage,
            inlineColor: inlineColor,
            allowsRetry: allowsRetry,
            retryTitle: retryTitle,
            accessibilityIdentifier: accessibilityIdentifier
        )
    }

    /// Classifies a thrown error as a connectivity failure by *type* rather than
    /// by sniffing `localizedDescription`.
    ///
    /// The string matcher in `init(_:)` only works on English devices, and even
    /// there it misses the DNS/host failures that a real offline request tends to
    /// produce ("A server with the specified hostname could not be found."), which
    /// is how an airplane-mode request ended up reading "Temporarily Unavailable".
    static func isConnectivityError(_ error: Error) -> Bool {
        if let packRatError = error as? PackRatError, case .networkError = packRatError {
            return true
        }

        let offlineCodes: Set<URLError.Code> = [
            .notConnectedToInternet,
            .networkConnectionLost,
            .cannotFindHost,
            .cannotConnectToHost,
            .dnsLookupFailed,
            .timedOut,
            .internationalRoamingOff,
            .dataNotAllowed,
            .callIsActive,
            .secureConnectionFailed,
        ]

        if let urlError = error as? URLError, offlineCodes.contains(urlError.code) {
            return true
        }

        // `URLError` bridged through an intermediate `NSError` loses its Swift
        // type but keeps its domain and code.
        let nsError = error as NSError
        return nsError.domain == NSURLErrorDomain
            && offlineCodes.contains(URLError.Code(rawValue: nsError.code))
    }

    /// True when the keyword matcher found no specific bucket for the message.
    private var isGenericFallback: Bool {
        accessibilityIdentifier == FriendlyErrorPresentation.temporarilyUnavailable.accessibilityIdentifier
    }

    /// A message is safe to show verbatim when it reads like a sentence written
    /// for a person, rather than a decoding dump or an opaque error domain.
    private static func isPresentableToUser(_ message: String) -> Bool {
        guard !message.isEmpty, message.count <= 160 else { return false }

        let lowered = message.lowercased()
        let leakyMarkers = [
            "error domain",
            "codingkey",
            "debugdescription",
            "keynotfound",
            "typemismatch",
            "valuenotfound",
            "datacorrupted",
            "the operation couldn’t be completed",
            "the operation couldn't be completed",
            "<binary>",
            "{",
            "}",
        ]
        return !leakyMarkers.contains { lowered.contains($0) }
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
