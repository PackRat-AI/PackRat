import SwiftUI

struct WeatherView: View {
    @Bindable var viewModel: WeatherViewModel

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                searchBar

                if viewModel.isLoadingForecast {
                    ProgressView("Loading forecast...").padding(.top, 40)
                } else if let error = viewModel.forecastError {
                    ErrorView(error, retry: { await viewModel.refresh() }).padding(.top, 20)
                } else if let forecast = viewModel.forecast {
                    forecastContent(forecast)
                } else {
                    EmptyStateView(
                        "Search for a Location",
                        subtitle: "Enter a city, region, or ZIP code to get the weather forecast",
                        systemImage: "cloud.sun"
                    )
                    .padding(.top, 20)
                }
            }
            .padding()
        }
        .navigationTitle("Weather")
        .refreshable { await viewModel.refresh() }
    }

    private var searchBar: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Search locations…", text: $viewModel.searchText)
                    .onChange(of: viewModel.searchText) { viewModel.onSearchTextChanged() }
                if viewModel.isSearching {
                    ProgressView().controlSize(.small)
                }
            }
            .padding(10)
            .background(.fill.secondary, in: RoundedRectangle(cornerRadius: 10))

            if !viewModel.searchResults.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(viewModel.searchResults) { location in
                        Button {
                            Task { await viewModel.selectLocation(location) }
                        } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(location.name).font(.body)
                                    if let region = location.region, let country = location.country {
                                        Text("\(region), \(country)")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                        }
                        .buttonStyle(.plain)
                        Divider().padding(.leading, 12)
                    }
                }
                .background(.background.secondary, in: RoundedRectangle(cornerRadius: 10))
                .shadow(color: .black.opacity(0.08), radius: 8, y: 4)
            }

            if let error = viewModel.searchError {
                InlineErrorView(message: error)
            }
        }
    }

    @ViewBuilder
    private func forecastContent(_ data: WeatherForecastResponse) -> some View {
        // Current conditions
        if let current = data.current, let location = data.location {
            currentWeatherCard(current: current, location: location)
        }

        // Forecast days
        if let days = data.forecast?.forecastday, !days.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("10-Day Forecast")
                    .font(.headline)
                    .padding(.horizontal, 4)
                VStack(spacing: 0) {
                    ForEach(days) { day in
                        ForecastRow(day: day)
                        if day.id != days.last?.id {
                            Divider().padding(.horizontal)
                        }
                    }
                }
                .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    private func currentWeatherCard(current: WeatherCurrent, location: WeatherResponseLocation) -> some View {
        VStack(spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(location.name ?? "")
                        .font(.title2.bold())
                    Text([location.region, location.country].compactMap { $0 }.joined(separator: ", "))
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: current.condition?.sfSymbol ?? "cloud")
                    .font(.system(size: 48))
                    .foregroundStyle(.tint)
                    .symbolRenderingMode(.multicolor)
            }

            HStack(alignment: .lastTextBaseline, spacing: 4) {
                Text(String(format: "%.0f°", current.tempF ?? 0))
                    .font(.system(size: 64, weight: .thin))
                Text("F")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                    .padding(.bottom, 8)
            }

            if let condition = current.condition?.text {
                Text(condition)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }

            Divider()

            HStack(spacing: 0) {
                weatherDetail("Feels Like", value: String(format: "%.0f°", current.feelslikeF ?? 0), symbol: "thermometer")
                Divider().frame(height: 32)
                weatherDetail("Humidity", value: "\(current.humidity ?? 0)%", symbol: "humidity")
                Divider().frame(height: 32)
                weatherDetail("Wind", value: String(format: "%.0f mph", current.windMph ?? 0), symbol: "wind")
                Divider().frame(height: 32)
                weatherDetail("UV Index", value: String(format: "%.0f", current.uv ?? 0), symbol: "sun.max")
            }
        }
        .padding(20)
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 16))
    }

    private func weatherDetail(_ label: String, value: String, symbol: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: symbol)
                .font(.callout)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.callout.bold())
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}
