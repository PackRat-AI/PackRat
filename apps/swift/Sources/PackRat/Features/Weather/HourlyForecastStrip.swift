import SwiftUI

/// The horizontally scrolling hour-by-hour strip, with a leading "Now"
/// column. Shows the next 24 hours starting from the current local hour at the
/// location — not from midnight, which would leave the strip opening on hours
/// that have already passed.
struct HourlyForecastStrip: View {
    let days: [ForecastDay]
    let timeZone: TimeZone
    let temperatureUnit: AppPreferences.TemperatureUnit
    /// Narrative line above the strip ("Cloudy conditions will continue all
    /// day"), when the forecast offers one.
    let summary: String?

    private var upcomingHours: [ForecastHour] {
        let now = Date()
        // A day's `hour` array is local to the location, so flattening across
        // days and filtering by absolute time keeps the ordering correct
        // across the midnight boundary.
        let all = days.flatMap { $0.hour ?? [] }
        let future = all.filter { hour in
            guard let date = hour.date else { return false }
            // Keep the hour we're currently inside as "Now" rather than
            // dropping it the moment the clock passes its start.
            return date.timeIntervalSince(now) > -3600
        }
        return Array(future.prefix(24))
    }

    var body: some View {
        if !upcomingHours.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                if let summary, !summary.isEmpty {
                    Text(summary)
                        .font(.footnote)
                        .foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Divider().overlay(Color.white.opacity(0.25))
                }

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 20) {
                        ForEach(Array(upcomingHours.enumerated()), id: \.element.id) { index, hour in
                            hourColumn(hour, isNow: index == 0)
                        }
                    }
                    .padding(.horizontal, 2)
                }
            }
            .padding(16)
            .weatherGlassCard()
            .accessibilityIdentifier("weather_hourly_strip")
        }
    }

    private func hourColumn(_ hour: ForecastHour, isNow: Bool) -> some View {
        VStack(spacing: 10) {
            Text(isNow ? "Now" : hour.displayHour(timeZone: timeZone))
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white)

            VStack(spacing: 2) {
                Image(systemName: hour.condition?.sfSymbol ?? "cloud")
                    .font(.title3)
                    .symbolRenderingMode(.multicolor)
                    .frame(height: 24)

                // Precipitation chance rides under the icon like Apple's,
                // shown only when it is high enough to be worth acting on.
                if let chance = hour.chanceOfRain, chance >= 20 {
                    Text("\(chance)%")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(Color(red: 0.4, green: 0.78, blue: 1.0))
                } else {
                    Text(" ")
                        .font(.caption2)
                }
            }

            Text(WeatherTemperatureDisplay.format(
                celsius: hour.tempC,
                fahrenheit: hour.tempF,
                unit: temperatureUnit
            ))
            .font(.callout.weight(.medium))
            .foregroundStyle(.white)
        }
        .accessibilityElement(children: .combine)
    }
}

/// Shared translucent card used by every section that sits over the sky
/// gradient, so the detail screen reads as one material system rather than a
/// pile of differently-styled boxes.
enum WeatherGlassCard {
    static let shape = RoundedRectangle(cornerRadius: 18, style: .continuous)
    static let fill = Color.white.opacity(0.18)
}

extension View {
    /// Applies the standard translucent weather card treatment.
    func weatherGlassCard() -> some View {
        background(WeatherGlassCard.fill, in: WeatherGlassCard.shape)
    }
}
