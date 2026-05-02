import Foundation

// MARK: - Pack extensions (struct defined in Generated.swift)

extension Pack {
    var activeItems: [PackItem] { (items ?? []).filter { !$0.deleted } }
    var itemCount: Int { activeItems.count }

    func formattedWeight(_ grams: Double?) -> String {
        guard let g = grams, g > 0 else { return "0 g" }
        return g >= 1000 ? String(format: "%.2f kg", g / 1000) : String(format: "%.0f g", g)
    }
}

extension PackItem {
    var displayWeight: String {
        guard weight > 0 else { return "" }
        return String(format: "%.0f %@", weight, weightUnit.rawValue)
    }
    var effectiveQuantity: Int { quantity }
}

extension PackCategory {
    var label: String {
        switch self {
        case .waterSports: return "Water Sports"
        default: return rawValue.capitalized
        }
    }
    var symbol: String {
        switch self {
        case .hiking:      return "figure.hiking"
        case .backpacking: return "backpack"
        case .camping:     return "tent"
        case .climbing:    return "mountain.2"
        case .winter:      return "snowflake"
        case .desert:      return "sun.max.trianglebadge.exclamationmark"
        case .custom:      return "star"
        case .waterSports: return "figure.pool.swim"
        case .skiing:      return "figure.skiing.downhill"
        }
    }
}

// MARK: - UI weight unit (separate from WeightUnit in Generated.swift)
// Used only for user preference storage — the API-facing enum is WeightUnit.

enum AppWeightUnit: String, CaseIterable {
    case grams = "g", kg, oz, lb

    var label: String { rawValue }
}

// MARK: - Request Bodies

struct CreatePackRequest: Encodable {
    let id: String
    let name: String
    let description: String?
    let category: String?
    let isPublic: Bool
    let localCreatedAt: String
    let localUpdatedAt: String
}

struct UpdatePackRequest: Encodable {
    let name: String?
    let description: String?
    let category: String?
    let isPublic: Bool?
    let localUpdatedAt: String
}

struct CreatePackItemRequest: Encodable {
    let id: String
    let name: String
    let weight: Double?
    let weightUnit: String?
    let quantity: Int?
    let category: String?
    let consumable: Bool?
    let worn: Bool?
    let notes: String?
}

struct UpdatePackItemRequest: Encodable {
    let name: String?
    let weight: Double?
    let weightUnit: String?
    let quantity: Int?
    let category: String?
    let consumable: Bool?
    let worn: Bool?
    let notes: String?
}
