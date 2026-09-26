import SwiftUI

/// The Weather list: every saved location as a card, each one a way into that
/// location's own forecast screen.
///
/// This screen used to be the list *and* the search *and* the forecast for
/// whichever location happened to be selected, which is why its navigation bar
/// accumulated four competing controls — two of them bells meaning different
/// things. Splitting the forecast onto `LocationForecastView` leaves this
/// screen with one job, so its navigation bar carries only list-level actions,
/// collected in a single overflow menu.
struct WeatherView: View {
    @Environment(AuthManager.self) private var authManager
    @Bindable var viewModel: WeatherViewModel
    @State private var isSearchPresented = false
    @State private var isEditing = false
    @State private var showingAlertPreferences = false
    @State private var path: [WeatherLocation] = []
    @AppStorage("temperatureUnit") private var temperatureUnit: AppPreferences.TemperatureUnit = .fahrenheit

    var body: some View {
        Group {
            if !authManager.isAuthenticated {
                GuestLimitedView(
                    "Sign In for Weather",
                    subtitle: "Forecasts and alerts for where you are heading. Your packs and trips stay on this device and keep working without an account.",
                    systemImage: "cloud.sun"
                )
            } else {
                locationList
            }
        }
        .navigationTitle("Weather")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.large)
        #endif
        .searchable(
            text: $viewModel.searchText,
            isPresented: $isSearchPresented,
            placement: searchPlacement,
            prompt: "Search for a city or place"
        )
        .onChange(of: viewModel.searchText) {
            if authManager.isAuthenticated {
                viewModel.onSearchTextChanged()
            }
        }
        .toolbar {
            if authManager.isAuthenticated {
                ToolbarItem(placement: overflowPlacement) {
                    overflowMenu
                }
            }
        }
        .navigationDestination(for: WeatherLocation.self) { location in
            LocationForecastView(location: location, viewModel: viewModel)
        }
        .sheet(isPresented: $showingAlertPreferences) {
            NavigationStack {
                WeatherAlertPreferencesView()
            }
        }
        .task {
            guard authManager.isAuthenticated else { return }
            await viewModel.loadWatchedLocations()
            await viewModel.loadMissingLocationSummaries()
        }
        .task(id: viewModel.pendingAlertDeepLinkLocationId) {
            // A push tap names a location; push its forecast screen, which
            // then opens the alert detail itself.
            guard let locationId = viewModel.pendingAlertDeepLinkLocationId else { return }
            let target = viewModel.savedLocations.first { $0.id == locationId }
                ?? viewModel.watchedLocations
                    .first { $0.weatherLocationId == locationId }
                    .map { watched in
                        WeatherLocation(
                            id: watched.weatherLocationId,
                            name: watched.locationName,
                            region: watched.region,
                            country: watched.country,
                            lat: watched.lat,
                            lon: watched.lon
                        )
                    }
            guard let target else { return }
            if path.last?.id != target.id {
                path.append(target)
            }
        }
    }

    /// `WeatherView` is hosted inside the app's existing navigation container
    /// on some layouts and needs its own stack on others. Binding the path
    /// here keeps deep links working in both.
    var navigationPath: Binding<[WeatherLocation]> { $path }

    private var searchPlacement: SearchFieldPlacement {
        #if os(iOS)
        // Apple puts the Weather search field at the bottom of the list, in
        // thumb reach, rather than under the title.
        .navigationBarDrawer(displayMode: .always)
        #else
        .automatic
        #endif
    }

    private var overflowPlacement: ToolbarItemPlacement {
        #if os(iOS)
        .topBarTrailing
        #else
        .primaryAction
        #endif
    }

    // MARK: - Overflow menu

    /// Every list-level action, in one menu — the arrangement Apple Weather
    /// uses. Per-location actions deliberately do not appear here; they live
    /// on the location's own screen, where "this location" has a referent.
    private var overflowMenu: some View {
        Menu {
            Button {
                withAnimation { isEditing.toggle() }
            } label: {
                Label(isEditing ? "Done" : "Edit List", systemImage: "pencil")
            }
            .disabled(viewModel.savedLocations.isEmpty)

            Button {
                showingAlertPreferences = true
            } label: {
                Label("Notifications", systemImage: "bell.badge")
            }
            .accessibilityIdentifier("weather_alert_preferences_button")

            if AppFeatureFlags.enableWeatherMonitoring {
                NavigationLink {
                    WeatherWatchListView(viewModel: viewModel)
                } label: {
                    Label("Watch List", systemImage: "eye")
                }
                .accessibilityIdentifier("weather_watch_list_button")
            }

            Divider()

            Picker("Temperature", selection: $temperatureUnit) {
                Text("Celsius").tag(AppPreferences.TemperatureUnit.celsius)
                Text("Fahrenheit").tag(AppPreferences.TemperatureUnit.fahrenheit)
            }
        } label: {
            Label("More", systemImage: "ellipsis.circle")
        }
        .accessibilityLabel("More")
        .accessibilityIdentifier("weather_more_menu_button")
    }

    // MARK: - List

    @ViewBuilder
    private var locationList: some View {
        if !viewModel.searchResults.isEmpty || viewModel.isSearching || viewModel.searchError != nil {
            searchResultsList
        } else if viewModel.savedLocations.isEmpty {
            EmptyStateView(
                "No Saved Locations",
                subtitle: "Search for a city or place to see its forecast and get hazard alerts.",
                systemImage: "cloud.sun"
            )
        } else {
            List {
                ForEach(viewModel.savedLocations) { location in
                    Button {
                        path.append(location)
                    } label: {
                        WeatherLocationCard(
                            location: location,
                            summary: viewModel.locationSummaries[location.id],
                            isWatched: viewModel.watchedLocations.contains {
                                $0.weatherLocationId == location.id
                            },
                            temperatureUnit: temperatureUnit
                        )
                    }
                    .buttonStyle(.plain)
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            viewModel.removeLocation(location)
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                }
                .onDelete { offsets in
                    for index in offsets {
                        viewModel.removeLocation(viewModel.savedLocations[index])
                    }
                }
                .onMove { source, destination in
                    viewModel.moveLocations(fromOffsets: source, toOffset: destination)
                }
            }
            .listStyle(.plain)
            .environment(\.editMode, .constant(isEditing ? .active : .inactive))
            .refreshable { await viewModel.refreshAllLocationSummaries() }
        }
    }

    private var searchResultsList: some View {
        List {
            if viewModel.isSearching {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text("Searching…")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            if let error = viewModel.searchError {
                InlineErrorView(message: error)
                    .listRowSeparator(.hidden)
            }

            ForEach(viewModel.searchResults) { location in
                Button {
                    viewModel.saveLocation(location)
                    viewModel.searchText = ""
                    isSearchPresented = false
                    Task { await viewModel.loadSummary(for: location) }
                    path.append(location)
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(location.name).font(.body)
                            if let region = location.region, let country = location.country {
                                Text("\(region), \(country)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        if viewModel.savedLocations.contains(where: { $0.id == location.id }) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(Color.green)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("weather_search_result_\(location.id)")
            }
        }
        .listStyle(.plain)
    }
}
