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
            name: "No Pack Synced",
            baseWeightText: "--",
            packedItemCount: 0,
            totalItemCount: 0,
            checklist: []
        ),
        trip: nil,
        weather: WatchWeatherSnapshot(
            locationName: "No Location",
            temperatureText: "--",
            conditionText: "Open iPhone app to sync weather.",
            symbolName: "cloud"
        ),
        trail: WatchTrailSnapshot(
            title: "Trail Report",
            conditionText: "None",
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
