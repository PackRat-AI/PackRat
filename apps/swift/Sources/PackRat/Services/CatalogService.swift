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
        // Handle both wrapped and unwrapped responses
        if let wrapped = try? await api.send(endpoint, as: CatalogSearchResponse.self) {
            return wrapped.items ?? []
        }
        return try await api.send(endpoint)
    }

    func semanticSearch(query: String, limit: Int = 10) async throws -> [CatalogItem] {
        let endpoint = Endpoint(.get, "/api/catalog/search", query: ["q": query, "limit": "\(limit)"])
        return try await api.send(endpoint)
    }
}
