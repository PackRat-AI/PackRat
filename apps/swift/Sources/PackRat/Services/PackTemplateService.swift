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
        let now = Date.iso8601Now()
        let body = CreateTemplateRequest(
            id: UUID().uuidString.lowercased(),
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
        let body = CreateTemplateItemRequest(
            id: UUID().uuidString.lowercased(),
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

    /// Applies a template to an existing pack by copying all template items.
    func applyToPack(templateId: String, packId: String) async throws {
        let template = try await getTemplate(templateId)
        guard let items = template.items else { return }
        let packService = PackService.shared
        for item in items {
            _ = try await packService.addItem(
                to: packId,
                name: item.name,
                weight: item.weight,
                weightUnit: item.weightUnit,
                quantity: item.quantity,
                category: item.category,
                consumable: item.consumable,
                worn: item.worn,
                notes: item.notes
            )
        }
    }
}
