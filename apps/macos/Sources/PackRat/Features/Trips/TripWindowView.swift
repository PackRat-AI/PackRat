import SwiftUI

// Opened via openWindow(id: "trip", value: tripId)
// Creates its own AppState so TripDetailView's @Environment(AppState.self) resolves
struct TripWindowView: View {
    let tripId: String
    @State private var appState = AppState()

    private var trip: Trip? {
        appState.tripsVM.trips.first { $0.id == tripId }
    }

    var body: some View {
        Group {
            if appState.tripsVM.isLoading {
                ProgressView("Loading…")
                    .frame(minWidth: 600, minHeight: 400)
            } else if let trip {
                TripDetailView(trip: trip, viewModel: appState.tripsVM)
            } else {
                ContentUnavailableView("Trip not found", systemImage: "map")
                    .frame(minWidth: 600, minHeight: 400)
            }
        }
        .environment(appState)
        .task {
            await appState.tripsVM.load()
            await appState.packsVM.load()
        }
    }
}
