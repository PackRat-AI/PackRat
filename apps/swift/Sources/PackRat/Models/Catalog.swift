import Foundation

// MARK: - CatalogItem extensions (struct defined in Generated.swift)

extension CatalogItem {
    var primaryImage: String? { images?.first }
    var displayName: String { name }
    var displayBrand: String? { brand?.nilIfEmpty }

    /// The item's own stored weight and unit, unconverted.
    ///
    /// Prefer `displayWeight(in:)` for UI so the app-wide preference applies.
    var displayWeight: String {
        guard let weight, weight > 0, let weightUnit else { return "" }
        return String(format: "%.0f %@", weight, weightUnit.rawValue)
    }

    /// The item's weight converted into the user's preferred unit.
    func displayWeight(in unit: AppWeightUnit) -> String {
        guard let weight, weight > 0, let weightUnit else { return "" }
        return unit.display(weight, from: weightUnit)
    }

    var displayPrice: String? {
        guard let p = price, p > 0 else { return nil }
        return String(format: "$%.2f", p)
    }

    var isInStock: Bool { availability != "out_of_stock" }
}

// MARK: - Search response with flexible decoding
// The search endpoint may return {items, page, limit, total} or a plain array.

struct CatalogSearchResponse: Decodable, Sendable {
    let items: [CatalogItem]
    let total: Int?
    let page: Int?
    let limit: Int?

    private enum CodingKeys: String, CodingKey {
        case items
        case total
        case totalCount
        case page
        case limit
    }

    init(from decoder: Decoder) throws {
        if let container = try? decoder.container(keyedBy: CodingKeys.self) {
            items = (try? container.decode([CatalogItem].self, forKey: .items)) ?? []
            total = (try? container.decodeIfPresent(Int.self, forKey: .total))
                ?? (try? container.decodeIfPresent(Int.self, forKey: .totalCount))
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

// MARK: - Category display names

extension String {
    /// Title-cases a raw catalog category for display.
    ///
    /// Catalog categories are scraped and arrive with HTML entities intact
    /// ("hike &amp; camp"). Plain `.capitalized` would render that as
    /// "Hike &Amp; Camp", so decode the handful of entities that actually occur
    /// before capitalizing. Full HTML parsing via NSAttributedString is not an
    /// option here — it must run on the main thread and is far too slow for a
    /// list of chips.
    var catalogCategoryDisplayName: String {
        let decoded = replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")
            .replacingOccurrences(of: "&apos;", with: "'")
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
        // Capitalize per word so "&" and other separators survive intact.
        return decoded
            .split(separator: " ", omittingEmptySubsequences: true)
            .map { word in
                // Leave symbols and already-uppercase acronyms alone.
                word.contains(where: \.isLetter) && word != word.uppercased()
                    ? word.capitalized
                    : String(word)
            }
            .joined(separator: " ")
    }
}
