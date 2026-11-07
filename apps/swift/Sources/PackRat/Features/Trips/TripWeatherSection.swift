import SwiftUI
import Sentry

/// The destination's forecast for the trip's own days, on the trip screen.
/// Product behaviour: docs/features/trip-weather.md ("The forecast on a trip").
struct TripWeatherSection: View {
    static let flagKey = "enableTripWeather"

    let trip: Trip

    @Environment(AppState.self) private var appState
    @AppStorage("temperatureUnit") private var temperatureUnit: AppPreferences.TemperatureUnit = .fahrenheit
    @State private var forecast: WeatherForecastResponse?
    @State private var loadFailed = false
    @State private var pushedLocation: WeatherLocation?

    /// Active hazards at the destination, one per event: the provider repeats
    /// an alert for every zone it covers.
    private var alerts: [WeatherAlert] {
        var seenEvents = Set<String>()
        return (forecast?.alerts?.alert ?? []).filter { alert in
            seenEvents.insert((alert.event ?? alert.headline ?? alert.id).lowercased()).inserted
        }
    }

    private var plan: TripWeatherPlan {
        TripWeatherPlan.make(
            trip: trip,
            forecastDates: forecast?.forecast?.forecastday?.compactMap(\.date) ?? [],
            now: Date()
        )
    }

    /// The forecast screen needs the provider's location id; without one the
    /// section stays put rather than opening a screen it cannot fill.
    private var forecastLocation: WeatherLocation? {
        guard let location = forecast?.location, let id = location.id else { return nil }
        return WeatherLocation(
            id: id,
            name: location.name ?? trip.location?.name ?? trip.name,
            region: location.region,
            country: location.country,
            lat: location.lat,
            lon: location.lon
        )
    }

    var body: some View {
        if plan != .hidden {
            VStack(alignment: .leading, spacing: 8) {
                Text("WEATHER")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                content
            }
            .padding(.horizontal)
            .task(id: TripConditions.sourceKey(for: trip)) { await load() }
            .navigationDestination(item: $pushedLocation) { location in
                LocationForecastView(location: location, viewModel: appState.weatherVM)
            }
            .accessibilityIdentifier("trip_weather_section")
        }
    }

    @ViewBuilder
    private var content: some View {
        switch plan {
        case .hidden:
            EmptyView()
        case .beyondRange:
            note("The forecast for your trip appears \(TripWeatherPlan.horizonDays) days before you leave.")
                .accessibilityIdentifier("trip_weather_beyond_range")
        case .days(let dates, let underWay, let partial):
            if forecast == nil {
                if loadFailed {
                    failedCard
                } else {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 80)
                        .background(.background.secondary, in: card)
                }
            } else {
                if !alerts.isEmpty {
                    VStack(spacing: 8) {
                        ForEach(Array(alerts.enumerated()), id: \.offset) { _, alert in
                            ForecastAlertCard(alert: alert, onSky: false)
                        }
                    }
                    .accessibilityIdentifier("trip_weather_alerts")
                }
                Button {
                    pushedLocation = forecastLocation
                } label: {
                    forecastCard(dates: dates, underWay: underWay, partial: partial)
                }
                .buttonStyle(.plain)
                .disabled(forecastLocation == nil)
                .accessibilityIdentifier("trip_weather_open_forecast")
            }
        }
    }

    private var card: RoundedRectangle { RoundedRectangle(cornerRadius: 12, style: .continuous) }

    private func forecastCard(dates: [String], underWay: Bool, partial: Bool) -> some View {
        let days = (forecast?.forecast?.forecastday ?? []).filter { day in
            day.date.map(dates.contains) ?? false
        }
        return VStack(alignment: .leading, spacing: 0) {
            if underWay, let current = forecast?.current {
                currentConditions(current)
                Divider().padding(.leading)
            }
            ForEach(days) { day in
                ForecastRow(day: day, temperatureUnit: temperatureUnit, title: title(for: day))
                if day.id != days.last?.id {
                    Divider().padding(.leading)
                }
            }
            if partial {
                Divider().padding(.leading)
                Text("The rest of your trip's forecast appears as it gets closer.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal)
                    .padding(.vertical, 10)
                    .accessibilityIdentifier("trip_weather_partial")
            }
            if let attribution = forecast?.attribution {
                WeatherAttributionView(attribution: attribution, onDarkBackground: false)
                    .padding(.horizontal)
                    .padding(.bottom, 10)
            }
        }
        .background(.background.secondary, in: card)
        .contentShape(card)
    }

    private func currentConditions(_ current: WeatherCurrent) -> some View {
        HStack(spacing: 12) {
            Image(systemName: current.condition?.sfSymbol ?? "cloud")
                .font(.title2)
                .symbolRenderingMode(.multicolor)
                .frame(width: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text("Now")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let text = current.condition?.text {
                    Text(text).font(.callout)
                }
            }
            Spacer()
            Text(WeatherTemperatureDisplay.degrees(
                celsius: current.tempC, fahrenheit: current.tempF, unit: temperatureUnit
            ))
                .font(.title2.bold())
                .accessibilityIdentifier("trip_weather_current_temp")
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal)
        .padding(.vertical, 12)
    }

    /// "Today", "Tomorrow", then "Sat 8": a trip can span the same weekday twice.
    private func title(for day: ForecastDay) -> String {
        guard let string = day.date,
              let date = try? Date(string, strategy: .iso8601.year().month().day())
        else { return day.displayDate }
        let calendar = Calendar.current
        if calendar.isDateInToday(date) || calendar.isDateInTomorrow(date) { return day.displayDate }
        return date.formatted(.dateTime.weekday(.abbreviated).day())
    }

    private var failedCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("The forecast couldn't be loaded.")
                .font(.callout)
                .foregroundStyle(.secondary)
            Button("Try Again") { Task { await load() } }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("trip_weather_retry")
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background.secondary, in: card)
    }

    private func note(_ text: String) -> some View {
        Text(text)
            .font(.callout)
            .foregroundStyle(.secondary)
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.background.secondary, in: card)
    }

    /// The trip list's marker clears once the alerts have been on screen here,
    /// including any the list learned about from an earlier fetch.
    private func markAlertsSeen() {
        let stored = TripConditionsStore.shared.conditions(for: trip.id)?.alerts.map(\.id) ?? []
        TripWeatherAlertReads.shared.markSeen(tripId: trip.id, alertIds: alerts.map(\.id) + stored)
    }

    private func load() async {
        guard TripWeatherPlan.needsForecast(trip, now: Date()), let location = trip.location else { return }
        loadFailed = false
        let crumb = Breadcrumb(level: .info, category: "tripWeather")
        crumb.message = "Trip forecast requested"
        crumb.data = ["tripId": trip.id]
        SentrySDK.addBreadcrumb(crumb)
        do {
            forecast = try await WeatherService.shared.getForecast(
                query: "\(location.latitude),\(location.longitude)"
            )
            markAlertsSeen()
        } catch is CancellationError {
            return
        } catch {
            loadFailed = forecast == nil
            SentrySDK.capture(error: error) { scope in
                scope.setTag(value: "tripWeather", key: "feature")
                scope.setTag(value: "fetchForecast", key: "action")
                scope.setExtra(value: trip.id, key: "tripId")
            }
        }
    }
}
