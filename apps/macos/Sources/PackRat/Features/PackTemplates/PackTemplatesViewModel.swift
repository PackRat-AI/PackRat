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
}
