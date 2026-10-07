import Foundation
import SwiftData

/// On-device copy of a park visit or summit added by hand. See `CachedTripGoal`.
@Model
final class CachedTripStatsEntry {
    @Attribute(.unique) var id: String
    var jsonData: Data?
    var cachedAt: Date

    init(from entry: TripStatsEntry) {
        self.id = entry.id
        self.jsonData = try? JSONEncoder().encode(entry)
        self.cachedAt = Date()
    }

    func toEntry() -> TripStatsEntry? {
        guard let jsonData else { return nil }
        return try? JSONDecoder().decode(TripStatsEntry.self, from: jsonData)
    }
}
