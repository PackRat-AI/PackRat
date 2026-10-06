import Foundation
import Observation
import Sentry

/// Fetches and keeps the destination forecast for upcoming trips. The last
/// result is persisted so the readiness summary and reminders still have "the
/// latest the app has" with no signal. New weather alerts at the destination
/// arrive as a server push (`pollTripDestinations`), not from here.
@Observable
@MainActor
final class TripConditionsStore {
    static let shared = TripConditionsStore()

    /// Forecasts reach 10 days out; there is nothing to fetch before that.
    static let forecastHorizonDays = 10
    /// A forecast younger than this is reused rather than refetched.
    static let maxAge: TimeInterval = 60 * 60

    private(set) var conditions: [String: TripConditions] = [:]

    private let service: WeatherServicing
    private let defaults: UserDefaults
    private let cacheKey = "tripConditions.v1"

    init(service: WeatherServicing = WeatherService.shared, defaults: UserDefaults = .standard) {
        self.service = service
        self.defaults = defaults
        if let data = defaults.data(forKey: cacheKey),
           let cached = try? JSONDecoder().decode([String: TripConditions].self, from: data) {
            conditions = cached
        }
    }

    func conditions(for tripId: String) -> TripConditions? { conditions[tripId] }

    /// Trips worth a forecast: dated, located, and starting within the horizon
    /// but not yet over.
    static func needsForecast(_ trip: Trip, now: Date, calendar: Calendar = .current) -> Bool {
        guard !trip.deleted, trip.location != nil,
              let days = TripReminderPlanner.daysUntilStart(trip, now: now, calendar: calendar)
        else { return false }
        return days >= 0 && days <= forecastHorizonDays
    }

    /// Refreshes every trip that needs a forecast and drops entries for trips
    /// that no longer do. `force` ignores `maxAge` (background refresh).
    func refresh(trips: [Trip], force: Bool = false, now: Date = Date()) async {
        guard FeatureFlagStore.shared.isEnabled(TripReminderPlanner.flagKey) else { return }
        let due = trips.filter { Self.needsForecast($0, now: now) }
        let dueIds = Set(due.map(\.id))
        conditions = conditions.filter { dueIds.contains($0.key) }

        for trip in due {
            if !force, let existing = conditions[trip.id],
               existing.sourceKey == TripConditions.sourceKey(for: trip),
               now.timeIntervalSince(existing.fetchedAt) < Self.maxAge {
                continue
            }
            guard let location = trip.location else { continue }
            do {
                let forecast = try await service.getForecast(query: "\(location.latitude),\(location.longitude)")
                guard let summary = TripConditions.make(trip: trip, forecast: forecast, now: now) else {
                    // Moved out of the forecast's reach: drop the old destination's weather.
                    conditions[trip.id] = nil
                    continue
                }
                conditions[trip.id] = summary
            } catch {
                // Offline or a provider error: keep the last forecast.
                SentrySDK.capture(error: error) { scope in
                    scope.setTag(value: "tripReminders", key: "feature")
                    scope.setTag(value: "fetchConditions", key: "action")
                    scope.setExtra(value: trip.id, key: "tripId")
                }
            }
        }
        persist()
    }

    func reset() {
        conditions = [:]
        defaults.removeObject(forKey: cacheKey)
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(conditions) {
            defaults.set(data, forKey: cacheKey)
        }
    }

}
