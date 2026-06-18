import SwiftUI
import SwiftData

struct TripsListView: View {
    @Bindable var viewModel: TripsViewModel
    @Binding var selectedId: String?
    @State private var showingCreateSheet = false
    @State private var needsRefresh = false
    @Environment(\.modelContext) private var modelContext
    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    private var isCompact: Bool { horizontalSizeClass == .compact }
    #else
    private var isCompact: Bool { false }
    #endif

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.trips.isEmpty {
                ProgressView("Loading trips…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.error, viewModel.trips.isEmpty {
                ErrorView(error, retry: { await viewModel.load(context: modelContext) })
                    .accessibilityIdentifier("trips_error_state")
            } else if viewModel.trips.isEmpty {
                EmptyStateView(
                    "No Trips Yet",
                    subtitle: "Plan your first adventure",
                    systemImage: "map",
                    actionLabel: "Plan Trip",
                    accessibilityIdentifier: "trips_empty_state",
                    action: { showingCreateSheet = true }
                )
            } else {
                tripList
            }
        }
        .navigationTitle("Trips")
        .searchable(text: $viewModel.searchText, prompt: "Search trips")
        .accessibilityIdentifier("trips_screen")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Plan Trip", systemImage: "plus") { showingCreateSheet = true }
                    .accessibilityIdentifier("trips_plan_trip_button")
                    .keyboardShortcut("n", modifiers: [.command, .shift])
                    .accessibilityIdentifier("plan_trip_button")
            }
        }
        .task { await viewModel.load(context: modelContext) }
        .refreshable { await viewModel.load(context: modelContext) }
        .sheet(isPresented: $showingCreateSheet) {
            TripFormView(viewModel: viewModel)
        }
        .focusedSceneValue(\.newTripAction, $showingCreateSheet)
        .focusedSceneValue(\.refreshAction, $needsRefresh)
        .onChange(of: needsRefresh) { _, new in
            if new { Task { await viewModel.load(context: modelContext) }; needsRefresh = false }
        }
    }

    @ViewBuilder
    private var tripList: some View {
        List(selection: $selectedId) {
            if !upcomingTrips.isEmpty {
                Section("Upcoming") {
                    ForEach(upcomingTrips) { trip in
                        tripRow(trip)
                    }
                }
            }
            if !pastTrips.isEmpty {
                Section("Past") {
                    ForEach(pastTrips) { trip in
                        tripRow(trip)
                    }
                }
            }
        }
        .accessibilityIdentifier("trips_list")
    }

    private var upcomingTrips: [Trip] {
        let today = Calendar.current.startOfDay(for: Date())
        return viewModel.filteredTrips
            .filter { ($0.startDate?.toDate() ?? .distantPast) >= today }
            .sorted { ($0.startDate ?? "") < ($1.startDate ?? "") }
    }

    private var pastTrips: [Trip] {
        let today = Calendar.current.startOfDay(for: Date())
        return viewModel.filteredTrips.filter { ($0.startDate?.toDate() ?? .distantPast) < today }
    }

    @ViewBuilder
    private func tripRow(_ trip: Trip) -> some View {
        Group {
            if isCompact {
                NavigationLink {
                    TripDetailView(trip: trip, viewModel: viewModel)
                } label: {
                    TripRowView(trip: trip)
                }
            } else {
                TripRowView(trip: trip)
            }
        }
        .tag(trip.id)
        .task {
            if trip.id == viewModel.trips.last?.id {
                await viewModel.loadMore()
            }
        }
        .contextMenu {
            #if os(macOS)
            OpenWindowButton(id: "trip", value: trip.id, label: "Open in New Window")
            Divider()
            #endif
            Button("Delete", systemImage: "trash", role: .destructive) {
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
                if trip.packId != nil {
                    Label("Pack linked", systemImage: "backpack")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 2)
    }
}
