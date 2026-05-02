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

    func createTemplate(name: String, description: String? = nil, category: String? = nil) async throws -> PackTemplate {
        let now = Date.iso8601Now()
        let body = CreateTemplateRequest(
            id: UUID().uuidString.lowercased(),
            name: name, description: description, category: category,
            localCreatedAt: now, localUpdatedAt: now
        )
        let endpoint = Endpoint(.post, "/api/pack-templates", body: body)
        return try await api.send(endpoint)
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
