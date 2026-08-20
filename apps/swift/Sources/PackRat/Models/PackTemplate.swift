import Foundation

struct PackTemplate: Codable, Identifiable, Sendable {
    let id: String
    let userId: String?
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
    // Optional-with-default: older cached payloads predate this field.
    let deleted: Bool?

    var isDeleted: Bool { deleted ?? false }
    var activeItems: [PackTemplateItem] { (items ?? []).filter { !$0.isDeleted } }
    var itemCount: Int { activeItems.count }
    var isOfficial: Bool { isAppTemplate ?? false }

    // Explicit init so `deleted` can default — callers constructing new local
    // templates never create them pre-deleted.
    init(
        id: String,
        userId: String? = nil,
        name: String,
        description: String? = nil,
        category: String? = nil,
        image: String? = nil,
        tags: [String]? = nil,
        isAppTemplate: Bool? = nil,
        contentSource: String? = nil,
        items: [PackTemplateItem]? = nil,
        createdAt: String? = nil,
        updatedAt: String? = nil,
        deleted: Bool? = nil
    ) {
        self.id = id
        self.userId = userId
        self.name = name
        self.description = description
        self.category = category
        self.image = image
        self.tags = tags
        self.isAppTemplate = isAppTemplate
        self.contentSource = contentSource
        self.items = items
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.deleted = deleted
    }
}

extension Array where Element == PackTemplate {
    /// Drops soft-deleted templates. See `Array<Pack>.activePacks`.
    var activeTemplates: [PackTemplate] { filter { !$0.isDeleted } }
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
    // Optional so older cached payloads (which predate this field) still decode.
    let deleted: Bool?

    var isDeleted: Bool { deleted ?? false }

    // Explicit init so `deleted` can default — callers constructing new local
    // items never create them pre-deleted.
    init(
        id: String,
        packTemplateId: String? = nil,
        name: String,
        weight: Double? = nil,
        weightUnit: String? = nil,
        quantity: Int? = nil,
        category: String? = nil,
        consumable: Bool? = nil,
        worn: Bool? = nil,
        notes: String? = nil,
        deleted: Bool? = nil
    ) {
        self.id = id
        self.packTemplateId = packTemplateId
        self.name = name
        self.weight = weight
        self.weightUnit = weightUnit
        self.quantity = quantity
        self.category = category
        self.consumable = consumable
        self.worn = worn
        self.notes = notes
        self.deleted = deleted
    }

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
