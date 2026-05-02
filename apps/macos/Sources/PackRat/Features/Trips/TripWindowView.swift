import SwiftUI

// Opened via openWindow(id: "trip", value: tripId)
struct TripWindowView: View {
    let tripId: String
    @State private var viewModel = TripsViewModel()

    private var trip: Trip? {
        viewModel.trips.first { $0.id == tripId }
    }

    var body: some View {
        Group {
            if viewModel.isLoading {
                ProgressView("Loading…")
                    .frame(minWidth: 600, minHeight: 400)
            } else if let trip {
                TripDetailView(trip: trip, viewModel: viewModel)
            } else {
                ContentUnavailableView("Trip not found", systemImage: "map")
                    .frame(minWidth: 600, minHeight: 400)
            }
        }
        .task { await viewModel.load() }
    }
}
