import Foundation
import Observation

@Observable
final class PacksViewModel {
    var packs: [Pack] = []
    var isLoading = false
    var error: String?
    var searchText = ""

    private let service: PackService

    init(service: PackService = .shared) {
        self.service = service
    }

    var filteredPacks: [Pack] {
        guard !searchText.isEmpty else { return packs }
        return packs.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
            || ($0.description?.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            packs = try await service.listPacks()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func createPack(name: String, description: String?, category: String?, isPublic: Bool) async throws {
        let pack = try await service.createPack(
            name: name,
            description: description,
            category: category,
            isPublic: isPublic
        )
        packs.insert(pack, at: 0)
    }

    func updatePack(_ packId: String, name: String, description: String?, category: String?, isPublic: Bool) async throws {
        let updated = try await service.updatePack(packId, name: name, description: description, category: category, isPublic: isPublic)
        if let idx = packs.firstIndex(where: { $0.id == packId }) {
            packs[idx] = updated
        }
    }

    func deletePack(_ packId: String) async throws {
        try await service.deletePack(packId)
        packs.removeAll { $0.id == packId }
    }

    func addItem(to packId: String, name: String, weight: Double?, weightUnit: String?, quantity: Int?, category: String?, consumable: Bool, worn: Bool, notes: String?) async throws {
        let item = try await service.addItem(
            to: packId,
            name: name,
            weight: weight,
            weightUnit: weightUnit,
            quantity: quantity,
            category: category,
            consumable: consumable,
            worn: worn,
            notes: notes
        )
        if let idx = packs.firstIndex(where: { $0.id == packId }) {
            var items = packs[idx].items ?? []
            items.append(item)
            packs[idx] = rebuildPack(packs[idx], items: items)
        }
    }

    func updateItem(_ itemId: String, in packId: String, name: String, weight: Double?, weightUnit: String?, quantity: Int?, category: String?, consumable: Bool, worn: Bool, notes: String?) async throws {
        let updated = try await service.updateItem(
            itemId, in: packId,
            name: name,
            weight: weight,
            weightUnit: weightUnit,
            quantity: quantity,
            category: category,
            consumable: consumable,
            worn: worn,
            notes: notes
        )
        if let packIdx = packs.firstIndex(where: { $0.id == packId }),
           let itemIdx = packs[packIdx].items?.firstIndex(where: { $0.id == itemId })
        {
            var items = packs[packIdx].items ?? []
            items[itemIdx] = updated
            packs[packIdx] = rebuildPack(packs[packIdx], items: items)
        }
    }

    func deleteItem(_ itemId: String, from packId: String) async throws {
        try await service.deleteItem(itemId, from: packId)
        if let packIdx = packs.firstIndex(where: { $0.id == packId }) {
            var items = packs[packIdx].items ?? []
            items.removeAll { $0.id == itemId }
            packs[packIdx] = rebuildPack(packs[packIdx], items: items)
        }
    }

    private func rebuildPack(_ pack: Pack, items: [PackItem]) -> Pack {
        Pack(
            id: pack.id, userId: pack.userId, name: pack.name,
            description: pack.description, category: pack.category,
            isPublic: pack.isPublic, image: pack.image, tags: pack.tags,
            items: items, deleted: pack.deleted,
            baseWeight: pack.baseWeight, totalWeight: pack.totalWeight,
            wornWeight: pack.wornWeight, consumableWeight: pack.consumableWeight,
            createdAt: pack.createdAt, updatedAt: pack.updatedAt
        )
    }
}
