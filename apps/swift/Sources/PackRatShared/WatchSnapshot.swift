import Foundation

struct PackRatWatchSnapshot: Codable, Equatable, Sendable {
    var updatedAt: Date
    var pack: WatchPackSnapshot
    var trip: WatchTripSnapshot?
    var weather: WatchWeatherSnapshot
    var trail: WatchTrailSnapshot

    static let fallback = PackRatWatchSnapshot(
        updatedAt: Date(timeIntervalSince1970: 0),
        pack: WatchPackSnapshot(
            name: "Alpine Weekend",
            baseWeightText: "18.4 lb",
            packedItemCount: 5,
            totalItemCount: 7,
            checklist: [
                WatchChecklistItemSnapshot(id: "fallback-shelter", title: "Shelter", symbolName: "tent", isPacked: true),
                WatchChecklistItemSnapshot(id: "fallback-water", title: "Water", symbolName: "drop", isPacked: true),
                WatchChecklistItemSnapshot(id: "fallback-first-aid", title: "First Aid", symbolName: "cross.case", isPacked: true),
                WatchChecklistItemSnapshot(id: "fallback-layers", title: "Rain Layers", symbolName: "jacket", isPacked: false),
                WatchChecklistItemSnapshot(id: "fallback-food", title: "Trail Meals", symbolName: "fork.knife", isPacked: false),
            ]
        ),
        trip: WatchTripSnapshot(
            name: "Local Trail Prep",
            locationName: "Offline",
            dateText: "Today"
        ),
        weather: WatchWeatherSnapshot(
            locationName: "Denver",
            temperatureText: "64°",
            conditionText: "Clear",
            symbolName: "sun.max"
        ),
        trail: WatchTrailSnapshot(
            title: "Trail Report",
            conditionText: "Good",
            hazardCount: 0
        )
    )
}

struct WatchPackSnapshot: Codable, Equatable, Sendable {
    var name: String
    var baseWeightText: String
    var packedItemCount: Int
    var totalItemCount: Int
    var checklist: [WatchChecklistItemSnapshot]
}

struct WatchChecklistItemSnapshot: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var title: String
    var symbolName: String
    var isPacked: Bool
}

struct WatchTripSnapshot: Codable, Equatable, Sendable {
    var name: String
    var locationName: String?
    var dateText: String?
}

struct WatchWeatherSnapshot: Codable, Equatable, Sendable {
    var locationName: String
    var temperatureText: String
    var conditionText: String
    var symbolName: String
}

struct WatchTrailSnapshot: Codable, Equatable, Sendable {
    var title: String
    var conditionText: String
    var hazardCount: Int
}

struct WatchTrailReportDraft: Codable, Equatable, Sendable {
    var condition: String
    var note: String
    var createdAt: Date
}

enum WatchCompanionMessage {
    static let snapshot = "packrat.watch.snapshot"
    static let trailDraft = "packrat.watch.trailDraft"
}
