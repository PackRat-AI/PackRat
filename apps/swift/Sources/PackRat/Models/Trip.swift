import Foundation

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
}

struct TripLocationBody: Encodable {
    let latitude: Double
    let longitude: Double
    let name: String?
}
