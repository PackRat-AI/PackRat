import Foundation

extension Array where Element == Trip {
    /// Drops soft-deleted trips. See `Array<Pack>.activePacks`.
    var activeTrips: [Trip] { filter { !$0.deleted } }
}

// MARK: - Trip extensions (structs defined in Generated.swift)

extension Trip {
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
    let localUpdatedAt: String

    enum CodingKeys: String, CodingKey {
        case name, description, location, startDate, endDate, notes, packId, localUpdatedAt
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
        try container.encode(localUpdatedAt, forKey: .localUpdatedAt)
    }
}

struct TripLocationBody: Encodable {
    let latitude: Double
    let longitude: Double
    let name: String?
}
