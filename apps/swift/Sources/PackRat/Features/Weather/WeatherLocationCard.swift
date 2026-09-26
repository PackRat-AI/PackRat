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
                                .foregroundStyle(.white.opacity(0.85))
                                .accessibilityLabel("Watched for alerts")
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
                            .foregroundStyle(.white)
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
                    Text(summary.map {
                        WeatherTemperatureDisplay.format(
                            celsius: $0.tempC,
                            fahrenheit: $0.tempF,
                            unit: temperatureUnit
                        )
                    } ?? "—")
                    .font(.system(size: 48, weight: .thin))
                    .foregroundStyle(.white)

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
        }
        .frame(height: 118)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("weather_saved_location_\(location.id)")
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
    let localTimeLabel: String?

    func highLabel(unit: AppPreferences.TemperatureUnit) -> String? {
        guard highC != nil || highF != nil else { return nil }
        return WeatherTemperatureDisplay.format(celsius: highC, fahrenheit: highF, unit: unit)
    }

    func lowLabel(unit: AppPreferences.TemperatureUnit) -> String? {
        guard lowC != nil || lowF != nil else { return nil }
        return WeatherTemperatureDisplay.format(celsius: lowC, fahrenheit: lowF, unit: unit)
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
        // `localtime` arrives as "YYYY-MM-DD HH:MM" already in local time.
        guard let localtime = location.localtime,
              let timePart = localtime.split(separator: " ").last
        else { return nil }
        return String(timePart)
    }
}
