import Foundation

// MARK: - Trip extensions (structs defined in Generated.swift)

extension Trip {
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
