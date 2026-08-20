import Foundation

// MARK: - Pack extensions (struct defined in Generated.swift)

extension Pack {
    var activeItems: [PackItem] { (items ?? []).filter { !$0.deleted } }
    var itemCount: Int { activeItems.count }
}

extension Array where Element == Pack {
    /// Drops soft-deleted packs (tombstones).
    ///
    /// Applied at every ingress into a view model's `packs` array — network
    /// responses, SwiftData cache reads, and pagination — so the app never
    /// renders a tombstone even if a server or a locally-migrated cache hands
    /// one over. Expo got this for free from Legend State's `fieldDeleted`
    /// tombstone handling; the Swift client has no sync layer, so it filters
    /// explicitly. Migrating users carry Expo-era local data that contains
    /// tombstones, so client-side filtering is required, not just defensive.
    var activePacks: [Pack] { filter { !$0.deleted } }
}

extension Pack {

    /// Formats a gram value for display.
    ///
    /// - Parameter unit: The user's preferred display unit. Views should pass
    ///   their `@AppStorage(AppWeightUnit.storageKey)` value so the setting in
    ///   Preferences actually takes effect; it defaults to grams for non-UI
    ///   callers such as `aiContextSummary`.
    func formattedWeight(_ grams: Double?, in unit: AppWeightUnit = .grams) -> String {
        unit.display(grams: grams)
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
    /// The item's own stored weight and unit, unconverted.
    ///
    /// Prefer `displayWeight(in:)` for UI: this shows whichever unit the item
    /// happened to be created with, which is why changing the app-wide
    /// preference appeared to do nothing on item rows.
    var displayWeight: String {
        guard weight > 0 else { return "" }
        return String(format: "%.0f %@", weight, weightUnit.rawValue)
    }

    /// The item's weight converted into the user's preferred unit.
    func displayWeight(in unit: AppWeightUnit) -> String {
        guard weight > 0 else { return "" }
        return unit.display(weight, from: weightUnit)
    }

    var effectiveQuantity: Int { quantity }

    /// Weight normalized to grams, for consistent chart calculations.
    var weightInGrams: Double { weight * weightUnit.gramsPerUnit }

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
    /// Maps an API-supplied unit string onto a canonical unit, absorbing the
    /// legacy spellings the server has sent over time. Returns `nil` for
    /// anything unrecognized so callers can decide whether to fall back.
    ///
    /// Shared with the decoder below and with payloads that type their unit as a
    /// plain `String` (`SeasonSuggestionItem`, `PackTemplateItem`).
    init?(apiValue raw: String) {
        switch raw.lowercased() {
        case "lbs": self = .lb
        case "grams": self = .g
        case "kilograms", "kgs": self = .kg
        case "ounces", "ozs": self = .oz
        default:
            guard let unit = Self(rawValue: raw.lowercased()) else { return nil }
            self = unit
        }
    }

    init(from decoder: any Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = Self(apiValue: raw) ?? .g
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

    /// The `UserDefaults` key the preference is stored under. Declared here so
    /// every consuming `@AppStorage` spells it the same way.
    static let storageKey = "defaultAppWeightUnit"

    /// Grams per one of this unit — the single source of truth for conversion in
    /// both directions.
    var gramsPerUnit: Double {
        switch self {
        case .grams: return 1
        case .kg:    return 1_000
        case .oz:    return 28.3495
        case .lb:    return 453.592
        }
    }

    /// Digits to show. Grams are whole numbers; the larger units need decimals
    /// or a 300 g item reads as "1 lb".
    private var fractionDigits: Int {
        switch self {
        case .grams: return 0
        case .kg:    return 2
        case .oz:    return 1
        case .lb:    return 2
        }
    }

    /// Formats a gram value into this unit.
    ///
    /// Weights are stored and computed in grams throughout the app (the server
    /// sends pack totals in grams), so this is the single conversion point for
    /// display. Replaces four separate hard-coded g/kg formatters that ignored
    /// the user's preference entirely.
    func display(grams: Double?) -> String {
        guard let grams, grams > 0 else { return "0 \(rawValue)" }

        // Metric auto-promotes g → kg the way it always did, so a 2.4 kg pack
        // doesn't read as "2400 g". Imperial units are absolute by choice.
        if self == .grams, grams >= 1_000 {
            return String(format: "%.2f kg", grams / 1_000)
        }

        let value = grams / gramsPerUnit
        return String(format: "%.\(fractionDigits)f %@", value, rawValue)
    }

    /// Converts a value expressed in `unit` into this unit for display.
    func display(_ value: Double, from unit: WeightUnit) -> String {
        display(grams: value * unit.gramsPerUnit)
    }
}

extension WeightUnit {
    /// Grams per one of this unit. Mirrors `AppWeightUnit.gramsPerUnit` for the
    /// API-facing enum, so per-item weights can be normalized before display.
    var gramsPerUnit: Double {
        switch self {
        case .g:  return 1
        case .kg: return 1_000
        case .oz: return 28.3495
        case .lb: return 453.592
        }
    }
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
