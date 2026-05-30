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

    let service: PackService

    init(service: PackService = .shared) {
        self.service = service
    }

    var currentPage = 1
    var hasMore = true
    private let pageSize = 30
    private var canUseRemotePersonalStore: Bool {
        NetworkMonitor.shared.isConnected && KeychainService.shared.sessionToken != nil
    }

    var filteredPacks: [Pack] {
        guard !searchText.isEmpty else { return packs }
        return packs.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
            || ($0.description?.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }

    // Load cached packs instantly from SwiftData, then refresh from network
    func load(context: ModelContext? = nil) async {
        if VisualSampleData.isEnabled && !packs.isEmpty {
            isLoading = false
            error = nil
            return
        }
        if VisualSampleData.isScreenshotCapture {
            isLoading = false
            error = nil
            isCacheLoaded = true
            hasMore = false
            return
        }

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

        guard canUseRemotePersonalStore else {
            if packs.isEmpty { isCacheLoaded = true }
            return
        }

        do {
            let fresh = try await service.listPacks(page: 1, limit: pageSize)
            packs = fresh
            currentPage = 1
            hasMore = fresh.count == pageSize
            if let context {
                writeCachePacks(fresh, context: context)
            }
        } catch {
            if packs.isEmpty { self.error = error.localizedDescription }
        }
    }

    func loadMore() async {
        guard hasMore, !isLoading, canUseRemotePersonalStore else { return }
        let nextPage = currentPage + 1
        isLoading = true
        defer { isLoading = false }
        do {
            let more = try await service.listPacks(page: nextPage, limit: pageSize)
            packs.append(contentsOf: more)
            currentPage = nextPage
            hasMore = more.count == pageSize
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

    func createPack(
        name: String,
        description: String?,
        category: String?,
        isPublic: Bool,
        context: ModelContext? = nil
    ) async throws {
        let localPack = makeLocalPack(name: name, description: description, category: category, isPublic: isPublic)
        guard canUseRemotePersonalStore else {
            packs.insert(localPack, at: 0)
            upsertCachedPack(localPack, context: context)
            return
        }

        let pack: Pack
        do {
            pack = try await service.createPack(
                name: name, description: description, category: category, isPublic: isPublic
            )
        } catch {
            pack = localPack
        }
        packs.insert(pack, at: 0)
        upsertCachedPack(pack, context: context)
    }

    func updatePack(
        _ packId: String,
        name: String,
        description: String?,
        category: String?,
        isPublic: Bool,
        context: ModelContext? = nil
    ) async throws {
        guard let existing = packs.first(where: { $0.id == packId }) else { return }
        let localUpdated = rebuildPack(
            existing,
            name: name,
            description: description,
            category: PackCategory(rawValue: category ?? ""),
            isPublic: isPublic,
            updatedAt: Date.iso8601Now()
        )

        let updated: Pack
        if canUseRemotePersonalStore {
            do {
                updated = try await service.updatePack(
                    packId, name: name, description: description, category: category, isPublic: isPublic
                )
            } catch {
                updated = localUpdated
            }
        } else {
            updated = localUpdated
        }
        if let idx = packs.firstIndex(where: { $0.id == packId }) {
            packs[idx] = updated
        }
        upsertCachedPack(updated, context: context)
    }

    // Optimistic delete: remove immediately, restore on error
    func deletePack(_ packId: String, context: ModelContext? = nil) async throws {
        guard let idx = packs.firstIndex(where: { $0.id == packId }) else { return }
        let removed = packs.remove(at: idx)
        deleteCachedPack(packId, context: context)
        guard !packId.hasPrefix("local-") else { return }
        guard canUseRemotePersonalStore else { return }
        do {
            try await service.deletePack(packId)
        } catch {
            packs.insert(removed, at: idx)
            upsertCachedPack(removed, context: context)
            throw error
        }
    }

    func addItem(to packId: String, name: String, weight: Double?, weightUnit: String?,
                 quantity: Int?, category: String?, consumable: Bool, worn: Bool, notes: String?,
                 context: ModelContext? = nil) async throws {
        let localItem = makeLocalItem(
            packId: packId, name: name, weight: weight, weightUnit: weightUnit,
            quantity: quantity, category: category, consumable: consumable, worn: worn, notes: notes
        )
        let item: PackItem
        if canUseRemotePersonalStore {
            do {
                item = try await service.addItem(
                    to: packId, name: name, weight: weight, weightUnit: weightUnit,
                    quantity: quantity, category: category, consumable: consumable, worn: worn, notes: notes
                )
            } catch {
                item = localItem
            }
        } else {
            item = localItem
        }
        if let idx = packs.firstIndex(where: { $0.id == packId }) {
            var items = packs[idx].items ?? []
            items.append(item)
            packs[idx] = rebuildPack(packs[idx], items: items)
            upsertCachedPack(packs[idx], context: context)
        }
    }

    func updateItem(_ itemId: String, in packId: String, name: String, weight: Double?,
                    weightUnit: String?, quantity: Int?, category: String?,
                    consumable: Bool, worn: Bool, notes: String?,
                    context: ModelContext? = nil) async throws {
        if let packIdx = packs.firstIndex(where: { $0.id == packId }),
           let itemIdx = packs[packIdx].items?.firstIndex(where: { $0.id == itemId }) {
            let current = packs[packIdx].items?[itemIdx]
            let localUpdated = makeLocalItem(
                id: itemId,
                packId: packId,
                name: name,
                weight: weight ?? current?.weight,
                weightUnit: weightUnit ?? current?.weightUnit.rawValue,
                quantity: quantity ?? current?.quantity,
                category: category ?? current?.category,
                consumable: consumable,
                worn: worn,
                notes: notes ?? current?.notes
            )
            let updated: PackItem
            if canUseRemotePersonalStore {
                do {
                    updated = try await service.updateItem(
                        itemId, in: packId, name: name, weight: weight, weightUnit: weightUnit,
                        quantity: quantity, category: category, consumable: consumable, worn: worn, notes: notes
                    )
                } catch {
                    updated = localUpdated
                }
            } else {
                updated = localUpdated
            }
            var items = packs[packIdx].items ?? []
            items[itemIdx] = updated
            packs[packIdx] = rebuildPack(packs[packIdx], items: items)
            upsertCachedPack(packs[packIdx], context: context)
        }
    }

    // Optimistic item delete
    func deleteItem(_ itemId: String, from packId: String, context: ModelContext? = nil) async throws {
        guard let packIdx = packs.firstIndex(where: { $0.id == packId }),
              let itemIdx = packs[packIdx].items?.firstIndex(where: { $0.id == itemId }) else { return }
        var items = packs[packIdx].items ?? []
        let removed = items.remove(at: itemIdx)
        packs[packIdx] = rebuildPack(packs[packIdx], items: items)
        upsertCachedPack(packs[packIdx], context: context)
        guard canUseRemotePersonalStore else { return }
        do {
            try await service.deleteItem(itemId, from: packId)
        } catch {
            var restored = packs[packIdx].items ?? []
            restored.insert(removed, at: itemIdx)
            if let idx = packs.firstIndex(where: { $0.id == packId }) {
                packs[idx] = rebuildPack(packs[idx], items: restored)
                upsertCachedPack(packs[idx], context: context)
            }
            throw error
        }
    }

    private func makeLocalPack(name: String, description: String?, category: String?, isPublic: Bool) -> Pack {
        let now = Date.iso8601Now()
        return Pack(
            id: "local-\(UUID().uuidString)", userId: nil, name: name,
            description: description, category: PackCategory(rawValue: category ?? ""),
            isPublic: isPublic, image: nil, tags: nil, templateId: nil,
            deleted: false, isAIGenerated: false, items: [],
            totalWeight: 0, baseWeight: 0, wornWeight: 0, consumableWeight: 0,
            createdAt: now, updatedAt: now
        )
    }

    private func makeLocalItem(
        id: String = "local-item-\(UUID().uuidString)",
        packId: String,
        name: String,
        weight: Double?,
        weightUnit: String?,
        quantity: Int?,
        category: String?,
        consumable: Bool,
        worn: Bool,
        notes: String?
    ) -> PackItem {
        let now = Date.iso8601Now()
        return PackItem(
            id: id,
            packId: packId,
            name: name,
            description: nil,
            weight: weight ?? 0,
            weightUnit: WeightUnit(rawValue: weightUnit ?? "g") ?? .g,
            quantity: quantity ?? 1,
            category: category,
            consumable: consumable,
            worn: worn,
            image: nil,
            notes: notes,
            catalogItemId: nil,
            userId: nil,
            deleted: false,
            isAIGenerated: false,
            templateItemId: nil,
            createdAt: now,
            updatedAt: now
        )
    }

    private func rebuildPack(
        _ pack: Pack,
        name: String? = nil,
        description: String? = nil,
        category: PackCategory? = nil,
        isPublic: Bool? = nil,
        updatedAt: String? = nil
    ) -> Pack {
        return Pack(
            id: pack.id, userId: pack.userId, name: name ?? pack.name,
            description: description, category: category ?? pack.category,
            isPublic: isPublic ?? pack.isPublic, image: pack.image, tags: pack.tags,
            templateId: pack.templateId, deleted: pack.deleted,
            isAIGenerated: pack.isAIGenerated, items: pack.items,
            totalWeight: pack.totalWeight, baseWeight: pack.baseWeight,
            wornWeight: pack.wornWeight, consumableWeight: pack.consumableWeight,
            createdAt: pack.createdAt, updatedAt: updatedAt ?? pack.updatedAt
        )
    }

    private func rebuildPack(_ pack: Pack, items: [PackItem]) -> Pack {
        let total = items.reduce(0) { $0 + ($1.weightInGrams * Double($1.quantity)) }
        let base = items
            .filter { !$0.worn && !$0.consumable }
            .reduce(0) { $0 + ($1.weightInGrams * Double($1.quantity)) }
        let worn = items
            .filter(\.worn)
            .reduce(0) { $0 + ($1.weightInGrams * Double($1.quantity)) }
        let consumable = items
            .filter(\.consumable)
            .reduce(0) { $0 + ($1.weightInGrams * Double($1.quantity)) }
        return Pack(
            id: pack.id, userId: pack.userId, name: pack.name,
            description: pack.description, category: pack.category,
            isPublic: pack.isPublic, image: pack.image, tags: pack.tags,
            templateId: pack.templateId, deleted: pack.deleted,
            isAIGenerated: pack.isAIGenerated,
            items: items, totalWeight: total,
            baseWeight: base, wornWeight: worn,
            consumableWeight: consumable,
            createdAt: pack.createdAt, updatedAt: Date.iso8601Now()
        )
    }

    private func upsertCachedPack(_ pack: Pack, context: ModelContext?) {
        guard let context else { return }
        if let existing = try? context.fetch(FetchDescriptor<CachedPack>(predicate: #Predicate { $0.id == pack.id })).first {
            existing.name = pack.name
            existing.packDescription = pack.description
            existing.category = pack.category?.rawValue
            existing.isPublic = pack.isPublic
            existing.totalWeight = pack.totalWeight
            existing.baseWeight = pack.baseWeight
            existing.wornWeight = pack.wornWeight
            existing.consumableWeight = pack.consumableWeight
            existing.imageURL = pack.image
            existing.jsonData = try? JSONEncoder().encode(pack)
            existing.cachedAt = Date()
        } else {
            context.insert(CachedPack(from: pack))
        }
        try? context.save()
    }

    private func deleteCachedPack(_ packId: String, context: ModelContext?) {
        guard let context else { return }
        if let cached = try? context.fetch(FetchDescriptor<CachedPack>(predicate: #Predicate { $0.id == packId })).first {
            context.delete(cached)
            try? context.save()
        }
    }
}
