import SwiftUI

struct TripsListView: View {
    let viewModel: TripsViewModel
    @Binding var selectedId: String?
    @State private var showingCreateSheet = false

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.trips.isEmpty {
                ProgressView("Loading trips…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.error, viewModel.trips.isEmpty {
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
                Button("Plan Trip", systemImage: "plus") { showingCreateSheet = true }
            }
        }
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
        .sheet(isPresented: $showingCreateSheet) {
            TripFormView(viewModel: viewModel)
        }
    }

    @ViewBuilder
    private var tripList: some View {
        List(selection: $selectedId) {
            if !viewModel.upcomingTrips.isEmpty {
                Section("Upcoming") {
                    ForEach(viewModel.upcomingTrips) { trip in
                        tripRow(trip)
                    }
                }
            }
            if !viewModel.pastTrips.isEmpty {
                Section("Past") {
                    ForEach(viewModel.pastTrips) { trip in
                        tripRow(trip)
                    }
                }
            }
        }
        .navigationDestination(for: String.self) { id in
            if let trip = viewModel.trips.first(where: { $0.id == id }) {
                TripDetailView(trip: trip, viewModel: viewModel)
            }
        }
    }

    private func tripRow(_ trip: Trip) -> some View {
        NavigationLink(value: trip.id) {
            TripRowView(trip: trip)
        }
        .tag(trip.id)
        .contextMenu {
            Button("Delete", role: .destructive, systemImage: "trash") {
                Task { try? await viewModel.deleteTrip(trip.id) }
            }
        }
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) {
                Task { try? await viewModel.deleteTrip(trip.id) }
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }
}

private struct TripRowView: View {
    let trip: Trip

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(trip.name).font(.headline)
            HStack(spacing: 10) {
                if let loc = trip.location?.name {
                    Label(loc, systemImage: "mappin")
                        .font(.caption).foregroundStyle(.secondary)
                }
                if !trip.dateRange.isEmpty {
                    Label(trip.dateRange, systemImage: "calendar")
                        .font(.caption).foregroundStyle(.secondary)
                }
                if let packName = trip.pack?.name {
                    Label(packName, systemImage: "backpack")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 2)
    }
}
