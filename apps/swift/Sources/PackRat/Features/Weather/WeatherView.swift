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
    /// The location a push notification asked us to open. Bound to a
    /// `navigationDestination(item:)` so a deep link can push the forecast
    /// screen without this view owning the host stack's path.
    @State private var deepLinkedLocation: WeatherLocation?
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
        // The list sits on a dark recessed surface. The bar has to adopt that
        // surface and a dark scheme together — a colour scheme alone leaves
        // the large title dark-on-dark, since the bar keeps its own default
        // background behind it.
        .toolbarBackground(
            authManager.isAuthenticated ? WeatherSkyGradient.ListBackground.color : Color.clear,
            for: .navigationBar
        )
        .toolbarBackground(authManager.isAuthenticated ? .visible : .automatic, for: .navigationBar)
        .toolbarColorScheme(authManager.isAuthenticated ? .dark : nil, for: .navigationBar)
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
        .navigationDestination(item: $deepLinkedLocation) { location in
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
            deepLinkedLocation = target
        }
    }

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
                    // A destination-based link rather than a path append:
                    // WeatherView is hosted inside whichever NavigationStack
                    // the current layout provides (the phone home stack, a tab
                    // stack, or the split view's column), none of which route
                    // a path this screen owns.
                    NavigationLink {
                        LocationForecastView(location: location, viewModel: viewModel)
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
            .scrollContentBackground(.hidden)
            // The cards carry their own sky, so they need a recessed surface
            // behind them to read as raised. On the system background they
            // float on white and the screen loses its depth.
            .background(WeatherSkyGradient.ListBackground.color.ignoresSafeArea())
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
                    deepLinkedLocation = location
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
