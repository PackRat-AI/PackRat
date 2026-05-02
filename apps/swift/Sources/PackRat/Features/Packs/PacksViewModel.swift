import Foundation
import Observation
import SwiftData

@Observable
@MainActor
final class PacksViewModel {
    var packs: [Pack] = []
    var isLoading = false
    var isCacheLoaded = false
    var error: String?
    var searchText = ""

    private let service: PackService

    init(service: PackService = .shared) {
        self.service = service
    }

    var currentPage = 1
    var hasMore = true

    var filteredPacks: [Pack] {
        guard !searchText.isEmpty else { return packs }
        return packs.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
            || ($0.description?.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }

    // Load cached packs instantly from SwiftData, then refresh from network
    func load(context: ModelContext? = nil) async {
        if let context, !isCacheLoaded {
            let cached = (try? context.fetch(FetchDescriptor<CachedPack>(
                sortBy: [SortDescriptor(\.cachedAt, order: .reverse)]
            ))) ?? []
            let cachedPacks = cached.compactMap { $0.toPack() }
            if !cachedPacks.isEmpty {
                packs = cachedPacks
                isCacheLoaded = true
            }
        }

        isLoading = packs.isEmpty
        error = nil
        defer { isLoading = false }

        do {
            let fresh = try await service.listPacks(page: 1)
            packs = fresh
            currentPage = 1
            hasMore = !fresh.isEmpty
            if let context {
                writeCachePacks(fresh, context: context)
            }
        } catch {
            if packs.isEmpty { self.error = error.localizedDescription }
        }
    }

    func loadMore() async {
        guard hasMore, !isLoading else { return }
        let nextPage = currentPage + 1
        isLoading = true
        defer { isLoading = false }
        do {
            let more = try await service.listPacks(page: nextPage)
            if more.isEmpty {
                hasMore = false
            } else {
                packs.append(contentsOf: more)
                currentPage = nextPage
            }
        } catch { }
    }

    private func writeCachePacks(_ freshPacks: [Pack], context: ModelContext) {
        let existing = (try? context.fetch(FetchDescriptor<CachedPack>())) ?? []
        let existingMap = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })
        for pack in freshPacks {
            if let cached = existingMap[pack.id] {
                cached.name = pack.name
                cached.packDescription = pack.description
                cached.totalWeight = pack.totalWeight
                cached.baseWeight = pack.baseWeight
                cached.jsonData = try? JSONEncoder().encode(pack)
                cached.cachedAt = Date()
            } else {
                context.insert(CachedPack(from: pack))
            }
        }
        // Prune removed packs
        let freshIds = Set(freshPacks.map(\.id))
        for cached in existing where !freshIds.contains(cached.id) {
            context.delete(cached)
        }
        try? context.save()
    }

    func createPack(name: String, description: String?, category: String?, isPublic: Bool) async throws {
        let pack = try await service.createPack(
            name: name, description: description, category: category, isPublic: isPublic
        )
        packs.insert(pack, at: 0)
    }

    func updatePack(_ packId: String, name: String, description: String?, category: String?, isPublic: Bool) async throws {
        let updated = try await service.updatePack(
            packId, name: name, description: description, category: category, isPublic: isPublic
        )
        if let idx = packs.firstIndex(where: { $0.id == packId }) {
            packs[idx] = updated
        }
    }

    // Optimistic delete: remove immediately, restore on error
    func deletePack(_ packId: String) async throws {
        guard let idx = packs.firstIndex(where: { $0.id == packId }) else { return }
        let removed = packs.remove(at: idx)
        do {
            try await service.deletePack(packId)
        } catch {
            packs.insert(removed, at: idx)
            throw error
        }
    }

    func addItem(to packId: String, name: String, weight: Double?, weightUnit: String?,
                 quantity: Int?, category: String?, consumable: Bool, worn: Bool, notes: String?) async throws {
        let item = try await service.addItem(
            to: packId, name: name, weight: weight, weightUnit: weightUnit,
            quantity: quantity, category: category, consumable: consumable, worn: worn, notes: notes
        )
        if let idx = packs.firstIndex(where: { $0.id == packId }) {
            var items = packs[idx].items ?? []
            items.append(item)
            packs[idx] = rebuildPack(packs[idx], items: items)
        }
    }

    func updateItem(_ itemId: String, in packId: String, name: String, weight: Double?,
                    weightUnit: String?, quantity: Int?, category: String?,
                    consumable: Bool, worn: Bool, notes: String?) async throws {
        let updated = try await service.updateItem(
            itemId, in: packId, name: name, weight: weight, weightUnit: weightUnit,
            quantity: quantity, category: category, consumable: consumable, worn: worn, notes: notes
        )
        if let packIdx = packs.firstIndex(where: { $0.id == packId }),
           let itemIdx = packs[packIdx].items?.firstIndex(where: { $0.id == itemId }) {
            var items = packs[packIdx].items ?? []
            items[itemIdx] = updated
            packs[packIdx] = rebuildPack(packs[packIdx], items: items)
        }
    }

    // Optimistic item delete
    func deleteItem(_ itemId: String, from packId: String) async throws {
        guard let packIdx = packs.firstIndex(where: { $0.id == packId }),
              let itemIdx = packs[packIdx].items?.firstIndex(where: { $0.id == itemId }) else { return }
        var items = packs[packIdx].items ?? []
        let removed = items.remove(at: itemIdx)
        packs[packIdx] = rebuildPack(packs[packIdx], items: items)
        do {
            try await service.deleteItem(itemId, from: packId)
        } catch {
            var restored = packs[packIdx].items ?? []
            restored.insert(removed, at: itemIdx)
            if let idx = packs.firstIndex(where: { $0.id == packId }) {
                packs[idx] = rebuildPack(packs[idx], items: restored)
            }
            throw error
        }
    }

    private func rebuildPack(_ pack: Pack, items: [PackItem]) -> Pack {
        Pack(
            id: pack.id, userId: pack.userId, name: pack.name,
            description: pack.description, category: pack.category,
            isPublic: pack.isPublic, image: pack.image, tags: pack.tags,
            templateId: pack.templateId, deleted: pack.deleted,
            isAIGenerated: pack.isAIGenerated,
            items: items, totalWeight: pack.totalWeight,
            baseWeight: pack.baseWeight, wornWeight: pack.wornWeight,
            consumableWeight: pack.consumableWeight,
            createdAt: pack.createdAt, updatedAt: pack.updatedAt
        )
    }
}
