import Foundation

// MARK: - CatalogItem extensions (struct defined in Generated.swift)

extension CatalogItem {
    var primaryImage: String? { images?.first }
    var displayName: String { name }
    var displayBrand: String? { brand?.nilIfEmpty }

    var displayWeight: String {
        guard weight > 0 else { return "" }
        return String(format: "%.0f %@", weight, weightUnit.rawValue)
    }

    var displayPrice: String? {
        guard let p = price, p > 0 else { return nil }
        return String(format: "$%.2f", p)
    }

    var isInStock: Bool { availability != "out_of_stock" }
}

// MARK: - Search response with flexible decoding
// The search endpoint may return {items, page, limit, total} or a plain array.

struct CatalogSearchResponse: Codable, Sendable {
    let items: [CatalogItem]
    let total: Int?
    let page: Int?
    let limit: Int?

    init(from decoder: Decoder) throws {
        if let container = try? decoder.container(keyedBy: CodingKeys.self) {
            items = (try? container.decode([CatalogItem].self, forKey: .items)) ?? []
            total = try? container.decodeIfPresent(Int.self, forKey: .total)
            page  = try? container.decodeIfPresent(Int.self, forKey: .page)
            limit = try? container.decodeIfPresent(Int.self, forKey: .limit)
        } else if let arr = try? [CatalogItem](from: decoder) {
            items = arr; total = arr.count; page = nil; limit = nil
        } else {
            items = []; total = nil; page = nil; limit = nil
        }
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
