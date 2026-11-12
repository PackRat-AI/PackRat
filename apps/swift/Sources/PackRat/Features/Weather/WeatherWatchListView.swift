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
    /// The account-level Trip Weather Alerts setting; nil until it loads.
    @State private var tripAlertsOn: Bool?
    @State private var turnOnFailed = false

    /// Trips watching their destination right now. They belong to the trip,
    /// not the list, so they end on their own; docs/features/trip-weather.md
    /// ("Watching the destination").
    /// Watching saved places is its own feature; with only trip weather on,
    /// the list holds trips alone.
    private var showsLocations: Bool { AppFeatureFlags.enableWeatherMonitoring }

    private var tripWeatherOn: Bool { FeatureFlagStore.shared.isEnabled(TripWeatherSection.flagKey) }

    /// Switching a trip off keeps it here, marked off; only leaving its
    /// window takes it out.
    private var watchedTrips: [Trip] {
        guard tripAlertsOn == true else { return [] }
        return TripWeatherPlan.tripsInWatchWindow(appState.tripsVM.trips, now: Date())
    }

    private var isLoading: Bool {
        (viewModel.isLoadingWatchedLocations && viewModel.watchedLocations.isEmpty)
            || (tripWeatherOn && tripAlertsOn == nil)
    }

    var body: some View {
        Group {
            if isLoading && watchedTrips.isEmpty {
                ProgressView("Loading watch list…")
            } else if viewModel.watchedLocations.isEmpty && watchedTrips.isEmpty {
                emptyState
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
                                    let isOn = trip.sendsWeatherAlerts
                                    Button {
                                        Task {
                                            await appState.tripsVM.setWeatherAlerts(
                                                !isOn, for: trip.id, context: modelContext
                                            )
                                        }
                                    } label: {
                                        Label(isOn ? "Turn Off" : "Turn On",
                                              systemImage: isOn ? "bell.slash" : "bell")
                                    }
                                    .tint(isOn ? .indigo : .blue)
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
        .alert("Alerts Couldn't Be Turned On", isPresented: $turnOnFailed) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Check your connection and try again.")
        }
        .task { await viewModel.loadWatchedLocations() }
        .task { await loadTripWatches() }
    }

    @ViewBuilder
    private var emptyState: some View {
        if tripWeatherOn && tripAlertsOn == false {
            UnavailableStateView(
                title: "Trip Weather Alerts Are Off",
                subtitle: "Turn them on to get alerts for weather at your trip destinations.",
                systemImage: "bell.slash",
                accessibilityIdentifier: "weather_watch_list_trip_alerts_off"
            ) {
                Button("Turn On Alerts") {
                    Task { await turnOnTripAlerts() }
                }
                .buttonStyle(.borderedProminent)
            }
        } else if showsLocations {
            UnavailableStateView(
                title: "No Watched Locations",
                subtitle: "Add a location to get notified when a hazard alert is issued for it.",
                systemImage: "bell.slash"
            ) {
                Button("Add Location") { isAddingLocation = true }
                    .buttonStyle(.borderedProminent)
            }
        } else {
            UnavailableStateView(
                title: "No Trips Being Watched",
                subtitle: "Trips with a destination appear here 3 days before they start.",
                systemImage: "suitcase",
                accessibilityIdentifier: "weather_watch_list_empty"
            )
        }
    }

    private func loadTripWatches() async {
        guard tripWeatherOn else { return }
        if appState.tripsVM.trips.isEmpty { await appState.tripsVM.load(context: modelContext) }
        tripAlertsOn = (try? await WeatherMonitoringService.shared.tripAlertsEnabled()) ?? false
    }

    private func turnOnTripAlerts() async {
        do {
            try await WeatherMonitoringService.shared.setTripAlertsEnabled(true)
            tripAlertsOn = true
        } catch {
            turnOnFailed = true
        }
    }
}

private struct WatchedTripRow: View {
    let trip: Trip

    private var endDate: String? {
        (trip.endDate ?? trip.startDate)?.toDate()?.formatted(.dateTime.month(.abbreviated).day())
    }

    var body: some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(trip.name)
                    .font(.body)
                Text([trip.location?.name, endDate.map { "Ends \($0)" }].compactMap { $0 }.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if !trip.sendsWeatherAlerts {
                Label("Alerts off", systemImage: "bell.slash")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
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
