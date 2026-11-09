import Foundation

/// What a trip's Weather section shows, decided from the trip's dates and the
/// destination's forecast. Product behaviour: docs/features/trip-weather.md
/// ("The forecast on a trip").
enum TripWeatherPlan: Equatable {
    /// No destination or no dates, or the trip is over: no section at all.
    case hidden
    /// The trip starts after the last forecast day.
    case beyondRange
    /// The trip's days that have a forecast, from today onward once it has
    /// started. `partial` when later trip days are still out of range.
    case days(dates: [String], underWay: Bool, partial: Bool)

    static let horizonDays = TripConditionsStore.forecastHorizonDays

    /// Whether the section needs a forecast fetched at all; decided from the
    /// dates alone so a trip months out never calls the API.
    static func needsForecast(_ trip: Trip, now: Date, calendar: Calendar = .current) -> Bool {
        guard let range = dayRange(trip, calendar: calendar) else { return false }
        let today = calendar.startOfDay(for: now)
        guard range.end >= today,
              let lastForecastDay = calendar.date(byAdding: .day, value: horizonDays - 1, to: today)
        else { return false }
        return range.start <= lastForecastDay
    }

    static func make(
        trip: Trip,
        forecastDates: [String],
        now: Date,
        calendar: Calendar = .current
    ) -> TripWeatherPlan {
        guard let range = dayRange(trip, calendar: calendar) else { return .hidden }
        let today = calendar.startOfDay(for: now)
        if range.end < today { return .hidden }
        guard let lastForecastDay = calendar.date(byAdding: .day, value: horizonDays - 1, to: today),
              range.start <= lastForecastDay
        else { return .beyondRange }

        let underWay = range.start <= today
        let first = dayString(max(range.start, today), calendar: calendar)
        let last = dayString(range.end, calendar: calendar)
        let dates = forecastDates.filter { $0 >= first && $0 <= last }.sorted()
        let partial = dates.last.map { $0 < last } ?? true
        return .days(dates: dates, underWay: underWay, partial: partial)
    }

    /// Trips whose destination is being watched for alerts right now, soonest
    /// first. Mirrors the server's window in
    /// `packages/api/src/services/weatherMonitoring/tripDestinationWatch.ts`:
    /// from 3 days before the start until a day after the end.
    static func watchedTrips(_ trips: [Trip], now: Date) -> [Trip] {
        trips
            .compactMap { trip in watchWindow(trip).map { (trip, $0) } }
            .filter { _, window in window.opensAt <= now && now <= window.closesAt }
            .sorted { $0.1.opensAt < $1.1.opensAt }
            .map(\.0)
    }

    static func watchWindow(_ trip: Trip) -> (opensAt: Date, closesAt: Date)? {
        guard !trip.deleted, trip.sendsWeatherAlerts, trip.location != nil,
              let start = trip.startDate?.toDate()
        else { return nil }
        let end = trip.endDate?.toDate() ?? start
        return (start.addingTimeInterval(-3 * 86_400), end.addingTimeInterval(86_400))
    }

    private static func dayRange(_ trip: Trip, calendar: Calendar) -> (start: Date, end: Date)? {
        guard !trip.deleted, trip.location != nil,
              let start = trip.startDate?.toDate()
        else { return nil }
        let end = trip.endDate?.toDate() ?? start
        return (calendar.startOfDay(for: start), calendar.startOfDay(for: max(end, start)))
    }

    static func dayString(_ date: Date, calendar: Calendar) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
}
