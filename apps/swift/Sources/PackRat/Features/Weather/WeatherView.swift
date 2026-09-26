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
    /// The location whose forecast is currently pushed, whether it was opened
    /// from the saved list, from a search result, or by a push notification.
    /// A single binding rather than one per entry point, so going back always
    /// returns to whatever was on screen when the forecast was opened —
    /// search results included.
    @State private var selectedLocation: WeatherLocation?
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
        // The list sits on a dark recessed surface, so the bar has to adopt
        // that surface *and* a dark scheme: a colour scheme alone leaves the
        // large title dark-on-dark. Both are pinned unconditionally rather
        // than toggled on `isAuthenticated` — a toolbar background that
        // changes identity mid-render makes the large title animate out and
        // never return, which is what made the title vanish a moment after
        // each appearance.
        .toolbarBackground(WeatherSkyGradient.ListBackground.color, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
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
        .navigationDestination(item: $selectedLocation) { location in
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
            selectedLocation = target
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
        // Search is a mode the field enters, not a state inferred from whether
        // results exist. Keying off results alone left the saved list showing
        // behind an empty query, so the screen flipped between two contents
        // while the user was still typing.
        if isSearchPresented {
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
                    // Deliberately not a NavigationLink: a link inside a List
                    // draws a disclosure caret, and the card is already a
                    // self-evident tap target. Apple's Weather list has no
                    // chevron either.
                    Button {
                        selectedLocation = location
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
                let isSaved = viewModel.savedLocations.contains { $0.id == location.id }
                HStack(spacing: 12) {
                    // Tapping the row opens the forecast without saving, so a
                    // user can look before committing. Search stays presented
                    // underneath, which is what makes Back return here rather
                    // than to the saved list.
                    Button {
                        Task { await viewModel.loadSummary(for: location) }
                        selectedLocation = location
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(location.name).font(.body)
                            if let region = location.region, let country = location.country {
                                Text("\(region), \(country)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("weather_search_result_\(location.id)")

                    // Saving is its own explicit action rather than a side
                    // effect of opening a result — the two intents are
                    // different, and inferring one from the other silently
                    // grew the user's list every time they looked something up.
                    Button {
                        viewModel.saveLocation(location)
                        Task { await viewModel.loadSummary(for: location) }
                    } label: {
                        Image(systemName: isSaved ? "checkmark.circle.fill" : "plus.circle")
                            .font(.title3)
                            .foregroundStyle(isSaved ? Color.green : Color.accentColor)
                    }
                    .buttonStyle(.plain)
                    .disabled(isSaved)
                    .accessibilityLabel(isSaved
                        ? "\(location.name) is already saved"
                        : "Save \(location.name)")
                    .accessibilityIdentifier("weather_search_save_\(location.id)")
                }
            }
        }
        .listStyle(.plain)
    }
}
