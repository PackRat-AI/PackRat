import Foundation

struct PackTemplate: Codable, Identifiable, Sendable {
    let id: String
    let userId: Int?
    let name: String
    let description: String?
    let category: String?
    let image: String?
    let tags: [String]?
    let isAppTemplate: Bool?
    let contentSource: String?
    let items: [PackTemplateItem]?
    let createdAt: String?
    let updatedAt: String?

    var itemCount: Int { items?.count ?? 0 }
    var isOfficial: Bool { isAppTemplate ?? false }
}

struct PackTemplateItem: Codable, Identifiable, Sendable {
    let id: String
    let packTemplateId: String?
    let name: String
    let weight: Double?
    let weightUnit: String?
    let quantity: Int?
    let category: String?
    let consumable: Bool?
    let worn: Bool?
    let notes: String?

    var weightInGrams: Double {
        guard let w = weight, let u = weightUnit else { return 0 }
        let qty = Double(quantity ?? 1)
        switch u.lowercased() {
        case "kg", "kilograms", "kgs": return w * 1_000 * qty
        case "oz", "ounces", "ozs":   return w * 28.3495 * qty
        case "lb", "lbs":             return w * 453.592 * qty
        default:                       return w * qty
        }
    }
}

extension PackTemplate {
    var totalWeightGrams: Double {
        (items ?? []).reduce(0) { $0 + $1.weightInGrams }
    }

    func formattedTotalWeight() -> String {
        let g = totalWeightGrams
        guard g > 0 else { return "No weight data" }
        return g >= 1000 ? String(format: "%.2f kg", g / 1000) : String(format: "%.0f g", g)
    }
}

struct CreateTemplateRequest: Encodable {
    let id: String
    let name: String
    let description: String?
    let category: String
    let localCreatedAt: String
    let localUpdatedAt: String
}

struct UpdateTemplateRequest: Encodable {
    let name: String?
    let description: String?
    let category: String?
    let localUpdatedAt: String
}

struct CreateTemplateItemRequest: Encodable {
    let id: String
    let name: String
    let weight: Double
    let weightUnit: String
    let quantity: Int
    let category: String?
    let consumable: Bool
    let worn: Bool
    let notes: String?
}

struct UpdateTemplateItemRequest: Encodable {
    let name: String?
    let weight: Double?
    let weightUnit: String?
    let quantity: Int?
    let category: String?
    let consumable: Bool?
    let worn: Bool?
    let notes: String?
}
