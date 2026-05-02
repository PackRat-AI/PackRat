import Foundation

final class TripService: Sendable {
    static let shared = TripService()
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    func listTrips(page: Int = 1, limit: Int = 30) async throws -> [Trip] {
        let endpoint = Endpoint(.get, "/api/trips", query: ["page": "\(page)", "limit": "\(limit)"])
        return try await api.send(endpoint)
    }

    func createTrip(
        name: String,
        description: String? = nil,
        startDate: Date? = nil,
        endDate: Date? = nil,
        location: TripLocationBody? = nil,
        notes: String? = nil,
        packId: String? = nil
    ) async throws -> Trip {
        let now = Date.iso8601Now()
        let body = CreateTripRequest(
            id: UUID().uuidString.lowercased(),
            name: name,
            description: description,
            location: location,
            startDate: startDate.map { $0.iso8601String() },
            endDate: endDate.map { $0.iso8601String() },
            notes: notes,
            packId: packId,
            localCreatedAt: now,
            localUpdatedAt: now
        )
        let endpoint = Endpoint(.post, "/api/trips", body: body)
        return try await api.send(endpoint)
    }

    func updateTrip(
        _ tripId: String,
        name: String? = nil,
        description: String? = nil,
        startDate: Date? = nil,
        endDate: Date? = nil,
        location: TripLocationBody? = nil,
        notes: String? = nil,
        packId: String? = nil
    ) async throws -> Trip {
        let body = UpdateTripRequest(
            name: name,
            description: description,
            location: location,
            startDate: startDate.map { $0.iso8601String() },
            endDate: endDate.map { $0.iso8601String() },
            notes: notes,
            packId: packId,
            localUpdatedAt: Date.iso8601Now()
        )
        let endpoint = Endpoint(.put, "/api/trips/\(tripId)", body: body)
        return try await api.send(endpoint)
    }

    func deleteTrip(_ tripId: String) async throws {
        let endpoint = Endpoint(.delete, "/api/trips/\(tripId)")
        try await api.sendDiscarding(endpoint)
    }
}
