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

    var dateRange: String {
        let parts = [startDate, endDate].compactMap { $0?.toDate()?.formatted(date: .abbreviated, time: .omitted) }
        return parts.joined(separator: " – ")
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
    let localUpdatedAt: String

    enum CodingKeys: String, CodingKey {
        case name, description, location, startDate, endDate, notes, packId, checklist
        case status, startedAt, completedAt, plannedRoute, localUpdatedAt
    }

    /// `packId` is encoded unconditionally — as an explicit `null` when the user
    /// picks "None" — because the update route distinguishes the two cases with
    /// `if ('packId' in data)`. Synthesised `Encodable` omits nil keys entirely,
    /// which the server read as "leave unchanged", so unassigning a pack never
    /// saved. Every other field keeps omit-when-nil so a partial update does not
    /// clobber fields the form did not touch.
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
        try container.encode(localUpdatedAt, forKey: .localUpdatedAt)
    }
}

struct TripLocationBody: Encodable {
    let latitude: Double
    let longitude: Double
    let name: String?
}
