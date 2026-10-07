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
    /// Opens straight to a watched location's alert detail — used by the
    /// weather-alert push notification's tap handler. Swift/iOS-only for
    /// now: proactive weather monitoring has no Android counterpart yet
    /// (see docs/features/weather-alerts.md), so this case has no Expo
    /// parity to keep in sync with until that work starts.
    case weatherAlert(weatherLocationId: Int)
    /// A feed post by id — `packrat://post/<id>`, and the tap handler for
    /// tag, comment and reply notifications.
    case post(id: Int)
    /// A shared post link — `https://packratai.com/p/<publicId>` (universal
    /// link) or `packrat://p/<publicId>`.
    case sharedPost(publicId: String)
    case unknown(URL)

    public static let scheme = "packrat"
    public static let webHosts: Set<String> = ["packratai.com", "www.packratai.com"]

    public static func parse(_ url: URL) -> DeepLink {
        let pathSegments = url.pathComponents.filter { $0 != "/" }
        if url.scheme == "https" || url.scheme == "http" {
            guard let host = url.host?.lowercased(), webHosts.contains(host),
                  pathSegments.count == 2, pathSegments[0] == "p", !pathSegments[1].isEmpty
            else { return .unknown(url) }
            return .sharedPost(publicId: pathSegments[1])
        }
        guard url.scheme == scheme else { return .unknown(url) }
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
            if let idString = pathSegments.first, let id = Int(idString) {
                return .weatherAlert(weatherLocationId: id)
            }
            return .weather
        case "post":
            if let idString = pathSegments.first, let id = Int(idString) { return .post(id: id) }
            return .unknown(url)
        case "p":
            if let publicId = pathSegments.first, !publicId.isEmpty { return .sharedPost(publicId: publicId) }
            return .unknown(url)
        default:
            return .unknown(url)
        }
    }
}
