import Foundation

struct Trip: Codable, Identifiable, Sendable {
    let id: String
    let userId: String?
    let name: String
    let description: String?
    let startDate: String?
    let endDate: String?
    let location: TripLocation?
    let notes: String?
    let packId: String?
    let pack: Pack?
    let deleted: Bool?
    let createdAt: String?
    let updatedAt: String?

    var dateRange: String {
        let parts = [formattedDate(startDate), formattedDate(endDate)].compactMap { $0 }
        return parts.joined(separator: " – ")
    }

    private func formattedDate(_ isoString: String?) -> String? {
        guard let str = isoString,
              let date = ISO8601DateFormatter().date(from: str)
        else { return nil }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}

struct TripLocation: Codable, Sendable {
    let latitude: Double?
    let longitude: Double?
    let name: String?
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
}

struct TripLocationBody: Encodable {
    let latitude: Double
    let longitude: Double
    let name: String?
}
