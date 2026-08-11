import Foundation

// MARK: - Pack extensions (struct defined in Generated.swift)

extension Pack {
    var activeItems: [PackItem] { (items ?? []).filter { !$0.deleted } }
    var itemCount: Int { activeItems.count }

    func formattedWeight(_ grams: Double?) -> String {
        guard let g = grams, g > 0 else { return "0 g" }
        return g >= 1000 ? String(format: "%.2f kg", g / 1000) : String(format: "%.0f g", g)
    }

    /// The pack's contents as plain text, used to answer the client-executed
    /// `getPackDetails` tool and to prime the first message of a pack chat.
    /// Without it the model replies that it couldn't retrieve the pack.
    var aiContextSummary: String {
        var lines = ["Here are the contents of the pack I'm asking about:"]
        lines.append("- Name: \(name)")
        if let description, !description.isEmpty {
            lines.append("- Description: \(description)")
        }
        if let category {
            lines.append("- Category: \(category.rawValue)")
        }
        lines.append("- Total weight: \(formattedWeight(totalWeight))")
        lines.append("- Base weight: \(formattedWeight(baseWeight))")

        let items = activeItems
        lines.append("- Item count: \(items.count)")
        if items.isEmpty {
            lines.append("- Items: none yet")
        } else {
            lines.append("- Items:")
            for item in items {
                var parts = ["  - \(item.name)"]
                parts.append("qty \(item.quantity)")
                parts.append(item.displayWeight.isEmpty ? "weight not set" : item.displayWeight)
                parts.append("category \(item.category ?? "uncategorized")")
                if item.worn { parts.append("worn") }
                if item.consumable { parts.append("consumable") }
                lines.append(parts.joined(separator: ", "))
            }
        }
        return lines.joined(separator: "\n")
    }
}

extension PackItem {
    var displayWeight: String {
        guard weight > 0 else { return "" }
        return String(format: "%.0f %@", weight, weightUnit.rawValue)
    }
    var effectiveQuantity: Int { quantity }

    /// Weight normalized to grams, for consistent chart calculations.
    var weightInGrams: Double {
        switch weightUnit {
        case .g:  return weight
        case .kg: return weight * 1_000
        case .oz: return weight * 28.3495
        case .lb: return weight * 453.592
        }
    }

    /// The item's facts as plain text, prepended to the first message of an
    /// item-scoped chat so the model usually doesn't need a tool round trip.
    var aiContextSummary: String {
        var lines = ["Here are the details of the pack item I'm asking about:"]
        lines.append("- Name: \(name)")
        if let description, !description.isEmpty {
            lines.append("- Description: \(description)")
        }
        lines.append("- Weight: \(displayWeight.isEmpty ? "not set" : displayWeight)")
        lines.append("- Quantity: \(quantity)")
        lines.append("- Category: \(category ?? "uncategorized")")
        lines.append("- Worn: \(worn ? "yes" : "no")")
        lines.append("- Consumable: \(consumable ? "yes" : "no")")
        if let notes, !notes.isEmpty {
            lines.append("- Notes: \(notes)")
        }
        return lines.joined(separator: "\n")
    }

    /// Structured form of `aiContextSummary`, returned as the result of a
    /// client-executed `getPackItemDetails` call.
    var aiToolFields: [String: String] {
        var fields: [String: String] = [
            "id": id,
            "name": name,
            "quantity": "\(quantity)",
            "category": category ?? "uncategorized",
            "worn": worn ? "true" : "false",
            "consumable": consumable ? "true" : "false",
        ]
        if weight > 0 {
            fields["weight"] = displayWeight
        }
        if let description, !description.isEmpty {
            fields["description"] = description
        }
        if let notes, !notes.isEmpty {
            fields["notes"] = notes
        }
        return fields
    }
}

extension PackCategory {
    init(from decoder: any Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = Self(rawValue: raw) ?? .custom
    }
}

extension WeightUnit {
    init(from decoder: any Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        // Map legacy values to canonical units
        switch raw.lowercased() {
        case "lbs": self = .lb
        case "grams": self = .g
        case "kilograms", "kgs": self = .kg
        case "ounces", "ozs": self = .oz
        default: self = Self(rawValue: raw) ?? .g
        }
    }
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

// Wind speed + distance display unit. Raw values match the Expo app's
// `speedUnit` preference ('kmh' | 'mph') so the stored preference is portable.

enum SpeedUnit: String, CaseIterable {
    case kmh
    case mph

    /// Segmented-control / picker label.
    var label: String {
        switch self {
        case .kmh: return "km/h"
        case .mph: return "mph"
        }
    }

    /// Formats a km/h value into the user's preferred unit.
    func displayWindSpeed(_ kph: Double) -> String {
        switch self {
        case .mph: return "\(Int((kph * 0.621371).rounded())) mph"
        case .kmh: return "\(Int(kph.rounded())) km/h"
        }
    }

    /// Formats a km value into the user's preferred distance unit.
    func displayDistance(_ km: Double) -> String {
        switch self {
        case .mph: return "\(Int((km * 0.621371).rounded())) mi"
        case .kmh: return "\(Int(km.rounded())) km"
        }
    }
}

// MARK: - Gap Analysis

struct GapAnalysisResult: Decodable, Sendable {
    let gaps: [GapSuggestion]
    let summary: String?
}

struct GapSuggestion: Decodable, Identifiable, Sendable {
    var id: UUID { UUID() }
    let suggestion: String
    let reason: String
    let consumable: Bool
    let worn: Bool
    let priority: String?

    var priorityColor: String {
        switch priority {
        case "must-have": return "red"
        case "nice-to-have": return "orange"
        default: return "secondary"
        }
    }
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
    /// Links the pack item back to the catalog product it came from. Nil for
    /// hand-entered items. Without it the server can't relate a packed item to
    /// its catalog entry (prices, similar-item lookups).
    let catalogItemId: Int?
    /// R2 object key or absolute URL for the item's image.
    let image: String?

    init(
        id: String,
        name: String,
        weight: Double? = nil,
        weightUnit: String? = nil,
        quantity: Int? = nil,
        category: String? = nil,
        consumable: Bool? = nil,
        worn: Bool? = nil,
        notes: String? = nil,
        catalogItemId: Int? = nil,
        image: String? = nil
    ) {
        self.id = id
        self.name = name
        self.weight = weight
        self.weightUnit = weightUnit
        self.quantity = quantity
        self.category = category
        self.consumable = consumable
        self.worn = worn
        self.notes = notes
        self.catalogItemId = catalogItemId
        self.image = image
    }
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
