import SwiftUI

/// One location's forecast, as its own screen.
///
/// This screen exists to give per-location actions somewhere honest to live.
/// While the location list and the forecast shared a single screen, the watch
/// toggle had to sit in a navigation bar that belonged to every saved location
/// at once — a control acting on one place, mounted on a screen showing all of
/// them. Apple's HIG is explicit that navigation bar actions must relate to the
/// content currently on screen, and the old arrangement structurally could not.
/// Here there is exactly one location on screen, so the watch toggle in the
/// navigation bar is unambiguous.
struct LocationForecastView: View {
    let location: WeatherLocation
    @Bindable var viewModel: WeatherViewModel
    @AppStorage("temperatureUnit") private var temperatureUnit: AppPreferences.TemperatureUnit = .fahrenheit
    @AppStorage("speedUnit") private var speedUnit: SpeedUnit = .mph
    @State private var showingAlerts = false

    private var forecast: WeatherForecastResponse? {
        // The view model holds one forecast at a time, for whichever location
        // is selected. Only trust it when it is actually this location's.
        viewModel.selectedLocation?.id == location.id ? viewModel.forecast : nil
    }

    private var activeAlerts: [WeatherAlert] {
        forecast?.alerts?.alert ?? []
    }

    private var isDay: Bool {
        (forecast?.current?.isDay ?? 1) == 1
    }

    private var timeZone: TimeZone {
        forecast?.location?.tzId.flatMap(TimeZone.init(identifier:)) ?? .current
    }

    var body: some View {
        ZStack {
            WeatherSkyGradient
                .gradient(conditionCode: forecast?.current?.condition?.code, isDay: isDay)
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 14) {
                    hero

                    if !activeAlerts.isEmpty {
                        ForecastAlertSection(
                            alerts: activeAlerts,
                            showsWatchCallToAction: AppFeatureFlags.enableWeatherMonitoring
                                && !viewModel.isSelectedLocationWatched,
                            isWatched: AppFeatureFlags.enableWeatherMonitoring
                                && viewModel.isSelectedLocationWatched,
                            isUpdatingWatch: viewModel.isUpdatingWatchForSelectedLocation,
                            onWatch: { Task { await viewModel.toggleWatchForSelectedLocation() } }
                        )
                    }

                    if let days = forecast?.forecast?.forecastday, !days.isEmpty {
                        HourlyForecastStrip(
                            days: days,
                            timeZone: timeZone,
                            temperatureUnit: temperatureUnit,
                            summary: hourlySummary
                        )

                        DailyForecastSection(days: days, temperatureUnit: temperatureUnit)
                    }

                    if let current = forecast?.current {
                        conditionDetailGrid(current)
                    }

                    if viewModel.isLoadingForecast && forecast == nil {
                        ProgressView()
                            .tint(.white)
                            .padding(.top, 40)
                    } else if let error = viewModel.forecastError, forecast == nil {
                        InlineErrorView(message: error)
                            .padding(.top, 20)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
            }
        }
        .navigationTitle("")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        #endif
        .toolbar {
            // The per-location watch control, on the only screen where
            // "this location" is unambiguous.
            if AppFeatureFlags.enableWeatherMonitoring {
                ToolbarItem(placement: watchToolbarPlacement) {
                    Button {
                        Task { await viewModel.toggleWatchForSelectedLocation() }
                    } label: {
                        Label(
                            viewModel.isSelectedLocationWatched ? "Watching" : "Watch Location",
                            systemImage: viewModel.isSelectedLocationWatched ? "bell.fill" : "bell"
                        )
                    }
                    .disabled(viewModel.isUpdatingWatchForSelectedLocation)
                    .tint(.white)
                    .accessibilityLabel(viewModel.isSelectedLocationWatched
                        ? "Stop watching this location"
                        : "Watch this location for alerts")
                    .accessibilityIdentifier("weather_watch_toggle_button")
                }
            }
        }
        .refreshable { await viewModel.refresh() }
        .task {
            if viewModel.selectedLocation?.id != location.id {
                await viewModel.selectLocation(location)
            }
        }
        .task(id: viewModel.pendingAlertDeepLinkLocationId) {
            // A push tap that targets this location opens its alerts directly.
            guard viewModel.pendingAlertDeepLinkLocationId == location.id else { return }
            showingAlerts = true
            viewModel.pendingAlertDeepLinkLocationId = nil
        }
        .sheet(isPresented: $showingAlerts) {
            WeatherAlertsView(alerts: activeAlerts)
        }
    }

    private var watchToolbarPlacement: ToolbarItemPlacement {
        #if os(iOS)
        .topBarTrailing
        #else
        .primaryAction
        #endif
    }

    // MARK: - Hero

    private var hero: some View {
        VStack(spacing: 2) {
            Text(forecast?.location?.name ?? location.name)
                .font(.system(size: 34, weight: .regular))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)

            Text(WeatherTemperatureDisplay.format(
                celsius: forecast?.current?.tempC,
                fahrenheit: forecast?.current?.tempF,
                unit: temperatureUnit
            ))
            .font(.system(size: 96, weight: .thin))
            .foregroundStyle(.white)
            .accessibilityIdentifier("weather_current_temperature")

            if let condition = forecast?.current?.condition?.text {
                Text(condition)
                    .font(.title3)
                    .foregroundStyle(.white.opacity(0.8))
            }

            if let today = forecast?.forecast?.forecastday?.first?.day {
                Text("H:\(formatted(today.maxtempC, today.maxtempF))  L:\(formatted(today.mintempC, today.mintempF))")
                    .font(.title3)
                    .foregroundStyle(.white.opacity(0.8))
            }
        }
        .padding(.top, 8)
        .padding(.bottom, 16)
        .accessibilityIdentifier("weather_current_card")
    }

    private func formatted(_ celsius: Double?, _ fahrenheit: Double?) -> String {
        WeatherTemperatureDisplay.format(celsius: celsius, fahrenheit: fahrenheit, unit: temperatureUnit)
    }

    /// The narrative line Apple shows above the hourly strip. WeatherAPI has no
    /// equivalent field, so it is composed from what today's forecast actually
    /// says rather than invented.
    private var hourlySummary: String? {
        guard let today = forecast?.forecast?.forecastday?.first?.day else { return nil }
        var parts: [String] = []
        if let condition = today.condition?.text {
            parts.append("\(condition) conditions expected today.")
        }
        if let rain = today.dailyChanceOfRain, rain >= 30 {
            parts.append("There is a \(rain)% chance of precipitation.")
        }
        return parts.isEmpty ? nil : parts.joined(separator: " ")
    }

    // MARK: - Condition details

    private func conditionDetailGrid(_ current: WeatherCurrent) -> some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)], spacing: 14) {
            detailTile("FEELS LIKE", systemImage: "thermometer.medium", value: WeatherTemperatureDisplay.format(
                celsius: current.feelslikeC,
                fahrenheit: current.feelslikeF,
                unit: temperatureUnit
            ))
            .accessibilityIdentifier("weather_feels_like_temperature")

            detailTile("HUMIDITY", systemImage: "humidity", value: "\(current.humidity ?? 0)%")
            detailTile("WIND", systemImage: "wind", value: windDisplay(mph: current.windMph ?? 0))
            detailTile("UV INDEX", systemImage: "sun.max", value: String(format: "%.0f", current.uv ?? 0))
        }
    }

    private func detailTile(_ label: String, systemImage: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(label, systemImage: systemImage)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white.opacity(0.7))
            Text(value)
                .font(.system(size: 30, weight: .light))
                .foregroundStyle(.white)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: 96)
        .padding(14)
        .weatherGlassCard()
    }

    /// Renders an API wind value (always mph) in the user's preferred unit.
    private func windDisplay(mph: Double) -> String {
        speedUnit == .kmh ? "\(Int((mph * 1.609344).rounded())) km/h" : "\(Int(mph.rounded())) mph"
    }
}
