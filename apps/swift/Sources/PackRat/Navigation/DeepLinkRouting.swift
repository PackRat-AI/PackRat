import Foundation

@MainActor
extension AppState {
    @discardableResult
    func apply(_ deepLink: DeepLink) -> Bool {
        switch deepLink {
        case .home:
            navItem = .home
            return true
        case .pack(let id):
            navItem = .packs
            selectedPackId = id
            return true
        case .trip(let id):
            guard NavItem.trips.isFeatureEnabled else { return false }
            navItem = .trips
            selectedTripId = id
            return true
        case .feed:
            guard NavItem.feed.isFeatureEnabled else { return false }
            navItem = .feed
            return true
        case .weather:
            navItem = .weather
            return true
        case .unknown:
            return false
        }
    }
}
