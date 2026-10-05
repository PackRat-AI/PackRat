import Foundation

final class PackTemplateService: Sendable {
    static let shared = PackTemplateService()
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    func listTemplates() async throws -> [PackTemplate] {
        let endpoint = Endpoint(.get, "/api/pack-templates")
        return try await api.send(endpoint)
    }

    func getTemplate(_ id: String) async throws -> PackTemplate {
        let endpoint = Endpoint(.get, "/api/pack-templates/\(id)")
        return try await api.send(endpoint)
    }

    func createTemplate(name: String, description: String? = nil, category: String = "custom") async throws -> PackTemplate {
        try await createTemplate(
            id: UUID().uuidString.lowercased(),
            name: name,
            description: description,
            category: category
        )
    }

    /// Creates a template under a caller-supplied id.
    ///
    /// Used when replaying a queued create: the id already exists on the device (and in
    /// any child template items' foreign keys), so minting a fresh one would orphan them.
    func createTemplate(
        id: String,
        name: String,
        description: String? = nil,
        category: String = "custom"
    ) async throws -> PackTemplate {
        let now = Date.iso8601Now()
        let body = CreateTemplateRequest(
            id: id,
            name: name, description: description, category: category,
            localCreatedAt: now, localUpdatedAt: now
        )
        let endpoint = Endpoint(.post, "/api/pack-templates", body: body)
        return try await api.send(endpoint)
    }

    func updateTemplate(_ id: String, name: String, description: String?, category: String) async throws -> PackTemplate {
        let body = UpdateTemplateRequest(
            name: name, description: description, category: category,
            localUpdatedAt: Date.iso8601Now()
        )
        let endpoint = Endpoint(.put, "/api/pack-templates/\(id)", body: body)
        return try await api.send(endpoint)
    }

    func addItem(toTemplate templateId: String, name: String, weight: Double, weightUnit: String,
                 quantity: Int, category: String?, consumable: Bool, worn: Bool, notes: String?) async throws -> PackTemplateItem {
        try await addItem(
            toTemplate: templateId, id: UUID().uuidString.lowercased(), name: name,
            weight: weight, weightUnit: weightUnit, quantity: quantity,
            category: category, consumable: consumable, worn: worn, notes: notes
        )
    }

    /// Adds a template item under a caller-supplied id, for replaying a queued create.
    func addItem(toTemplate templateId: String, id: String, name: String, weight: Double,
                 weightUnit: String, quantity: Int, category: String?, consumable: Bool,
                 worn: Bool, notes: String?) async throws -> PackTemplateItem {
        let body = CreateTemplateItemRequest(
            id: id,
            name: name, weight: weight, weightUnit: weightUnit, quantity: quantity,
            category: category, consumable: consumable, worn: worn, notes: notes
        )
        let endpoint = Endpoint(.post, "/api/pack-templates/\(templateId)/items", body: body)
        return try await api.send(endpoint)
    }

    func updateItem(_ itemId: String, name: String, weight: Double, weightUnit: String,
                    quantity: Int, category: String?, consumable: Bool, worn: Bool, notes: String?) async throws -> PackTemplateItem {
        let body = UpdateTemplateItemRequest(
            name: name, weight: weight, weightUnit: weightUnit, quantity: quantity,
            category: category, consumable: consumable, worn: worn, notes: notes
        )
        let endpoint = Endpoint(.patch, "/api/pack-templates/items/\(itemId)", body: body)
        return try await api.send(endpoint)
    }

    func deleteItem(_ itemId: String) async throws {
        let endpoint = Endpoint(.delete, "/api/pack-templates/items/\(itemId)")
        try await api.sendDiscarding(endpoint)
    }

    func deleteTemplate(_ id: String) async throws {
        let endpoint = Endpoint(.delete, "/api/pack-templates/\(id)")
        try await api.sendDiscarding(endpoint)
    }

    /// Copies every active item of a template into a pack and returns the new
    /// pack items. One request: the server copies the items and embeds them in a
    /// single batch. The old client loop sent one POST per item, each paying for
    /// its own embedding call, so a 30-item template took 30 serial round trips.
    func applyToPack(templateId: String, packId: String) async throws -> [PackItem] {
        let endpoint = Endpoint(
            .post,
            "/api/packs/\(packId)/apply-template",
            body: ApplyTemplateRequest(templateId: templateId)
        )
        let response: ApplyTemplateResponse = try await api.send(endpoint)
        return response.items
    }
}

private struct ApplyTemplateRequest: Encodable {
    let templateId: String
}

private struct ApplyTemplateResponse: Decodable {
    let items: [PackItem]
}
