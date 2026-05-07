import Foundation
import Observation

@Observable
final class PackTemplatesViewModel {
    var templates: [PackTemplate] = []
    var isLoading = false
    var error: String?
    var searchText = ""

    private let service: PackTemplateService

    init(service: PackTemplateService = .shared) {
        self.service = service
    }

    var filteredTemplates: [PackTemplate] {
        guard !searchText.isEmpty else { return templates }
        return templates.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
            || ($0.description?.localizedCaseInsensitiveContains(searchText) ?? false)
            || ($0.category?.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }

    var officialTemplates: [PackTemplate] { filteredTemplates.filter { $0.isOfficial } }
    var myTemplates: [PackTemplate] { filteredTemplates.filter { !$0.isOfficial } }

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            templates = try await service.listTemplates()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func deleteTemplate(_ id: String) async throws {
        try await service.deleteTemplate(id)
        templates.removeAll { $0.id == id }
    }

    func applyTemplate(_ templateId: String, toPack packId: String) async throws {
        try await service.applyToPack(templateId: templateId, packId: packId)
    }

    func createTemplate(name: String, description: String?, category: String) async throws -> PackTemplate {
        let t = try await service.createTemplate(name: name, description: description, category: category)
        // Insert at top of "Mine" section so the newest template is immediately visible.
        templates.insert(t, at: 0)
        return t
    }

    func updateTemplate(_ id: String, name: String, description: String?, category: String) async throws -> PackTemplate {
        let t = try await service.updateTemplate(id, name: name, description: description, category: category)
        if let idx = templates.firstIndex(where: { $0.id == id }) { templates[idx] = t }
        return t
    }

    func addItem(toTemplate templateId: String, name: String, weight: Double, weightUnit: String,
                 quantity: Int, category: String?, consumable: Bool, worn: Bool, notes: String?) async throws -> PackTemplateItem {
        let item = try await service.addItem(
            toTemplate: templateId, name: name, weight: weight, weightUnit: weightUnit,
            quantity: quantity, category: category, consumable: consumable, worn: worn, notes: notes
        )
        if let idx = templates.firstIndex(where: { $0.id == templateId }) {
            var items = templates[idx].items ?? []
            items.append(item)
            templates[idx] = PackTemplate(
                id: templates[idx].id, userId: templates[idx].userId, name: templates[idx].name,
                description: templates[idx].description, category: templates[idx].category,
                image: templates[idx].image, tags: templates[idx].tags,
                isAppTemplate: templates[idx].isAppTemplate, contentSource: templates[idx].contentSource,
                items: items, createdAt: templates[idx].createdAt, updatedAt: templates[idx].updatedAt
            )
        }
        return item
    }

    func updateItem(inTemplate templateId: String, itemId: String, name: String, weight: Double,
                    weightUnit: String, quantity: Int, category: String?, consumable: Bool, worn: Bool, notes: String?) async throws {
        let updated = try await service.updateItem(
            itemId, name: name, weight: weight, weightUnit: weightUnit,
            quantity: quantity, category: category, consumable: consumable, worn: worn, notes: notes
        )
        if let tIdx = templates.firstIndex(where: { $0.id == templateId }),
           var items = templates[tIdx].items,
           let iIdx = items.firstIndex(where: { $0.id == itemId }) {
            items[iIdx] = updated
            templates[tIdx] = PackTemplate(
                id: templates[tIdx].id, userId: templates[tIdx].userId, name: templates[tIdx].name,
                description: templates[tIdx].description, category: templates[tIdx].category,
                image: templates[tIdx].image, tags: templates[tIdx].tags,
                isAppTemplate: templates[tIdx].isAppTemplate, contentSource: templates[tIdx].contentSource,
                items: items, createdAt: templates[tIdx].createdAt, updatedAt: templates[tIdx].updatedAt
            )
        }
    }

    func deleteItem(inTemplate templateId: String, itemId: String) async throws {
        try await service.deleteItem(itemId)
        if let tIdx = templates.firstIndex(where: { $0.id == templateId }) {
            var items = templates[tIdx].items ?? []
            items.removeAll { $0.id == itemId }
            templates[tIdx] = PackTemplate(
                id: templates[tIdx].id, userId: templates[tIdx].userId, name: templates[tIdx].name,
                description: templates[tIdx].description, category: templates[tIdx].category,
                image: templates[tIdx].image, tags: templates[tIdx].tags,
                isAppTemplate: templates[tIdx].isAppTemplate, contentSource: templates[tIdx].contentSource,
                items: items, createdAt: templates[tIdx].createdAt, updatedAt: templates[tIdx].updatedAt
            )
        }
    }
}
