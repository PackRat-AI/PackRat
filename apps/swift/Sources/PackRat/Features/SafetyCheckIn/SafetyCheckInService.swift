import Foundation

final class SafetyCheckInService: Sendable {
    static let shared = SafetyCheckInService()
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    // MARK: Emergency contacts

    func listContacts() async throws -> [EmergencyContact] {
        try await api.send(Endpoint(.get, "/api/emergency-contacts"))
    }

    func createContact(_ request: CreateEmergencyContactRequest) async throws -> EmergencyContact {
        try await api.send(Endpoint(.post, "/api/emergency-contacts", body: request))
    }

    func updateContact(_ id: String, _ request: UpdateEmergencyContactRequest) async throws -> EmergencyContact {
        try await api.send(Endpoint(.put, "/api/emergency-contacts/\(id)", body: request))
    }

    func deleteContact(_ id: String) async throws {
        try await api.sendDiscarding(Endpoint(.delete, "/api/emergency-contacts/\(id)"))
    }

    // MARK: Check-ins

    func activeCheckIn(tripId: String) async throws -> SafetyCheckInResponse? {
        let response: ActiveSafetyCheckInResponse = try await api.send(
            Endpoint(.get, "/api/trips/\(tripId)/check-in")
        )
        return response.checkIn
    }

    func start(tripId: String, _ request: StartSafetyCheckInRequest) async throws -> SafetyCheckInResponse {
        try await api.send(Endpoint(.post, "/api/trips/\(tripId)/check-in", body: request))
    }

    func extend(checkInId: String, to date: Date) async throws -> SafetyCheckInResponse {
        try await api.send(Endpoint(
            .post, "/api/safety-check-ins/\(checkInId)/extend",
            body: ExtendSafetyCheckInRequest(expectedReturnAt: date.iso8601String())
        ))
    }

    func end(checkInId: String, outcome: SafetyCheckInOutcome, at date: Date) async throws -> SafetyCheckInResponse {
        try await api.send(Endpoint(
            .post, "/api/safety-check-ins/\(checkInId)/\(outcome.rawValue)",
            body: EndSafetyCheckInRequest(endedAt: date.iso8601String())
        ))
    }

    func uploadLocations(checkInId: String, _ locations: [SafetyLocationInput]) async throws {
        try await api.sendDiscarding(Endpoint(
            .post, "/api/safety-check-ins/\(checkInId)/locations",
            body: UploadSafetyLocationsRequest(locations: locations)
        ))
    }
}
