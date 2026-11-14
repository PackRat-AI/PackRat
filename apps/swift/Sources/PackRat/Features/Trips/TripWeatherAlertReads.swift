import Foundation
import Observation

/// Which destination alerts the user has seen on each trip, so the trip list
/// marks only an alert that arrived since they last opened the trip. Same
/// unread rule as a saved location's card (docs/features/weather-alerts.md
/// ADR-010), keyed by trip.
@MainActor
@Observable
final class TripWeatherAlertReads {
    static let shared = TripWeatherAlertReads()

    private(set) var seen: [String: Set<String>] = [:]
    private let defaults: UserDefaults
    private let key = "tripWeatherSeenAlertIds"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let data = defaults.data(forKey: key),
           let stored = try? JSONDecoder().decode([String: Set<String>].self, from: data) {
            seen = stored
        }
    }

    /// True when the trip carries an alert the user hasn't seen on it yet.
    func hasUnread(tripId: String, alertIds: [String]) -> Bool {
        let seenIds = seen[tripId] ?? []
        return alertIds.contains { !seenIds.contains($0) }
    }

    /// Records every alert now shown on the trip as seen.
    func markSeen(tripId: String, alertIds: [String]) {
        let ids = Set(alertIds)
        guard !ids.isEmpty, !ids.isSubset(of: seen[tripId] ?? []) else { return }
        seen[tripId, default: []].formUnion(ids)
        if let data = try? JSONEncoder().encode(seen) {
            defaults.set(data, forKey: key)
        }
    }
}
