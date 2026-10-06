import Foundation
import Observation
import Sentry
#if os(iOS)
import UserNotifications
#endif

/// Fetches and keeps the destination forecast for upcoming trips. The last
/// result is persisted so the readiness summary and reminders still have "the
/// latest the app has" with no signal. A weather alert seen for the first time
/// on an upcoming trip is announced straight away, the way a watched location's
/// alert would be.
@Observable
@MainActor
final class TripConditionsStore {
    static let shared = TripConditionsStore()

    /// Forecasts reach 10 days out; there is nothing to fetch before that.
    static let forecastHorizonDays = 10
    /// A forecast younger than this is reused rather than refetched.
    static let maxAge: TimeInterval = 60 * 60
    static let alertIdentifierPrefix = "trip-alert."

    private(set) var conditions: [String: TripConditions] = [:]

    private let service: WeatherServicing
    private let defaults: UserDefaults
    private let cacheKey = "tripConditions.v1"
    private let seenAlertsKey = "tripConditions.seenAlerts.v1"

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
                #if os(iOS)
                await announceNewAlerts(summary, trip: trip)
                #endif
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
        defaults.removeObject(forKey: seenAlertsKey)
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(conditions) {
            defaults.set(data, forKey: cacheKey)
        }
    }

    #if os(iOS)
    /// Posts one notification per alert not seen before for this trip. Alerts
    /// are marked seen even when reminders are off, so unmuting a trip doesn't
    /// replay old hazards.
    private func announceNewAlerts(_ summary: TripConditions, trip: Trip) async {
        var seen = defaults.dictionary(forKey: seenAlertsKey) as? [String: [String]] ?? [:]
        let known = Set(seen[trip.id] ?? [])
        let fresh = summary.alerts.filter { !known.contains($0.id) }
        guard !fresh.isEmpty else { return }
        seen[trip.id] = Array(known.union(summary.alerts.map(\.id)))
        defaults.set(seen, forKey: seenAlertsKey)

        let settings = TripReminderSettings.shared
        guard settings.isEnabled, !settings.isMuted(trip.id) else { return }
        let center = UNUserNotificationCenter.current()
        let status = await center.notificationSettings().authorizationStatus
        guard status == .authorized || status == .provisional else { return }

        for alert in fresh {
            let content = UNMutableNotificationContent()
            content.title = "Weather alert for \(trip.name)"
            let place = trip.location?.name.map { " near \($0)" } ?? " at your destination"
            content.body = "\(alert.event) has been issued\(place). Check the forecast before you go."
            content.sound = .default
            content.threadIdentifier = "\(TripReminderPlanner.identifierPrefix)\(trip.id)"
            content.userInfo = [TripReminderScheduler.tripIdKey: trip.id]
            let request = UNNotificationRequest(
                identifier: "\(Self.alertIdentifierPrefix)\(trip.id).\(alert.id.hashValue)",
                content: content,
                trigger: nil
            )
            try? await center.add(request)
        }
    }
    #endif
}
