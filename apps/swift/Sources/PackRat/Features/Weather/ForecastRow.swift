import SwiftUI

enum WeatherTemperatureDisplay {
    static func format(
        celsius: Double?,
        fahrenheit: Double?,
        unit: AppPreferences.TemperatureUnit
    ) -> String {
        let value: Double?
        switch unit {
        case .celsius:
            value = celsius ?? fahrenheit.map { ($0 - 32) * 5 / 9 }
        case .fahrenheit:
            value = fahrenheit ?? celsius.map { ($0 * 9 / 5) + 32 }
        }

        guard let value else { return "—" }
        return "\(Int(value.rounded()))\(unit.label)"
    }

    /// Bare degrees, no C/F suffix — for the weather surfaces where the unit is
    /// already established by context (a hero, a card, an hourly column).
    /// Repeating "°F" on every number there is noise Apple's Weather app
    /// deliberately drops.
    static func degrees(
        celsius: Double?,
        fahrenheit: Double?,
        unit: AppPreferences.TemperatureUnit
    ) -> String {
        let formatted = format(celsius: celsius, fahrenheit: fahrenheit, unit: unit)
        guard formatted != "—" else { return formatted }
        return formatted.replacingOccurrences(of: unit.label, with: "°")
    }
}

struct ForecastRow: View {
    let day: ForecastDay
    let temperatureUnit: AppPreferences.TemperatureUnit

    var body: some View {
        HStack(spacing: 12) {
            Text(day.displayDate)
                .font(.callout)
                .frame(width: 90, alignment: .leading)

            if let symbol = day.day?.condition?.sfSymbol {
                Image(systemName: symbol)
                    .font(.body)
                    .foregroundStyle(.tint)
                    .symbolRenderingMode(.multicolor)
                    .frame(width: 24)
            }

            if let text = day.day?.condition?.text {
                Text(text)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            HStack(spacing: 8) {
                if let rain = day.day?.dailyChanceOfRain, rain > 0 {
                    Label("\(rain)%", systemImage: "drop")
                        .font(.caption)
                        .foregroundStyle(.blue)
                }

                Text(WeatherTemperatureDisplay.format(
                    celsius: day.day?.maxtempC,
                    fahrenheit: day.day?.maxtempF,
                    unit: temperatureUnit
                ))
                    .font(.callout.bold())
                    .frame(width: 44, alignment: .trailing)
                    .accessibilityIdentifier("weather_forecast_high_\(day.id)")

                Text(WeatherTemperatureDisplay.format(
                    celsius: day.day?.mintempC,
                    fahrenheit: day.day?.mintempF,
                    unit: temperatureUnit
                ))
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .frame(width: 44, alignment: .trailing)
                    .accessibilityIdentifier("weather_forecast_low_\(day.id)")
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
    }
}
