import Foundation

/// A gear item the vision model spotted in an uploaded photo.
/// Mirrors `DetectedItemSchema` in packages/schemas/src/imageDetection.ts.
struct DetectedItem: Codable, Sendable {
    let name: String
    let description: String
    let quantity: Int
    let category: String
    let consumable: Bool
    let worn: Bool
    let notes: String?
    let confidence: Double

    enum CodingKeys: String, CodingKey {
        case name, description, quantity, category, consumable, worn, notes, confidence
    }

    init(
        name: String,
        description: String = "",
        quantity: Int = 1,
        category: String = "",
        consumable: Bool = false,
        worn: Bool = false,
        notes: String? = nil,
        confidence: Double = 0
    ) {
        self.name = name
        self.description = description
        self.quantity = quantity
        self.category = category
        self.consumable = consumable
        self.worn = worn
        self.notes = notes
        self.confidence = confidence
    }

    // Only `name` is truly required. Everything else carries a Zod default or is
    // nullable server-side, so a missing field should fall back rather than fail
    // the whole array's decode and lose every other detection in the photo.
    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decode(String.self, forKey: .name)
        description = (try? c.decode(String.self, forKey: .description)) ?? ""
        quantity = (try? c.decode(Int.self, forKey: .quantity)) ?? 1
        category = (try? c.decode(String.self, forKey: .category)) ?? ""
        consumable = (try? c.decode(Bool.self, forKey: .consumable)) ?? false
        worn = (try? c.decode(Bool.self, forKey: .worn)) ?? false
        notes = try? c.decodeIfPresent(String.self, forKey: .notes)
        confidence = (try? c.decode(Double.self, forKey: .confidence)) ?? 0
    }
}

/// One detection plus the catalog items it was matched against.
/// Mirrors `DetectedItemWithMatchesSchema`. The analyze route returns a bare
/// array of these — not an object wrapper.
struct DetectedItemWithMatches: Codable, Sendable, Identifiable {
    let detected: DetectedItem
    let catalogMatches: [CatalogItem]

    /// Detections have no server-assigned id; index-independent identity comes
    /// from the name, which is unique enough within a single photo's results.
    var id: String { detected.name }

    /// The best catalog match, when the matcher found one. Used to prefill
    /// weight — the vision model does not estimate weight itself.
    var primaryMatch: CatalogItem? { catalogMatches.first }
}

struct AnalyzeImageRequest: Encodable, Sendable {
    let image: String
    let matchLimit: Int?
}
