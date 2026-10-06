import Foundation

/// Goals and settings behind Trip Stats (`/api/trip-stats`). Progress isn't
/// fetched: it's worked out on device from the trips.
final class TripStatsService: Sendable {
    static let shared = TripStatsService()
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    /// A goal a newer server can describe but this build can't (an unknown
    /// metric, say) is dropped instead of failing the whole list.
    func listGoals() async throws -> [TripGoal] {
        let rows: [Lenient<TripGoal>] = try await api.send(Endpoint(.get, "/api/trip-stats/goals"))
        return rows.compactMap(\.value)
    }

    /// `goal.id` is client-generated so an offline create keeps its identity
    /// when the outbox replays it.
    func createGoal(_ request: TripGoalRequest) async throws -> TripGoal {
        try await api.send(Endpoint(.post, "/api/trip-stats/goals", body: request))
    }

    func updateGoal(_ goalId: String, _ request: TripGoalRequest) async throws -> TripGoal {
        try await api.send(Endpoint(.put, "/api/trip-stats/goals/\(goalId)", body: request))
    }

    func deleteGoal(_ goalId: String) async throws {
        try await api.sendDiscarding(Endpoint(.delete, "/api/trip-stats/goals/\(goalId)"))
    }

    func settings() async throws -> TripStatsSettings {
        try await api.send(Endpoint(.get, "/api/trip-stats/settings"))
    }

    func saveSettings(_ settings: TripStatsSettings) async throws -> TripStatsSettings {
        try await api.send(Endpoint(.put, "/api/trip-stats/settings", body: settings))
    }
}

/// Decodes to nil instead of throwing, for one bad row in an otherwise good list.
struct Lenient<Value: Decodable>: Decodable {
    let value: Value?

    init(from decoder: any Decoder) throws {
        value = try? Value(from: decoder)
    }
}
