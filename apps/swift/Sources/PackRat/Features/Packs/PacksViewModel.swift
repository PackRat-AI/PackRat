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
    private let outbox: OutboxService

    init(service: PackService = .shared, outbox: OutboxService = .shared) {
        self.service = service
        self.outbox = outbox
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
            }
            isCacheLoaded = true
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
            if packs.isEmpty {
                // Keep the personal store local-first: an unavailable refresh
                // should not replace an otherwise usable empty local library
                // with a blocking connection error.
                isCacheLoaded = true
            } else {
                self.error = error.localizedDescription
            }
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
        let payload = PackMutationPayload(
            name: name, description: description, category: category, isPublic: isPublic
        )

        func queueCreate() {
            outbox.enqueue(
                entityType: .pack,
                entityId: localPack.id,
                operation: .create,
                payload: OutboxService.encode(payload),
                context: context
            )
        }

        guard canUseRemotePersonalStore else {
            packs.insert(localPack, at: 0)
            upsertCachedPack(localPack, context: context)
            queueCreate()
            return
        }

        let pack: Pack
        do {
            // Send the local id so a retry can't create a duplicate record.
            pack = try await service.createPack(
                id: localPack.id, name: name, description: description,
                category: category, isPublic: isPublic
            )
        } catch {
            pack = localPack
            queueCreate()
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

        let payload = PackMutationPayload(
            name: name, description: description, category: category, isPublic: isPublic
        )
        func queueUpdate() {
            outbox.enqueue(
                entityType: .pack,
                entityId: packId,
                operation: .update,
                payload: OutboxService.encode(payload),
                context: context
            )
        }

        let updated: Pack
        if canUseRemotePersonalStore {
            do {
                updated = try await service.updatePack(
                    packId, name: name, description: description, category: category, isPublic: isPublic
                )
            } catch {
                updated = localUpdated
                queueUpdate()
            }
        } else {
            updated = localUpdated
            queueUpdate()
        }
        if let idx = packs.firstIndex(where: { $0.id == packId }) {
            packs[idx] = updated
        }
        upsertCachedPack(updated, context: context)
    }

    /// Optimistic delete. The removal always sticks locally — an unreachable server
    /// queues the delete for replay rather than resurrecting the pack, so delete now
    /// behaves like create and update.
    func deletePack(_ packId: String, context: ModelContext? = nil) async throws {
        guard let idx = packs.firstIndex(where: { $0.id == packId }) else { return }
        packs.remove(at: idx)
        deleteCachedPack(packId, context: context)

        func queueDelete() {
            outbox.enqueue(
                entityType: .pack,
                entityId: packId,
                operation: .delete,
                context: context
            )
        }

        guard canUseRemotePersonalStore else {
            queueDelete()
            return
        }
        do {
            try await service.deletePack(packId)
        } catch {
            queueDelete()
        }
    }

    func addItem(to packId: String, name: String, weight: Double?, weightUnit: String?,
                 quantity: Int?, category: String?, consumable: Bool, worn: Bool, notes: String?,
                 catalogItemId: Int? = nil, image: String? = nil,
                 context: ModelContext? = nil) async throws {
        let localItem = makeLocalItem(
            packId: packId, name: name, weight: weight, weightUnit: weightUnit,
            quantity: quantity, category: category, consumable: consumable, worn: worn, notes: notes,
            catalogItemId: catalogItemId, image: image
        )
        let payload = PackItemMutationPayload(
            name: name, weight: weight, weightUnit: weightUnit, quantity: quantity,
            category: category, consumable: consumable, worn: worn, notes: notes
        )
        func queueCreate() {
            outbox.enqueue(
                entityType: .packItem,
                entityId: localItem.id,
                operation: .create,
                parentId: packId,
                payload: OutboxService.encode(payload),
                context: context
            )
        }

        let item: PackItem
        if canUseRemotePersonalStore {
            do {
                item = try await service.addItem(
                    to: packId, id: localItem.id, name: name, weight: weight, weightUnit: weightUnit,
                    quantity: quantity, category: category, consumable: consumable, worn: worn, notes: notes,
                    catalogItemId: catalogItemId, image: image
                )
            } catch {
                item = localItem
                queueCreate()
            }
        } else {
            item = localItem
            queueCreate()
        }
        if let idx = packs.firstIndex(where: { $0.id == packId }) {
            var items = packs[idx].items ?? []
            items.append(item)
            packs[idx] = rebuildPack(packs[idx], items: items)
            upsertCachedPack(packs[idx], context: context)
        }
    }

    /// Adds several catalog items to a pack in one pass.
    ///
    /// Sequential rather than concurrent, matching Expo's `useBulkAddCatalogItems`:
    /// each add mutates the same pack row server-side, so parallel writes race on
    /// the pack's recomputed weights. Returns the number added — a partial
    /// failure still keeps whatever succeeded rather than rolling back, so the
    /// caller can report "added 3 of 5".
    @discardableResult
    func addCatalogItems(
        _ selections: [(item: CatalogItem, quantity: Int)],
        to packId: String,
        context: ModelContext? = nil
    ) async -> (added: Int, failed: Int) {
        var added = 0
        var failed = 0
        for selection in selections {
            let item = selection.item
            do {
                try await addItem(
                    to: packId,
                    name: item.name,
                    weight: item.weight,
                    // Catalog weight/unit are both optional — an item with no
                    // published weight is added at 0 g for the user to fill in
                    // rather than being skipped.
                    weightUnit: item.weightUnit?.rawValue,
                    quantity: selection.quantity,
                    // Expo sends the item's own category or '' and lets the
                    // server bucket it; keep the first catalog facet instead so
                    // the pack's category grouping stays meaningful.
                    category: item.categories?.first,
                    consumable: false,
                    worn: false,
                    notes: nil,
                    catalogItemId: item.id,
                    image: item.primaryImage,
                    context: context
                )
                added += 1
            } catch {
                failed += 1
            }
        }
        return (added, failed)
    }

    /// Adds vision-detected items to a pack.
    ///
    /// Weight comes from the best catalog match when there is one — the vision
    /// model returns a name/category/quantity but never a weight, so an
    /// unmatched detection lands at 0 g for the user to fill in.
    @discardableResult
    func addDetectedItems(
        _ detections: [DetectedItemWithMatches],
        to packId: String,
        context: ModelContext? = nil
    ) async -> (added: Int, failed: Int) {
        var added = 0
        var failed = 0
        for detection in detections {
            let detected = detection.detected
            let match = detection.primaryMatch
            do {
                try await addItem(
                    to: packId,
                    name: detected.name,
                    weight: match?.weight,
                    weightUnit: match?.weightUnit?.rawValue,
                    quantity: detected.quantity,
                    category: detected.category.isEmpty ? match?.categories?.first : detected.category,
                    consumable: detected.consumable,
                    worn: detected.worn,
                    notes: detected.notes,
                    catalogItemId: match?.id,
                    image: match?.primaryImage,
                    context: context
                )
                added += 1
            } catch {
                failed += 1
            }
        }
        return (added, failed)
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
            let payload = PackItemMutationPayload(
                name: name,
                weight: weight ?? current?.weight,
                weightUnit: weightUnit ?? current?.weightUnit.rawValue,
                quantity: quantity ?? current?.quantity,
                category: category ?? current?.category,
                consumable: consumable,
                worn: worn,
                notes: notes ?? current?.notes
            )
            func queueUpdate() {
                outbox.enqueue(
                    entityType: .packItem,
                    entityId: itemId,
                    operation: .update,
                    parentId: packId,
                    payload: OutboxService.encode(payload),
                    context: context
                )
            }

            let updated: PackItem
            if canUseRemotePersonalStore {
                do {
                    updated = try await service.updateItem(
                        itemId, in: packId, name: name, weight: weight, weightUnit: weightUnit,
                        quantity: quantity, category: category, consumable: consumable, worn: worn, notes: notes
                    )
                } catch {
                    updated = localUpdated
                    queueUpdate()
                }
            } else {
                updated = localUpdated
                queueUpdate()
            }
            var items = packs[packIdx].items ?? []
            items[itemIdx] = updated
            packs[packIdx] = rebuildPack(packs[packIdx], items: items)
            upsertCachedPack(packs[packIdx], context: context)
        }
    }

    /// Optimistic item delete. Like `deletePack`, a failed or offline delete stays
    /// deleted locally and is queued for replay instead of being rolled back.
    func deleteItem(_ itemId: String, from packId: String, context: ModelContext? = nil) async throws {
        guard let packIdx = packs.firstIndex(where: { $0.id == packId }),
              let itemIdx = packs[packIdx].items?.firstIndex(where: { $0.id == itemId }) else { return }
        var items = packs[packIdx].items ?? []
        items.remove(at: itemIdx)
        packs[packIdx] = rebuildPack(packs[packIdx], items: items)
        upsertCachedPack(packs[packIdx], context: context)

        func queueDelete() {
            outbox.enqueue(
                entityType: .packItem,
                entityId: itemId,
                operation: .delete,
                parentId: packId,
                context: context
            )
        }

        guard canUseRemotePersonalStore else {
            queueDelete()
            return
        }
        do {
            try await service.deleteItem(itemId, from: packId)
        } catch {
            queueDelete()
        }
    }

    private func makeLocalPack(name: String, description: String?, category: String?, isPublic: Bool) -> Pack {
        let now = Date.iso8601Now()
        // A plain client UUID — the same scheme the server accepts on create — so an
        // offline pack is syncable as-is. No `local-` prefix to reconcile later.
        return Pack(
            id: UUID().uuidString.lowercased(), userId: nil, name: name,
            description: description, category: PackCategory(rawValue: category ?? ""),
            isPublic: isPublic, image: nil, tags: nil, templateId: nil,
            deleted: false, isAIGenerated: false, items: [],
            totalWeight: 0, baseWeight: 0, wornWeight: 0, consumableWeight: 0,
            createdAt: now, updatedAt: now
        )
    }

    private func makeLocalItem(
        id: String = UUID().uuidString.lowercased(),
        packId: String,
        name: String,
        weight: Double?,
        weightUnit: String?,
        quantity: Int?,
        category: String?,
        consumable: Bool,
        worn: Bool,
        notes: String?,
        catalogItemId: Int? = nil,
        image: String? = nil
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
            image: image,
            notes: notes,
            catalogItemId: catalogItemId,
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
