import Foundation
import Observation

@Observable
final class TripsViewModel {
    var trips: [Trip] = []
    var isLoading = false
    var error: String?
    var searchText = ""

    private let service: TripService

    init(service: TripService = .shared) {
        self.service = service
    }

    var filteredTrips: [Trip] {
        guard !searchText.isEmpty else { return trips }
        return trips.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
            || ($0.description?.localizedCaseInsensitiveContains(searchText) ?? false)
            || ($0.location?.name?.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }

    var upcomingTrips: [Trip] {
        trips.filter { trip in
            guard let dateStr = trip.startDate,
                  let date = ISO8601DateFormatter().date(from: dateStr)
            else { return false }
            return date >= Calendar.current.startOfDay(for: Date())
        }.sorted {
            guard let a = $0.startDate, let b = $1.startDate else { return false }
            return a < b
        }
    }

    var pastTrips: [Trip] {
        trips.filter { trip in
            guard let dateStr = trip.startDate,
                  let date = ISO8601DateFormatter().date(from: dateStr)
            else { return true }
            return date < Calendar.current.startOfDay(for: Date())
        }
    }

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            trips = try await service.listTrips()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func createTrip(name: String, description: String?, startDate: Date?, endDate: Date?, location: TripLocationBody?, notes: String?, packId: String?) async throws {
        let trip = try await service.createTrip(
            name: name, description: description,
            startDate: startDate, endDate: endDate,
            location: location, notes: notes, packId: packId
        )
        trips.insert(trip, at: 0)
    }

    func updateTrip(_ tripId: String, name: String, description: String?, startDate: Date?, endDate: Date?, location: TripLocationBody?, notes: String?, packId: String?) async throws {
        let updated = try await service.updateTrip(
            tripId, name: name, description: description,
            startDate: startDate, endDate: endDate,
            location: location, notes: notes, packId: packId
        )
        if let idx = trips.firstIndex(where: { $0.id == tripId }) {
            trips[idx] = updated
        }
    }

    func deleteTrip(_ tripId: String) async throws {
        try await service.deleteTrip(tripId)
        trips.removeAll { $0.id == tripId }
    }
}
