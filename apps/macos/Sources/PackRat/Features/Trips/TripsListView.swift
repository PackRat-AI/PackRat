import SwiftUI

struct TripsListView: View {
    @State private var viewModel = TripsViewModel()
    @State private var selectedTripId: String?
    @State private var showingCreateSheet = false

    var body: some View {
        NavigationSplitView {
            sidebarContent
        } detail: {
            if let id = selectedTripId, let trip = viewModel.trips.first(where: { $0.id == id }) {
                TripDetailView(trip: trip, viewModel: viewModel)
            } else {
                EmptyStateView(
                    "Select a Trip",
                    subtitle: "Choose a trip from the list or plan a new one",
                    systemImage: "map",
                    actionLabel: "Plan Trip",
                    action: { showingCreateSheet = true }
                )
            }
        }
        .task { await viewModel.load() }
        .sheet(isPresented: $showingCreateSheet) {
            TripFormView(viewModel: viewModel)
        }
    }

    private var sidebarContent: some View {
        Group {
            if viewModel.isLoading && viewModel.trips.isEmpty {
                ProgressView("Loading trips...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.error {
                ErrorView(error, retry: { await viewModel.load() })
            } else if viewModel.trips.isEmpty {
                EmptyStateView(
                    "No Trips Yet",
                    subtitle: "Plan your first adventure",
                    systemImage: "map",
                    actionLabel: "Plan Trip",
                    action: { showingCreateSheet = true }
                )
            } else {
                tripList
            }
        }
        .navigationTitle("Trips")
        .searchable(text: $viewModel.searchText, prompt: "Search trips")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Plan Trip", systemImage: "plus") {
                    showingCreateSheet = true
                }
            }
        }
        .refreshable { await viewModel.load() }
    }

    @ViewBuilder
    private var tripList: some View {
        List(selection: $selectedTripId) {
            if !viewModel.upcomingTrips.isEmpty {
                Section("Upcoming") {
                    ForEach(viewModel.upcomingTrips) { trip in
                        TripRowView(trip: trip).tag(trip.id)
                    }
                    .onDelete { indexSet in
                        let ids = indexSet.compactMap { viewModel.upcomingTrips[$0].id as String? }
                        for id in ids { Task { try? await viewModel.deleteTrip(id) } }
                    }
                }
            }
            if !viewModel.pastTrips.isEmpty {
                Section("Past") {
                    ForEach(viewModel.pastTrips) { trip in
                        TripRowView(trip: trip).tag(trip.id)
                    }
                    .onDelete { indexSet in
                        let ids = indexSet.compactMap { viewModel.pastTrips[$0].id as String? }
                        for id in ids { Task { try? await viewModel.deleteTrip(id) } }
                    }
                }
            }
        }
    }
}

private struct TripRowView: View {
    let trip: Trip

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(trip.name).font(.headline)
            HStack(spacing: 8) {
                if let loc = trip.location?.name {
                    Label(loc, systemImage: "mappin")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if !trip.dateRange.isEmpty {
                    Label(trip.dateRange, systemImage: "calendar")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 2)
        .contextMenu {
            Button("Delete", role: .destructive, systemImage: "trash") {
                Task { try? await TripsViewModel().deleteTrip(trip.id) }
            }
        }
    }
}
