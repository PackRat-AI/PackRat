import CoreLocation
import Foundation

// MARK: - Trail registry (`/api/trails/registry`)

/// A trail from PackRat's trail registry. Mirrors `TrailSummarySchema`.
struct RegistryTrail: Codable, Identifiable, Equatable, Hashable, Sendable {
    let id: String
    let name: String
    let lengthMeters: Double
    /// From the point the search was made around, when there was one.
    let distanceMeters: Double?
    /// West, south, east, north.
    let bbox: [Double]

    var tripTrail: TripTrail { TripTrail(id: id, name: name, lengthMeters: lengthMeters) }
}

/// A trail with its geometry. Mirrors `TrailDetailSchema`; `lines` holds one
/// encoded polyline per part of the trail.
struct RegistryTrailDetail: Codable, Equatable, Sendable {
    let id: String
    let name: String
    let lengthMeters: Double
    let bbox: [Double]
    let lines: [String]

    var parts: [[CLLocationCoordinate2D]] { lines.map(Polyline.decode).filter { $0.count >= 2 } }
}

/// A trail a recorded route walked along. Mirrors `TrailMatchSchema`.
struct TrailMatch: Codable, Identifiable, Equatable, Sendable {
    let id: String
    let name: String
    let lengthMeters: Double
    let bbox: [Double]
    /// Share of the trail's length the route covers, 0–1.
    let coverage: Double

    var tripTrail: TripTrail { TripTrail(id: id, name: name, lengthMeters: lengthMeters) }
}

final class TrailRegistryService: Sendable {
    static let shared = TrailRegistryService()
    private let api: APIClient
    private let details = TrailDetailCache()

    init(api: APIClient = .shared) { self.api = api }

    /// Trails by name, around a point, or both.
    func search(query: String? = nil, near point: CLLocationCoordinate2D? = nil) async throws -> [RegistryTrail] {
        var params: [String: String?] = [:]
        if let query, !query.isEmpty { params["q"] = query }
        if let point {
            params["lat"] = String(point.latitude)
            params["lon"] = String(point.longitude)
        }
        return try await api.send(Endpoint(.get, "/api/trails/registry/search", query: params))
    }

    /// One trail with its geometry. Trails don't change within a session, so
    /// answers are kept in memory.
    func trail(id: String) async throws -> RegistryTrailDetail {
        if let hit = await details.detail(for: id) { return hit }
        let detail: RegistryTrailDetail = try await api.send(Endpoint(.get, "/api/trails/registry/\(id)"))
        await details.store(detail)
        return detail
    }

    /// The trails a route walked along, best covered first.
    func match(route: String) async throws -> [TrailMatch] {
        try await api.send(Endpoint(.post, "/api/trails/registry/match", body: TrailMatchRequest(route: route)))
    }
}

private struct TrailMatchRequest: Encodable {
    let route: String
}

private actor TrailDetailCache {
    private static let capacity = 30
    private var entries: [String: RegistryTrailDetail] = [:]
    private var order: [String] = []

    func detail(for id: String) -> RegistryTrailDetail? { entries[id] }

    func store(_ detail: RegistryTrailDetail) {
        if entries[detail.id] == nil { order.append(detail.id) }
        entries[detail.id] = detail
        while order.count > Self.capacity { entries[order.removeFirst()] = nil }
    }
}
