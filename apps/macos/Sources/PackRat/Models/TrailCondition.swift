import Foundation

struct TrailConditionReport: Codable, Identifiable, Sendable {
    let id: String
    let userId: String?
    let trailName: String
    let trailRegion: String?
    let surface: String?
    let overallCondition: String?
    let hazards: [String]?
    let waterCrossings: Int?
    let waterCrossingDifficulty: String?
    let notes: String?
    let photos: [String]?
    let tripId: String?
    let deleted: Bool?
    let createdAt: String?
    let updatedAt: String?
    let user: PostUser?

    var conditionColor: String {
        switch overallCondition {
        case "excellent": return "green"
        case "good":      return "blue"
        case "fair":      return "orange"
        case "poor":      return "red"
        default:          return "secondary"
        }
    }

    var conditionSymbol: String {
        switch overallCondition {
        case "excellent": return "checkmark.circle.fill"
        case "good":      return "checkmark.circle"
        case "fair":      return "exclamationmark.circle"
        case "poor":      return "xmark.circle.fill"
        default:          return "questionmark.circle"
        }
    }

    var timeAgo: String {
        guard let str = createdAt,
              let date = ISO8601DateFormatter().date(from: str)
        else { return "" }
        return date.formatted(.relative(presentation: .named))
    }
}

enum TrailSurface: String, CaseIterable {
    case paved, gravel, dirt, rocky, snow, mud
    var label: String { rawValue.capitalized }
    var symbol: String {
        switch self {
        case .paved:  "road.lanes"
        case .gravel: "road.lanes.curved.right"
        case .dirt:   "leaf"
        case .rocky:  "mountain.2"
        case .snow:   "snowflake"
        case .mud:    "drop"
        }
    }
}

enum TrailConditionLevel: String, CaseIterable {
    case excellent, good, fair, poor
    var label: String { rawValue.capitalized }
}

struct CreateTrailConditionRequest: Encodable {
    let id: String
    let trailName: String
    let trailRegion: String?
    let surface: String?
    let overallCondition: String
    let hazards: [String]?
    let notes: String?
    let localCreatedAt: String
    let localUpdatedAt: String
}
