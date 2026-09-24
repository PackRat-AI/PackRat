import Foundation
import SwiftData

/// Local cache of "last known alert state" per watched location, so the bell
/// badge can reflect an alert learned via push before the user opens that
/// location's forecast — `WeatherView`'s `activeAlerts` is otherwise derived
/// only from the currently-viewed location's live fetch.
///
/// Resolution is read from `expires`, not a server push: see
/// docs/features/weather-alerts.md ADR-004 — no second notification is ever
/// sent when a hazard clears, so the client has to infer it locally.
@Model
final class CachedWeatherAlertState {
    @Attribute(.unique) var weatherLocationId: Int
    var locationName: String
    var hasActiveAlert: Bool
    /// Latest `expires` timestamp among the active alerts, used to
    /// self-clear `hasActiveAlert` locally once every alert has lapsed
    /// without waiting for the next push or the next poll.
    var latestExpiresAt: Date?
    var updatedAt: Date

    init(weatherLocationId: Int, locationName: String, hasActiveAlert: Bool, latestExpiresAt: Date?) {
        self.weatherLocationId = weatherLocationId
        self.locationName = locationName
        self.hasActiveAlert = hasActiveAlert
        self.latestExpiresAt = latestExpiresAt
        self.updatedAt = Date()
    }

    /// True if this cached "active" state should still be trusted — false
    /// once every known alert's expiry has passed, so a stale row doesn't
    /// keep the bell lit forever if a push was somehow missed.
    var isStillActive: Bool {
        guard hasActiveAlert else { return false }
        guard let latestExpiresAt else { return true }
        return latestExpiresAt > Date()
    }
}
