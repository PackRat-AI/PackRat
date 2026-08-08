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

    func semanticSearch(query: String, limit: Int = 10) async throws -> [CatalogItem] {
        let endpoint = Endpoint(.get, "/api/catalog/vector-search", query: ["q": query, "limit": "\(limit)"])
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
