import SwiftUI

/// The 10-day outlook. Each row carries a temperature range bar positioned
/// against the range of the *whole* period, so a warm day and a cold day are
/// visually comparable down the column — the bar means nothing if every row
/// normalises to its own width.
struct DailyForecastSection: View {
    let days: [ForecastDay]
    let temperatureUnit: AppPreferences.TemperatureUnit

    /// Lowest low and highest high across the period, in the display unit.
    private var periodRange: (low: Double, high: Double)? {
        let lows = days.compactMap { value(celsius: $0.day?.mintempC, fahrenheit: $0.day?.mintempF) }
        let highs = days.compactMap { value(celsius: $0.day?.maxtempC, fahrenheit: $0.day?.maxtempF) }
        guard let low = lows.min(), let high = highs.max(), high > low else { return nil }
        return (low, high)
    }

    private func value(celsius: Double?, fahrenheit: Double?) -> Double? {
        switch temperatureUnit {
        case .celsius:    return celsius ?? fahrenheit.map { ($0 - 32) * 5 / 9 }
        case .fahrenheit: return fahrenheit ?? celsius.map { ($0 * 9 / 5) + 32 }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Label("10-DAY FORECAST", systemImage: "calendar")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white.opacity(0.7))
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 10)

            ForEach(days) { day in
                DailyForecastRow(
                    day: day,
                    temperatureUnit: temperatureUnit,
                    periodRange: periodRange,
                    displayValue: value
                )
                if day.id != days.last?.id {
                    Divider()
                        .overlay(Color.white.opacity(0.2))
                        .padding(.leading, 16)
                }
            }
        }
        .weatherGlassCard()
        .accessibilityIdentifier("weather_daily_forecast")
    }
}

private struct DailyForecastRow: View {
    let day: ForecastDay
    let temperatureUnit: AppPreferences.TemperatureUnit
    let periodRange: (low: Double, high: Double)?
    let displayValue: (Double?, Double?) -> Double?

    private var low: Double? { displayValue(day.day?.mintempC, day.day?.mintempF) }
    private var high: Double? { displayValue(day.day?.maxtempC, day.day?.maxtempF) }

    var body: some View {
        HStack(spacing: 10) {
            Text(day.displayDate)
                .font(.body.weight(.medium))
                .foregroundStyle(.white)
                .frame(width: 66, alignment: .leading)

            VStack(spacing: 1) {
                Image(systemName: day.day?.condition?.sfSymbol ?? "cloud")
                    .font(.body)
                    .symbolRenderingMode(.multicolor)
                if let rain = day.day?.dailyChanceOfRain, rain >= 20 {
                    Text("\(rain)%")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(Color(red: 0.4, green: 0.78, blue: 1.0))
                }
            }
            .frame(width: 34)

            Text(low.map { "\(Int($0.rounded()))°" } ?? "—")
                .font(.body)
                .foregroundStyle(.white.opacity(0.6))
                .frame(width: 34, alignment: .trailing)
                .accessibilityIdentifier("weather_forecast_low_\(day.id)")

            temperatureBar

            Text(high.map { "\(Int($0.rounded()))°" } ?? "—")
                .font(.body)
                .foregroundStyle(.white)
                .frame(width: 34, alignment: .trailing)
                .accessibilityIdentifier("weather_forecast_high_\(day.id)")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 9)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var temperatureBar: some View {
        GeometryReader { geo in
            let track = Color.white.opacity(0.22)
            if let periodRange, let low, let high {
                let span = periodRange.high - periodRange.low
                let startFraction = (low - periodRange.low) / span
                let widthFraction = (high - low) / span
                Capsule()
                    .fill(track)
                    .overlay(alignment: .leading) {
                        Capsule()
                            .fill(LinearGradient(
                                colors: barColors(low: low, high: high, in: periodRange),
                                startPoint: .leading,
                                endPoint: .trailing
                            ))
                            // A single-degree day would otherwise render as an
                            // invisible sliver, so the bar keeps a floor width.
                            .frame(width: max(geo.size.width * widthFraction, 6))
                            .offset(x: geo.size.width * startFraction)
                    }
                    .frame(height: 4)
                    .frame(maxHeight: .infinity)
            } else {
                Capsule()
                    .fill(track)
                    .frame(height: 4)
                    .frame(maxHeight: .infinity)
            }
        }
        .frame(height: 20)
    }

    /// Cool-to-warm gradient keyed to where this day sits in the period, so the
    /// bar carries temperature information by hue as well as by position.
    private func barColors(low: Double, high: Double, in range: (low: Double, high: Double)) -> [Color] {
        let span = range.high - range.low
        return [hue(for: (low - range.low) / span), hue(for: (high - range.low) / span)]
    }

    private func hue(for fraction: Double) -> Color {
        // 0 = cold blue → 1 = warm orange, through green/yellow.
        let clamped = min(max(fraction, 0), 1)
        return Color(hue: 0.58 - (clamped * 0.50), saturation: 0.75, brightness: 0.95)
    }
}
