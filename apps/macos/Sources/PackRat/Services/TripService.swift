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
        let formatter = ISO8601DateFormatter()
        let now = formatter.string(from: Date())
        let body = CreateTripRequest(
            id: UUID().uuidString.lowercased(),
            name: name,
            description: description,
            location: location,
            startDate: startDate.map { formatter.string(from: $0) },
            endDate: endDate.map { formatter.string(from: $0) },
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
        let formatter = ISO8601DateFormatter()
        let body = UpdateTripRequest(
            name: name,
            description: description,
            location: location,
            startDate: startDate.map { formatter.string(from: $0) },
            endDate: endDate.map { formatter.string(from: $0) },
            notes: notes,
            packId: packId,
            localUpdatedAt: formatter.string(from: Date())
        )
        let endpoint = Endpoint(.put, "/api/trips/\(tripId)", body: body)
        return try await api.send(endpoint)
    }

    func deleteTrip(_ tripId: String) async throws {
        let endpoint = Endpoint(.delete, "/api/trips/\(tripId)")
        try await api.sendDiscarding(endpoint)
    }
}
