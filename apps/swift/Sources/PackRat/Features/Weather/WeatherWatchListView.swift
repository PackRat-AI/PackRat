import SwiftUI

/// Manages the explicit-opt-in watch list for proactive weather alerts.
/// A plain List with swipe-to-delete and a toolbar add button — the
/// Reminders/Alarms idiom for "a list of things you're tracking", not
/// Apple Weather's horizontal-paging carousel, which is a browsing UI for a
/// different concern (viewing each location's forecast).
struct WeatherWatchListView: View {
    @Bindable var viewModel: WeatherViewModel
    @State private var isAddingLocation = false

    var body: some View {
        Group {
            if viewModel.isLoadingWatchedLocations && viewModel.watchedLocations.isEmpty {
                ProgressView("Loading watch list…")
            } else if viewModel.watchedLocations.isEmpty {
                UnavailableStateView(
                    title: "No Watched Locations",
                    subtitle: "Add a location to get notified when a hazard alert is issued for it.",
                    systemImage: "bell.slash"
                )
            } else {
                List {
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
        .navigationTitle("Weather Alerts Watch List")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    isAddingLocation = true
                } label: {
                    Label("Add Location", systemImage: "plus")
                }
                .accessibilityIdentifier("weather_watch_list_add_button")
            }
        }
        .sheet(isPresented: $isAddingLocation) {
            WatchListAddLocationView(viewModel: viewModel)
        }
        .task { await viewModel.loadWatchedLocations() }
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
