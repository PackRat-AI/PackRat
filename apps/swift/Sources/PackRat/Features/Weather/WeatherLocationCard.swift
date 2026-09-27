import SwiftUI

/// A saved location's row on the Weather list, carrying its own sky so the
/// list reads as a stack of places rather than a table of numbers.
///
/// The card deliberately shows an active alert in place of the condition text:
/// when a hazard exists it is the most important thing this location has to
/// say, and the list is where a user scans for exactly that.
struct WeatherLocationCard: View {
    let location: WeatherLocation
    let summary: WeatherLocationSummary?
    let isWatched: Bool
    /// True when this location's active alert has not been opened yet. Drives
    /// the red marker, which exists to catch the eye mid-scroll — an alert the
    /// user has already read still shows, but stops shouting.
    let hasNewAlert: Bool
    let temperatureUnit: AppPreferences.TemperatureUnit

    private var isDay: Bool { summary?.isDay ?? true }

    var body: some View {
        ZStack {
            WeatherSkyGradient.gradient(conditionCode: summary?.conditionCode, isDay: isDay)

            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        Text(location.name)
                            .font(.title2.weight(.medium))
                            .foregroundStyle(.white)
                            .lineLimit(1)

                        // The watch state belongs on the card because watching
                        // is a property of the location, and the list is where
                        // a user compares locations against each other.
                        if isWatched {
                            Image(systemName: "bell.fill")
                                .font(.caption2)
                                .foregroundStyle(hasNewAlert ? Color.alertRed : .white.opacity(0.85))
                                .accessibilityLabel(hasNewAlert
                                    ? "Watched for alerts, new alert"
                                    : "Watched for alerts")
                        }
                    }

                    Text(summary?.localTimeLabel ?? location.region ?? "")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.8))
                        .lineLimit(1)

                    Spacer(minLength: 10)

                    if let alert = summary?.alertHeadline {
                        Label(alert, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(hasNewAlert ? Color.alertRed : .white)
                            .lineLimit(1)
                    } else if let condition = summary?.conditionText {
                        Text(condition)
                            .font(.footnote)
                            .foregroundStyle(.white.opacity(0.9))
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 8)

                VStack(alignment: .trailing, spacing: 2) {
                    if let summary {
                        Text(WeatherTemperatureDisplay.degrees(
                            celsius: summary.tempC,
                            fahrenheit: summary.tempF,
                            unit: temperatureUnit
                        ))
                        .font(.system(size: 48, weight: .thin))
                        .foregroundStyle(.white)
                    } else {
                        // A card whose conditions haven't arrived yet shows
                        // progress rather than an em dash, which reads as
                        // "no data" instead of "not yet".
                        ProgressView()
                            .tint(.white)
                            .frame(height: 48)
                    }

                    Spacer(minLength: 10)

                    if let summary, let high = summary.highLabel(unit: temperatureUnit),
                       let low = summary.lowLabel(unit: temperatureUnit) {
                        Text("H:\(high)  L:\(low)")
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(.white.opacity(0.9))
                    }
                }
            }
            .padding(16)

            // The red brick: a full-height bar down the card's leading edge.
            // The headline alone competes with the temperature for attention
            // and loses; an edge marker reads at a glance while scrolling a
            // list of otherwise similar cards, and it survives being the only
            // red thing on screen without turning the card into an alarm.
            if hasNewAlert {
                HStack(spacing: 0) {
                    Rectangle()
                        .fill(Color.alertRed)
                        .frame(width: 5)
                        .accessibilityHidden(true)
                    Spacer(minLength: 0)
                }
            }
        }
        .frame(height: 118)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .accessibilityElement(children: .combine)
        // The identifier stays stable so existing selectors keep resolving;
        // the new-alert state is exposed as a value instead of a second id.
        .accessibilityIdentifier("weather_saved_location_\(location.id)")
        .accessibilityValue(hasNewAlert ? "New alert" : "")
    }
}

/// The handful of values the list card needs from a full forecast. Keeping it
/// narrow means the list can hold one of these per location without retaining
/// ten full forecast payloads.
struct WeatherLocationSummary: Equatable, Sendable {
    let tempC: Double?
    let tempF: Double?
    let highC: Double?
    let highF: Double?
    let lowC: Double?
    let lowF: Double?
    let conditionText: String?
    let conditionCode: Int?
    let isDay: Bool
    let alertHeadline: String?
    /// Identity of the alert the headline came from, so the list can tell a
    /// hazard the user has already read from one that has just arrived.
    let alertId: String?
    let localTimeLabel: String?

    func highLabel(unit: AppPreferences.TemperatureUnit) -> String? {
        guard highC != nil || highF != nil else { return nil }
        return WeatherTemperatureDisplay.degrees(celsius: highC, fahrenheit: highF, unit: unit)
    }

    func lowLabel(unit: AppPreferences.TemperatureUnit) -> String? {
        guard lowC != nil || lowF != nil else { return nil }
        return WeatherTemperatureDisplay.degrees(celsius: lowC, fahrenheit: lowF, unit: unit)
    }

    init(forecast: WeatherForecastResponse) {
        let today = forecast.forecast?.forecastday?.first?.day
        tempC = forecast.current?.tempC
        tempF = forecast.current?.tempF
        highC = today?.maxtempC
        highF = today?.maxtempF
        lowC = today?.mintempC
        lowF = today?.mintempF
        conditionText = forecast.current?.condition?.text
        conditionCode = forecast.current?.condition?.code
        isDay = (forecast.current?.isDay ?? 1) == 1
        let alerts = forecast.alerts?.alert ?? []
        alertHeadline = alerts.first.flatMap { $0.event ?? $0.headline }
        alertId = alerts.first?.id
        localTimeLabel = Self.timeLabel(from: forecast.location)
    }

    /// The location's own local time, as Apple shows on each card. Falls back
    /// to nothing rather than showing the viewer's time, which would be wrong
    /// for any location in another zone.
    private static func timeLabel(from location: WeatherResponseLocation?) -> String? {
        guard let location else { return nil }
        if let epoch = location.localtimeEpoch,
           let identifier = location.tzId,
           let zone = TimeZone(identifier: identifier) {
            var formatter = Date.FormatStyle(date: .omitted, time: .shortened)
            formatter.timeZone = zone
            return Date(timeIntervalSince1970: TimeInterval(epoch)).formatted(formatter)
        }
        // `localtime` arrives as "YYYY-MM-DD HH:MM" already in local time, in
        // 24-hour form. Reformat rather than passing it through, so the card
        // never shows "09:00" next to the rest of the app's 12-hour times.
        guard let localtime = location.localtime,
              let timePart = localtime.split(separator: " ").last
        else { return nil }
        let pieces = timePart.split(separator: ":")
        guard pieces.count >= 2, let hour = Int(pieces[0]) else { return String(timePart) }
        var components = DateComponents()
        components.hour = hour
        components.minute = Int(pieces[1]) ?? 0
        guard let date = Calendar.current.date(from: components) else { return String(timePart) }
        return date.formatted(.dateTime.hour().minute())
    }
}
