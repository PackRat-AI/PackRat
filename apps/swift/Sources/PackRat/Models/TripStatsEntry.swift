import Foundation

/// A park visit or summit added by hand, for an outing from before the user
/// had PackRat. Mirrors `TripStatsEntrySchema` in
/// `packages/schemas/src/tripStats.ts`. Visits and summits from trips aren't
/// entries: they come from the trip's location, route and log.
struct TripStatsEntry: Codable, Identifiable, Equatable, Sendable {
    let id: String
    var kind: Kind
    /// Park visits only: the NPS unit code, e.g. "YOSE".
    var parkCode: String?
    /// Summits only.
    var name: String?
    var elevationMeters: Double?
    var latitude: Double?
    var longitude: Double?
    var osmId: Int?
    /// A calendar day sent as UTC midnight (see `TripGoal.dayString`). Nil when
    /// the user doesn't remember.
    var date: String?
    var deleted: Bool = false
    var localCreatedAt: String?
    var localUpdatedAt: String?

    enum Kind: String, Codable, Sendable {
        case park, summit
    }

    var day: Date? { TripGoal.day(from: date) }

    /// As a summit, for summits only.
    var summit: TripSummit? {
        guard kind == .summit, let name, !name.isEmpty else { return nil }
        return TripSummit(
            name: name,
            elevationMeters: elevationMeters,
            latitude: latitude ?? 0,
            longitude: longitude ?? 0,
            osmId: osmId
        )
    }
}

extension Array where Element == TripStatsEntry {
    var activeEntries: [TripStatsEntry] { filter { !$0.deleted } }
}

/// Create and replace body. Always the whole entry, id included, for the same
/// outbox reason as `TripGoalRequest`.
struct TripStatsEntryRequest: Codable, Sendable {
    let id: String
    let kind: TripStatsEntry.Kind
    let parkCode: String?
    let name: String?
    let elevationMeters: Double?
    let latitude: Double?
    let longitude: Double?
    let osmId: Int?
    let date: String?
    let localCreatedAt: String
    let localUpdatedAt: String

    init(entry: TripStatsEntry, now: String = Date.iso8601Now()) {
        self.id = entry.id
        self.kind = entry.kind
        self.parkCode = entry.parkCode
        self.name = entry.name
        self.elevationMeters = entry.elevationMeters
        self.latitude = entry.latitude
        self.longitude = entry.longitude
        self.osmId = entry.osmId
        self.date = entry.date
        self.localCreatedAt = entry.localCreatedAt ?? now
        self.localUpdatedAt = now
    }
}

/// A named peak from OpenStreetMap, offered when logging a trip's summits.
struct NearbyPeak: Codable, Identifiable, Equatable, Sendable {
    let osmId: Int
    let name: String
    let elevationMeters: Double?
    let latitude: Double
    let longitude: Double

    var id: Int { osmId }

    var summit: TripSummit {
        TripSummit(name: name, elevationMeters: elevationMeters, latitude: latitude, longitude: longitude, osmId: osmId)
    }
}
