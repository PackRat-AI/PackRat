import Foundation

extension Array where Element == Trip {
    /// Drops soft-deleted trips. See `Array<Pack>.activePacks`.
    var activeTrips: [Trip] { filter { !$0.deleted } }
}

// MARK: - Trip lifecycle

/// A trip is planned until the user starts it, in progress while they're out,
/// and complete once they finish it or mark themselves safe.
enum TripStatus: String, Codable, Sendable {
    case planned
    case inProgress = "in_progress"
    case complete
}

/// One point of a trip's planned route, e.g. from an imported GPX track.
struct TripRoutePoint: Codable, Hashable, Sendable {
    let latitude: Double
    let longitude: Double
}

// MARK: - Trip extensions (structs defined in Generated.swift)

extension Trip {
    var lifecycle: TripStatus { status ?? .planned }
    /// Left out of trip stats by the user, for a trip that never happened or
    /// was planned for someone else. The trip itself stays in the list.
    var isExcludedFromStats: Bool { excludedFromStats ?? false }

    var dateRange: String {
        let parts = [startDate, endDate].compactMap { $0?.toDate()?.formatted(date: .abbreviated, time: .omitted) }
        return parts.joined(separator: " – ")
    }
}

// MARK: - Trip log

/// What a user did on a trip, recorded once it's over. Mirrors `TripLogSchema`
/// in `packages/schemas/src/trips.ts`. Distances are metres whatever the
/// display unit; `route` is a Google encoded polyline (see `Polyline`).
struct TripLog: Codable, Equatable, Sendable {
    var activities: [TripActivity]
    var distanceMeters: Double?
    var elevationGainMeters: Double?
    var route: String?
    var source: Source?
    /// Named peaks reached on the trip.
    var summits: [TripSummit]
    /// Trails from the trail registry walked on the trip.
    var trails: [TripTrail]

    enum Source: String, Codable, Sendable {
        case manual, track, trail
    }

    init(
        activities: [TripActivity] = [],
        distanceMeters: Double? = nil,
        elevationGainMeters: Double? = nil,
        route: String? = nil,
        source: Source? = nil,
        summits: [TripSummit] = [],
        trails: [TripTrail] = []
    ) {
        self.activities = activities
        self.distanceMeters = distanceMeters
        self.elevationGainMeters = elevationGainMeters
        self.route = route
        self.source = source
        self.summits = summits
        self.trails = trails
    }

    /// Unknown activity strings from a newer server are dropped rather than
    /// failing the whole trip decode.
    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let raw = try container.decodeIfPresent([String].self, forKey: .activities) ?? []
        activities = raw.compactMap(TripActivity.init(rawValue:))
        distanceMeters = try container.decodeIfPresent(Double.self, forKey: .distanceMeters)
        elevationGainMeters = try container.decodeIfPresent(Double.self, forKey: .elevationGainMeters)
        route = try container.decodeIfPresent(String.self, forKey: .route)
        source = try? container.decodeIfPresent(Source.self, forKey: .source)
        summits = (try? container.decodeIfPresent([Lenient<TripSummit>].self, forKey: .summits))?
            .compactMap(\.value) ?? []
        trails = (try? container.decodeIfPresent([Lenient<TripTrail>].self, forKey: .trails))?
            .compactMap(\.value) ?? []
    }

    /// True when the log carries nothing worth saving.
    var isEmpty: Bool {
        activities.isEmpty && distanceMeters == nil && elevationGainMeters == nil
            && (route?.isEmpty ?? true) && summits.isEmpty && trails.isEmpty
    }
}

/// A named peak reached on a trip. Mirrors `TripSummitSchema`; `osmId` is the
/// OpenStreetMap node it was picked from, nil when typed by hand.
struct TripSummit: Codable, Equatable, Hashable, Sendable {
    var name: String
    var elevationMeters: Double?
    var latitude: Double
    var longitude: Double
    var osmId: Int?

    /// The same peak however it was reached: by OSM node, else by name.
    var peakKey: String {
        if let osmId { return "osm:\(osmId)" }
        return "name:" + name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}

/// A trail walked on a trip. Mirrors `TripTrailSchema`; `id` is the trail's
/// id in PackRat's trail registry, stable across data refreshes.
struct TripTrail: Codable, Equatable, Hashable, Sendable {
    var id: String
    var name: String
    var lengthMeters: Double?
}

enum TripActivity: String, Codable, CaseIterable, Identifiable, Sendable {
    case hiking, backpacking, camping, climbing, mountaineering, paddling, skiing, biking, other

    var id: String { rawValue }

    var label: String { rawValue.capitalized }

    var symbol: String {
        switch self {
        case .hiking: return "figure.hiking"
        case .backpacking: return "backpack.fill"
        case .camping: return "tent.fill"
        case .climbing: return "figure.climbing"
        case .mountaineering: return "mountain.2.fill"
        case .paddling: return "figure.outdoor.rowing"
        case .skiing: return "figure.skiing.downhill"
        case .biking: return "figure.outdoor.cycle"
        case .other: return "sparkles"
        }
    }
}

// MARK: - Request Bodies

struct CreateTripRequest: Encodable {
    let id: String
    let name: String
    let description: String?
    let location: TripLocationBody?
    let startDate: String?
    let endDate: String?
    let notes: String?
    let packId: String?
    let checklist: [TripChecklistItem]?
    var log: TripLog? = nil
    var excludedFromStats: Bool? = nil
    let localCreatedAt: String
    let localUpdatedAt: String
}

struct UpdateTripRequest: Encodable {
    let name: String?
    let description: String?
    let location: TripLocationBody?
    let startDate: String?
    let endDate: String?
    let notes: String?
    let packId: String?
    let checklist: [TripChecklistItem]?
    var status: TripStatus? = nil
    var startedAt: String? = nil
    var completedAt: String? = nil
    /// Nil leaves the route as is; an empty array clears it.
    var plannedRoute: [TripRoutePoint]? = nil
    let log: TripLog?
    let excludedFromStats: Bool
    let localUpdatedAt: String

    enum CodingKeys: String, CodingKey {
        case name, description, location, startDate, endDate, notes, packId, checklist, log, excludedFromStats
        case status, startedAt, completedAt, plannedRoute, localUpdatedAt
    }

    /// `packId` is encoded unconditionally — as an explicit `null` when the user
    /// picks "None" — because the update route distinguishes the two cases with
    /// `if ('packId' in data)`. Synthesised `Encodable` omits nil keys entirely,
    /// which the server read as "leave unchanged", so unassigning a pack never
    /// saved. Every other field keeps omit-when-nil so a partial update does not
    /// clobber fields the form did not touch. `log` follows `packId` for the
    /// same reason: clearing a trip's log has to reach the server as `null`.
    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(name, forKey: .name)
        try container.encodeIfPresent(description, forKey: .description)
        try container.encodeIfPresent(location, forKey: .location)
        try container.encodeIfPresent(startDate, forKey: .startDate)
        try container.encodeIfPresent(endDate, forKey: .endDate)
        try container.encodeIfPresent(notes, forKey: .notes)
        try container.encode(packId, forKey: .packId)
        try container.encodeIfPresent(checklist, forKey: .checklist)
        try container.encodeIfPresent(status, forKey: .status)
        try container.encodeIfPresent(startedAt, forKey: .startedAt)
        try container.encodeIfPresent(completedAt, forKey: .completedAt)
        if let plannedRoute {
            // An empty route is sent as null so the server clears it.
            if plannedRoute.isEmpty {
                try container.encodeNil(forKey: .plannedRoute)
            } else {
                try container.encode(plannedRoute, forKey: .plannedRoute)
            }
        }
        try container.encode(log, forKey: .log)
        try container.encode(excludedFromStats, forKey: .excludedFromStats)
        try container.encode(localUpdatedAt, forKey: .localUpdatedAt)
    }
}

struct TripLocationBody: Encodable {
    let latitude: Double
    let longitude: Double
    let name: String?
}
