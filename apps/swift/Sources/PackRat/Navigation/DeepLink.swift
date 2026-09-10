import Foundation

/// Parsed `packrat://` URL.
///
/// Centralises deep-link parsing so the scheme handler, tests, and future
/// universal-link integration share one source of truth. Routing the parsed
/// link into navigation state is a separate concern — `AuthGateView` just
/// hands the URL to `DeepLink.parse(_:)` and logs (for now) until product
/// signals which destinations matter most.
///
/// The Expo (Android) client parses the same `packrat://` scheme, so any
/// case added here has a counterpart there — see `docs/parity.md`.
/// Keep the case names aligned across both clients so a link that works on
/// one is not silently inert on the other.
public enum DeepLink: Equatable {
    case home
    case pack(id: String)
    case trip(id: String)
    case feed
    case weather
    case unknown(URL)

    public static let scheme = "packrat"

    public static func parse(_ url: URL) -> DeepLink {
        guard url.scheme == scheme else { return .unknown(url) }
        let pathSegments = url.pathComponents.filter { $0 != "/" }
        switch url.host {
        case nil, "", "home":
            return .home
        case "pack":
            if let id = pathSegments.first, !id.isEmpty { return .pack(id: id) }
            return .unknown(url)
        case "trip":
            if let id = pathSegments.first, !id.isEmpty { return .trip(id: id) }
            return .unknown(url)
        case "feed":
            return .feed
        case "weather":
            return .weather
        default:
            return .unknown(url)
        }
    }
}
