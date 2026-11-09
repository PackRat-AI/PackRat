import SwiftUI

/// Manages the explicit-opt-in watch list for proactive weather alerts.
/// A plain List with swipe-to-delete and a toolbar add button — the
/// Reminders/Alarms idiom for "a list of things you're tracking", not
/// Apple Weather's horizontal-paging carousel, which is a browsing UI for a
/// different concern (viewing each location's forecast).
struct WeatherWatchListView: View {
    @Bindable var viewModel: WeatherViewModel
    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext
    @State private var isAddingLocation = false
    @State private var tripAlertsOn = false

    /// Trips watching their destination right now. They belong to the trip,
    /// not the list, so they end on their own; docs/features/trip-weather.md
    /// ("Watching the destination").
    /// Watching saved places is its own feature; with only trip weather on,
    /// the list holds trips alone.
    private var showsLocations: Bool { AppFeatureFlags.enableWeatherMonitoring }

    private var watchedTrips: [Trip] {
        guard tripAlertsOn else { return [] }
        return TripWeatherPlan.watchedTrips(appState.tripsVM.trips, now: Date())
    }

    var body: some View {
        Group {
            if viewModel.isLoadingWatchedLocations && viewModel.watchedLocations.isEmpty && watchedTrips.isEmpty {
                ProgressView("Loading watch list…")
            } else if viewModel.watchedLocations.isEmpty && watchedTrips.isEmpty {
                if showsLocations {
                    UnavailableStateView(
                        title: "No Watched Locations",
                        subtitle: "Add a location to get notified when a hazard alert is issued for it.",
                        systemImage: "bell.slash"
                    )
                } else {
                    UnavailableStateView(
                        title: "No Trips Being Watched",
                        subtitle: "Each trip with a destination is watched for weather alerts from 3 days before it starts.",
                        systemImage: "bell.slash"
                    )
                }
            } else {
                List {
                    if !watchedTrips.isEmpty {
                        Section("Trips") {
                            ForEach(watchedTrips) { trip in
                                NavigationLink {
                                    TripDetailView(trip: trip, viewModel: appState.tripsVM)
                                } label: {
                                    WatchedTripRow(trip: trip)
                                }
                                .swipeActions(edge: .trailing) {
                                    Button(role: .destructive) {
                                        Task {
                                            await appState.tripsVM.setWeatherAlerts(
                                                false, for: trip.id, context: modelContext
                                            )
                                        }
                                    } label: {
                                        Label("Turn Off", systemImage: "bell.slash")
                                    }
                                }
                                .accessibilityIdentifier("weather_watch_list_trip_\(trip.id)")
                            }
                        }
                    }
                    if showsLocations {
                        Section(watchedTrips.isEmpty ? "" : "Locations") {
                            ForEach(viewModel.watchedLocations) { location in
                                WatchedLocationRow(location: location)
                                    .swipeActions(edge: .trailing) {
                                        Button(role: .destructive) {
                                            Task { await viewModel.unwatchLocation(location) }
                                        } label: {
                                            Label("Remove", systemImage: "trash")
                                        }
                                    }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Weather Alerts Watch List")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            if showsLocations {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        isAddingLocation = true
                    } label: {
                        Label("Add Location", systemImage: "plus")
                    }
                    .accessibilityIdentifier("weather_watch_list_add_button")
                }
            }
        }
        .sheet(isPresented: $isAddingLocation) {
            WatchListAddLocationView(viewModel: viewModel)
        }
        .task { await viewModel.loadWatchedLocations() }
        .task { await loadTripWatches() }
    }

    private func loadTripWatches() async {
        guard FeatureFlagStore.shared.isEnabled(TripWeatherSection.flagKey) else { return }
        if appState.tripsVM.trips.isEmpty { await appState.tripsVM.load(context: modelContext) }
        tripAlertsOn = (try? await WeatherMonitoringService.shared.tripAlertsEnabled()) ?? false
    }
}

private struct WatchedTripRow: View {
    let trip: Trip

    private var endDate: String? {
        (trip.endDate ?? trip.startDate)?.toDate()?.formatted(.dateTime.month(.abbreviated).day())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(trip.name)
                .font(.body)
            Text([trip.location?.name, endDate.map { "Ends \($0)" }].compactMap { $0 }.joined(separator: " · "))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}

private struct WatchedLocationRow: View {
    let location: WatchedLocation

    var body: some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(location.locationName)
                    .font(.body)
                if let region = location.region, !region.isEmpty {
                    let country = location.country?.isEmpty == false ? location.country : nil
                    Text([region, country].compactMap { $0 }.joined(separator: ", "))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
        }
        .padding(.vertical, 2)
    }
}

private struct WatchListAddLocationView: View {
    @Bindable var viewModel: WeatherViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(viewModel.searchResults) { (result: WeatherLocation) in
                    Button {
                        Task {
                            await viewModel.watchLocation(result)
                            dismiss()
                        }
                    } label: {
                        Text(result.displayName)
                    }
                }
            }
            .searchable(text: $viewModel.searchText, prompt: "Search for a location")
            .onChange(of: viewModel.searchText) { _, _ in
                viewModel.onSearchTextChanged()
            }
            .navigationTitle("Add Location")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}
