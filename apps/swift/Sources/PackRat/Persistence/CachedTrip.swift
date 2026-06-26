import SwiftData
import Foundation

@Model
final class CachedTrip {
    @Attribute(.unique) var id: String
    var name: String
    var tripDescription: String?
    var startDate: String?
    var endDate: String?
    var locationName: String?
    var packId: String?
    var jsonData: Data?
    var cachedAt: Date

    init(from trip: Trip) {
        self.id = trip.id
        self.name = trip.name
        self.tripDescription = trip.description
        self.startDate = trip.startDate
        self.endDate = trip.endDate
        self.locationName = trip.location?.name
        self.packId = trip.packId
        self.jsonData = try? JSONEncoder().encode(trip)
        self.cachedAt = Date()
    }

    func toTrip() -> Trip? {
        guard let data = jsonData else { return nil }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try? decoder.decode(Trip.self, from: data)
    }
}
