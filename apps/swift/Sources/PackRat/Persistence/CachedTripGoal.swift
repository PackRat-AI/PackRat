import Foundation
import SwiftData

/// On-device copy of a trip stats goal, so goals show offline and a goal made
/// offline survives relaunch until the outbox lands it.
@Model
final class CachedTripGoal {
    @Attribute(.unique) var id: String
    var jsonData: Data?
    var cachedAt: Date

    init(from goal: TripGoal) {
        self.id = goal.id
        self.jsonData = try? JSONEncoder().encode(goal)
        self.cachedAt = Date()
    }

    func toGoal() -> TripGoal? {
        guard let jsonData else { return nil }
        return try? JSONDecoder().decode(TripGoal.self, from: jsonData)
    }
}
