import Foundation

final class TrailConditionsService: Sendable {
    static let shared = TrailConditionsService()
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    /// The recent feed: everyone's latest reports, newest first, each signed
    /// with its author's first name.
    func listReports(page: Int = 1, limit: Int = 20) async throws -> [TripConditionReport] {
        let endpoint = Endpoint(.get, "/api/trail-conditions", query: [
            "page": "\(page)",
            "limit": "\(limit)",
        ])
        return try await api.send(endpoint)
    }

    /// Trails for the picker: names matching `query`, nearest to `near` first
    /// when given. With no query, the trails around `near`.
    func searchTrails(query: String?, near: (latitude: Double, longitude: Double)?, limit: Int = 20) async throws -> [TrailSummary] {
        var params: [String: String?] = ["limit": "\(limit)"]
        if let query, !query.isEmpty { params["q"] = query }
        if let near {
            params["lat"] = "\(near.latitude)"
            params["lon"] = "\(near.longitude)"
        }
        let endpoint = Endpoint(.get, "/api/trail-conditions/trails", query: params)
        let response: TrailSearchResponse = try await api.send(endpoint)
        return response.trails
    }

    /// One trail with its line, for the trail page.
    func trail(id: String) async throws -> TrailDetail {
        try await api.send(Endpoint(.get, "/api/trail-conditions/trails/\(id)"))
    }

    /// Every report on a trail, newest first, signed with the author's first name.
    func trailReports(trailId: String) async throws -> [TripConditionReport] {
        let response: TrailReportsResponse = try await api.send(
            Endpoint(.get, "/api/trail-conditions/trails/\(trailId)/reports")
        )
        return response.reports
    }

    /// The conditions section of a trip: its trail's reports, or those of
    /// trails near its destination.
    func tripConditions(tripId: String) async throws -> TripConditionsResponse {
        try await api.send(Endpoint(.get, "/api/trail-conditions/trip/\(tripId)"))
    }

    func createReport(
        trailId: String?,
        trailName: String,
        trailRegion: String?,
        latitude: Double?,
        longitude: Double?,
        surface: String?,
        overallCondition: String,
        hazards: [String],
        notes: String?,
        photos: [String] = [],
        tripId: String? = nil
    ) async throws -> TrailConditionReport {
        try await createReport(
            id: UUID().uuidString.lowercased(),
            trailId: trailId,
            trailName: trailName,
            trailRegion: trailRegion,
            latitude: latitude,
            longitude: longitude,
            surface: surface,
            overallCondition: overallCondition,
            hazards: hazards,
            notes: notes,
            photos: photos,
            tripId: tripId
        )
    }

    /// Creates a report under a caller-supplied id, for replaying a queued create whose
    /// id the device already recorded.
    func createReport(
        id: String,
        trailId: String?,
        trailName: String,
        trailRegion: String?,
        latitude: Double?,
        longitude: Double?,
        surface: String?,
        overallCondition: String,
        hazards: [String],
        notes: String?,
        photos: [String] = [],
        tripId: String? = nil,
        writtenAt: Date? = nil
    ) async throws -> TrailConditionReport {
        let now = Date.iso8601Now()
        // A replayed report keeps the time it was written, not the time it sent.
        let written = writtenAt?.iso8601String() ?? now
        let body = CreateTrailConditionRequest(
            id: id,
            trailId: trailId,
            trailName: trailName,
            trailRegion: trailRegion,
            latitude: latitude,
            longitude: longitude,
            surface: surface,
            overallCondition: overallCondition,
            hazards: hazards.isEmpty ? nil : hazards,
            notes: notes,
            photos: photos.isEmpty ? nil : photos,
            tripId: tripId,
            localCreatedAt: written,
            localUpdatedAt: written
        )
        let endpoint = Endpoint(.post, "/api/trail-conditions", body: body)
        return try await api.send(endpoint)
    }

    func deleteReport(_ id: String) async throws {
        let endpoint = Endpoint(.delete, "/api/trail-conditions/\(id)")
        try await api.sendDiscarding(endpoint)
    }

    func flagReport(_ id: String, reason: TrailReportFlagReason) async throws {
        let endpoint = Endpoint(.post, "/api/trail-conditions/\(id)/flag", body: FlagReportRequest(reason: reason))
        try await api.sendDiscarding(endpoint)
    }

    /// The user's upcoming and in-progress trips with a trail report they haven't read.
    func unreadTripIds() async throws -> [String] {
        let response: UnreadTripsResponse = try await api.send(Endpoint(.get, "/api/trail-conditions/unread-trips"))
        return response.tripIds
    }

    func markRead(_ reportIds: [String]) async throws {
        let endpoint = Endpoint(.post, "/api/trail-conditions/reads", body: MarkReadRequest(reportIds: reportIds))
        try await api.sendDiscarding(endpoint)
    }

    func notificationsEnabled() async throws -> Bool {
        let settings: TrailNotificationSettings = try await api.send(
            Endpoint(.get, "/api/trail-conditions/notification-settings")
        )
        return settings.trailConditions
    }

    func setNotificationsEnabled(_ enabled: Bool) async throws {
        let endpoint = Endpoint(
            .put,
            "/api/trail-conditions/notification-settings",
            body: TrailNotificationSettings(trailConditions: enabled)
        )
        try await api.sendDiscarding(endpoint)
    }

    /// Blocks are shared with the feed: one list of people you don't want to see.
    func blockAuthor(userId: String) async throws {
        try await FeedService.shared.block(userId: userId)
    }
}

private struct FlagReportRequest: Encodable, Sendable {
    let reason: TrailReportFlagReason
}

private struct UnreadTripsResponse: Decodable, Sendable {
    let tripIds: [String]
}

private struct MarkReadRequest: Encodable, Sendable {
    let reportIds: [String]
}

private struct TrailNotificationSettings: Codable, Sendable {
    let trailConditions: Bool
}
