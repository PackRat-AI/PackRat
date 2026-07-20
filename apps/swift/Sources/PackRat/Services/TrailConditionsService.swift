import Foundation

final class TrailConditionsService: Sendable {
    static let shared = TrailConditionsService()
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    func listReports(page: Int = 1, limit: Int = 20) async throws -> [TrailConditionReport] {
        let endpoint = Endpoint(.get, "/api/trail-conditions", query: [
            "page": "\(page)",
            "limit": "\(limit)",
        ])
        return try await api.send(endpoint)
    }

    func createReport(
        trailName: String,
        trailRegion: String?,
        surface: String?,
        overallCondition: String,
        hazards: [String],
        notes: String?
    ) async throws -> TrailConditionReport {
        let now = Date.iso8601Now()
        let body = CreateTrailConditionRequest(
            id: UUID().uuidString.lowercased(),
            trailName: trailName,
            trailRegion: trailRegion,
            surface: surface,
            overallCondition: overallCondition,
            hazards: hazards.isEmpty ? nil : hazards,
            notes: notes,
            localCreatedAt: now,
            localUpdatedAt: now
        )
        let endpoint = Endpoint(.post, "/api/trail-conditions", body: body)
        return try await api.send(endpoint)
    }

    func deleteReport(_ id: String) async throws {
        let endpoint = Endpoint(.delete, "/api/trail-conditions/\(id)")
        try await api.sendDiscarding(endpoint)
    }
}
