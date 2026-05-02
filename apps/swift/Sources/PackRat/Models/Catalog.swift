import Foundation

struct CatalogItem: Codable, Identifiable, Sendable {
    let id: Int
    let name: String?
    let brand: String?
    let model: String?
    let weight: Double?
    let weightUnit: String?
    let description: String?
    let price: Double?
    let currency: String?
    let productUrl: String?
    let images: [String]?
    let categories: [String]?
    let availability: String?
    let ratingValue: Double?
    let reviewCount: Int?
    let sku: String?

    var primaryImage: String? { images?.first }
    var displayName: String { name ?? "Unknown Item" }
    var displayBrand: String? { brand?.nilIfEmpty }

    var displayWeight: String {
        guard let w = weight, let u = weightUnit, w > 0 else { return "" }
        return String(format: "%.0f %@", w, u)
    }

    var displayPrice: String? {
        guard let p = price, p > 0 else { return nil }
        let symbol = currency == "USD" ? "$" : (currency ?? "")
        return String(format: "%@%.2f", symbol, p)
    }

    var isInStock: Bool { availability != "out_of_stock" }
}

struct CatalogSearchResponse: Codable, Sendable {
    let items: [CatalogItem]?
    let total: Int?
    let page: Int?
    let limit: Int?

    // Elysia may return array directly
    init(from decoder: Decoder) throws {
        if let container = try? decoder.container(keyedBy: CodingKeys.self) {
            items = try container.decodeIfPresent([CatalogItem].self, forKey: .items)
            total = try container.decodeIfPresent(Int.self, forKey: .total)
            page = try container.decodeIfPresent(Int.self, forKey: .page)
            limit = try container.decodeIfPresent(Int.self, forKey: .limit)
        } else if let arr = try? [CatalogItem](from: decoder) {
            items = arr; total = arr.count; page = nil; limit = nil
        } else {
            items = nil; total = nil; page = nil; limit = nil
        }
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
