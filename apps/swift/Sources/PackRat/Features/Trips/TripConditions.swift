import Foundation

/// The weather at a trip's destination across the trip's own days, boiled down
/// to what changes the pack. Built from the 10-day forecast, so it only exists
/// once the trip is inside that window. Product behaviour:
/// docs/features/pre-trip-reminders.md ("Conditions at the destination").
struct TripConditions: Codable, Equatable, Sendable {
    struct Alert: Codable, Equatable, Hashable, Sendable {
        let id: String
        let event: String
        let severity: String?
    }

    let tripId: String
    let fetchedAt: Date
    /// Trip days the forecast covers, out of `tripDays`.
    let coveredDays: Int
    let tripDays: Int
    let lowF: Double
    let highF: Double
    let lowC: Double
    let highC: Double
    let maxChanceOfRain: Int
    let maxChanceOfSnow: Int
    let conditionText: String?
    let alerts: [Alert]

    /// Forecast thresholds that change what to bring.
    static let freezingF = 32.0
    static let nearFreezingF = 38.0
    static let hotF = 90.0
    static let likelyChance = 50
    static let snowChance = 30

    /// Summarises `forecast` over the trip's days; nil when no forecast day
    /// falls inside the trip yet. `calendar` decides which local day the trip
    /// starts and ends on, matching how the countdown counts days.
    static func make(
        trip: Trip,
        forecast: WeatherForecastResponse,
        now: Date,
        calendar: Calendar = .current
    ) -> TripConditions? {
        guard let start = trip.startDate?.toDate() else { return nil }
        let end = trip.endDate?.toDate() ?? start
        let firstDay = dayString(start, calendar: calendar)
        let lastDay = dayString(max(end, start), calendar: calendar)
        let days = (forecast.forecast?.forecastday ?? []).filter {
            guard let date = $0.date else { return false }
            return date >= firstDay && date <= lastDay
        }
        let daily = days.compactMap(\.day)
        guard !daily.isEmpty,
              let lowF = daily.compactMap(\.mintempF).min(),
              let highF = daily.compactMap(\.maxtempF).max()
        else { return nil }

        let tripDays = (calendar.dateComponents(
            [.day], from: calendar.startOfDay(for: start), to: calendar.startOfDay(for: max(end, start))
        ).day ?? 0) + 1
        let alerts = (forecast.alerts?.alert ?? []).compactMap { alert -> Alert? in
            guard let event = alert.event ?? alert.headline else { return nil }
            return Alert(id: alert.id, event: event, severity: alert.severity)
        }
        // The provider repeats one alert per affected zone; keep one per event.
        var seenEvents = Set<String>()
        let distinctAlerts = alerts.filter { seenEvents.insert($0.event.lowercased()).inserted }

        return TripConditions(
            tripId: trip.id,
            fetchedAt: now,
            coveredDays: daily.count,
            tripDays: tripDays,
            lowF: lowF,
            highF: highF,
            lowC: daily.compactMap(\.mintempC).min() ?? (lowF - 32) * 5 / 9,
            highC: daily.compactMap(\.maxtempC).max() ?? (highF - 32) * 5 / 9,
            maxChanceOfRain: daily.compactMap(\.dailyChanceOfRain).max() ?? 0,
            maxChanceOfSnow: daily.compactMap(\.dailyChanceOfSnow).max() ?? 0,
            conditionText: daily.first?.condition?.text,
            alerts: distinctAlerts
        )
    }

    private static func dayString(_ date: Date, calendar: Calendar) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    // MARK: - Copy

    /// "Highs 68°, lows 34°" in the user's unit.
    func temperatureSummary(celsius: Bool) -> String {
        let (high, low) = celsius ? (highC, lowC) : (highF, lowF)
        return "Highs \(Int(high.rounded()))°, lows \(Int(low.rounded()))°"
    }

    /// What the forecast means for the pack, most consequential first; empty
    /// when the forecast asks nothing of the user.
    func packAdvice(celsius: Bool) -> [String] {
        var advice: [String] = []
        if maxChanceOfSnow >= Self.snowChance {
            advice.append("Snow possible — pack warm layers and traction.")
        } else if lowF <= Self.freezingF {
            advice.append("Lows below freezing — pack your warm layers.")
        } else if lowF <= Self.nearFreezingF {
            advice.append("Lows near freezing — pack your warm layers.")
        }
        if maxChanceOfRain >= Self.likelyChance {
            advice.append("Rain likely — pack your rain gear.")
        }
        if highF >= Self.hotF {
            let high = Int((celsius ? highC : highF).rounded())
            advice.append("Highs near \(high)° — bring extra water and sun cover.")
        }
        return advice
    }

    /// One line for a reminder: an active hazard outranks pack advice.
    func reminderLine(celsius: Bool) -> String? {
        if let alert = alerts.first {
            return "Weather alert at the destination: \(alert.event)."
        }
        return packAdvice(celsius: celsius).first
    }
}

/// The user's temperature unit outside a view (Settings → Units).
enum TemperaturePreference {
    static var isCelsius: Bool {
        UserDefaults.standard.string(forKey: "temperatureUnit") == AppPreferences.TemperatureUnit.celsius.rawValue
    }
}
