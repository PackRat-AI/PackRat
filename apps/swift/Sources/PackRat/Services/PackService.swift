import Foundation

final class PackService: Sendable {
    static let shared = PackService()
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    func listPacks(page: Int = 1, limit: Int = 30, includePublic: Bool = false) async throws -> [Pack] {
        let endpoint = Endpoint(.get, "/api/packs", query: [
            "page": "\(page)", "limit": "\(limit)",
            "includePublic": includePublic ? "1" : "0",
        ])
        return try await api.send(endpoint)
    }

    func createPack(name: String, description: String? = nil, category: String? = nil, isPublic: Bool = false) async throws -> Pack {
        let now = Date.iso8601Now()
        let body = CreatePackRequest(
            id: UUID().uuidString.lowercased(),
            name: name,
            description: description,
            category: category,
            isPublic: isPublic,
            localCreatedAt: now,
            localUpdatedAt: now
        )
        let endpoint = Endpoint(.post, "/api/packs", body: body)
        return try await api.send(endpoint)
    }

    func updatePack(_ packId: String, name: String? = nil, description: String? = nil, category: String? = nil, isPublic: Bool? = nil) async throws -> Pack {
        let body = UpdatePackRequest(
            name: name,
            description: description,
            category: category,
            isPublic: isPublic,
            localUpdatedAt: Date.iso8601Now()
        )
        let endpoint = Endpoint(.put, "/api/packs/\(packId)", body: body)
        return try await api.send(endpoint)
    }

    func deletePack(_ packId: String) async throws {
        let endpoint = Endpoint(.delete, "/api/packs/\(packId)")
        try await api.sendDiscarding(endpoint)
    }

    func addItem(to packId: String, name: String, weight: Double? = nil, weightUnit: String? = nil, quantity: Int? = nil, category: String? = nil, consumable: Bool? = nil, worn: Bool? = nil, notes: String? = nil) async throws -> PackItem {
        let body = CreatePackItemRequest(
            id: UUID().uuidString.lowercased(),
            name: name,
            weight: weight,
            weightUnit: weightUnit,
            quantity: quantity,
            category: category,
            consumable: consumable,
            worn: worn,
            notes: notes
        )
        let endpoint = Endpoint(.post, "/api/packs/\(packId)/items", body: body)
        return try await api.send(endpoint)
    }

    func updateItem(_ itemId: String, in packId: String, name: String? = nil, weight: Double? = nil, weightUnit: String? = nil, quantity: Int? = nil, category: String? = nil, consumable: Bool? = nil, worn: Bool? = nil, notes: String? = nil) async throws -> PackItem {
        let body = UpdatePackItemRequest(
            name: name,
            weight: weight,
            weightUnit: weightUnit,
            quantity: quantity,
            category: category,
            consumable: consumable,
            worn: worn,
            notes: notes
        )
        let endpoint = Endpoint(.put, "/api/packs/\(packId)/items/\(itemId)", body: body)
        return try await api.send(endpoint)
    }

    func deleteItem(_ itemId: String, from packId: String) async throws {
        let endpoint = Endpoint(.delete, "/api/packs/\(packId)/items/\(itemId)")
        try await api.sendDiscarding(endpoint)
    }

    func analyzeGaps(
        packId: String,
        destination: String? = nil,
        tripType: String? = nil,
        duration: Int? = nil
    ) async throws -> GapAnalysisResult {
        struct Body: Encodable {
            let destination: String?
            let tripType: String?
            let duration: Int?
        }
        let endpoint = Endpoint(.post, "/api/packs/\(packId)/gap-analysis",
                                body: Body(destination: destination, tripType: tripType, duration: duration))
        return try await api.send(endpoint)
    }
}
