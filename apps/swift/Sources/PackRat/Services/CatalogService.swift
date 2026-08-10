import Foundation

final class CatalogService: Sendable {
    static let shared = CatalogService()
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    func search(query: String, page: Int = 1, limit: Int = 20) async throws -> [CatalogItem] {
        let endpoint = Endpoint(.get, "/api/catalog", query: [
            "q": query,
            "page": "\(page)",
            "limit": "\(limit)",
        ])
        let data = try await api.sendData(endpoint)
        return try decodeCatalogItems(from: data)
    }

    /// Embedding-backed search. The route is `/api/catalog/vector-search` —
    /// there is no `/api/catalog/search` on the backend
    /// (packages/api/src/routes/catalog/index.ts), which is what this used to
    /// call, so every semantic search 404'd.
    func semanticSearch(query: String, limit: Int = 10) async throws -> [CatalogItem] {
        let endpoint = Endpoint(.get, "/api/catalog/vector-search", query: ["q": query, "limit": "\(limit)"])
        let data = try await api.sendData(endpoint)
        return try decodeCatalogItems(from: data)
    }

    /// Category facets for the browse sheet's filter chips. The route returns a
    /// bare JSON array of strings (`CatalogCategoriesResponseSchema`), ordered
    /// by item count descending.
    func categories(limit: Int = 20) async throws -> [String] {
        let endpoint = Endpoint(.get, "/api/catalog/categories", query: ["limit": "\(limit)"])
        return try await api.send(endpoint, as: [String].self)
    }

    /// Paged browse/search. `category` is sent only when set so the unfiltered
    /// browse case doesn't narrow to an empty facet.
    func browse(
        query: String?,
        category: String?,
        page: Int = 1,
        limit: Int = 20
    ) async throws -> [CatalogItem] {
        var params = ["page": "\(page)", "limit": "\(limit)"]
        if let query, !query.isEmpty { params["q"] = query }
        if let category, !category.isEmpty { params["category"] = category }
        let endpoint = Endpoint(.get, "/api/catalog", query: params)
        let data = try await api.sendData(endpoint)
        return try decodeCatalogItems(from: data)
    }

    private func decodeCatalogItems(from data: Data) throws -> [CatalogItem] {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        if let wrapped = try? decoder.decode(CatalogSearchResponse.self, from: data) {
            return wrapped.items
        }
        return try decoder.decode([CatalogItem].self, from: data)
    }
}
