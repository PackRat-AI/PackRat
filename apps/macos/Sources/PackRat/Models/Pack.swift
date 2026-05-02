import Foundation

struct Pack: Codable, Identifiable, Sendable {
    let id: String
    let userId: String?
    let name: String
    let description: String?
    let category: String?
    let isPublic: Bool?
    let image: String?
    let tags: [String]?
    let items: [PackItem]?
    let deleted: Bool?
    let baseWeight: Double?
    let totalWeight: Double?
    let wornWeight: Double?
    let consumableWeight: Double?
    let createdAt: String?
    let updatedAt: String?

    var activeItems: [PackItem] { (items ?? []).filter { !($0.deleted ?? false) } }
    var itemCount: Int { activeItems.count }

    func formattedWeight(_ grams: Double?) -> String {
        guard let g = grams, g > 0 else { return "0 g" }
        return g >= 1000 ? String(format: "%.2f kg", g / 1000) : String(format: "%.0f g", g)
    }
}

struct PackItem: Codable, Identifiable, Sendable {
    let id: String
    let packId: String?
    let name: String
    let weight: Double?
    let weightUnit: String?
    let quantity: Int?
    let category: String?
    let consumable: Bool?
    let worn: Bool?
    let image: String?
    let notes: String?
    let catalogItemId: Int?
    let deleted: Bool?

    var displayWeight: String {
        guard let w = weight, let u = weightUnit, w > 0 else { return "" }
        return String(format: "%.0f %@", w, u)
    }

    var effectiveQuantity: Int { quantity ?? 1 }
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

// MARK: - Categories

enum PackCategory: String, CaseIterable {
    case hiking, camping, climbing, skiing, cycling, travel, other

    var label: String { rawValue.capitalized }
    var symbol: String {
        switch self {
        case .hiking:   "figure.hiking"
        case .camping:  "tent"
        case .climbing: "mountain.2"
        case .skiing:   "figure.skiing.downhill"
        case .cycling:  "bicycle"
        case .travel:   "airplane"
        case .other:    "backpack"
        }
    }
}

enum WeightUnit: String, CaseIterable {
    case g, kg, oz, lb

    var label: String { rawValue }
}
