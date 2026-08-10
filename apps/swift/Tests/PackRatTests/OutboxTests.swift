import Foundation
import SwiftData
import Testing
@testable import PackRat

// Regression coverage for the offline write outbox. Each suite pins behaviour that
// was wrong before: retries burning their budget without delay, an expired session
// permanently failing a write, 429 treated as a bad payload, child item mutations
// stranded by a cancelled parent create, and cached rows from the retired `local-`
// id scheme queueing writes the server can only reject.

// MARK: - Retry classification

@Suite("OutboxService.classify")
@MainActor
struct OutboxClassifyTests {
    private let outbox = OutboxService()

    @Test("429 retries rather than failing the write")
    func rateLimitRetries() {
        let outcome = outbox.classify(
            PackRatError.httpError(statusCode: 429, message: nil), operation: .create
        )
        #expect(outcome == .retry("Server is busy (429)", chargesAttempt: true))
    }

    @Test("408 retries rather than failing the write")
    func requestTimeoutRetries() {
        let outcome = outbox.classify(
            PackRatError.httpError(statusCode: 408, message: nil), operation: .update
        )
        #expect(outcome == .retry("Server is busy (408)", chargesAttempt: true))
    }

    @Test("401 retries without spending an attempt")
    func unauthorizedStatusIsAttemptFree() {
        let outcome = outbox.classify(
            PackRatError.httpError(statusCode: 401, message: nil), operation: .create
        )
        #expect(outcome == .retry("Sign-in required to sync", chargesAttempt: false))
    }

    @Test("PackRatError.unauthorized retries without spending an attempt")
    func unauthorizedErrorIsAttemptFree() {
        let outcome = outbox.classify(PackRatError.unauthorized, operation: .create)
        #expect(outcome == .retry("Sign-in required to sync", chargesAttempt: false))
    }

    @Test("other 4xx stays terminal")
    func badRequestIsTerminal() {
        let outcome = outbox.classify(
            PackRatError.httpError(statusCode: 400, message: "Bad name"), operation: .create
        )
        #expect(outcome == .terminal("Bad name"))
    }

    @Test("5xx retries and spends an attempt")
    func serverErrorRetries() {
        let outcome = outbox.classify(
            PackRatError.httpError(statusCode: 503, message: nil), operation: .create
        )
        #expect(outcome == .retry("Server error (503)", chargesAttempt: true))
    }

    @Test("the server already agreeing counts as success")
    func idempotentResponsesSucceed() {
        #expect(outbox.classify(
            PackRatError.httpError(statusCode: 404, message: nil), operation: .delete
        ) == .success)
        #expect(outbox.classify(
            PackRatError.httpError(statusCode: 409, message: nil), operation: .create
        ) == .success)
    }
}

// MARK: - Backoff

@Suite("OutboxService backoff")
@MainActor
struct OutboxBackoffTests {
    @Test("delay grows with each attempt")
    func delayGrows() {
        let now = Date(timeIntervalSince1970: 1_000_000)
        let first = OutboxService.backoffDate(attemptCount: 1, from: now)
        let second = OutboxService.backoffDate(attemptCount: 2, from: now)
        let third = OutboxService.backoffDate(attemptCount: 3, from: now)

        #expect(first.timeIntervalSince(now) == 2)
        #expect(second.timeIntervalSince(now) == 4)
        #expect(third.timeIntervalSince(now) == 8)
    }

    @Test("a zero attempt count still waits, so an auth retry can't spin")
    func attemptFreeRetryStillWaits() {
        // An auth failure doesn't increment attemptCount. Without a floor the mutation
        // would be eligible again on the very next foreground.
        let now = Date(timeIntervalSince1970: 1_000_000)
        #expect(OutboxService.backoffDate(attemptCount: 0, from: now).timeIntervalSince(now) == 2)
    }

    @Test("delay is capped at the retry ceiling")
    func delayIsCapped() {
        let now = Date(timeIntervalSince1970: 1_000_000)
        let capped = OutboxService.backoffDate(attemptCount: 99, from: now)
        let atMax = OutboxService.backoffDate(attemptCount: OutboxService.maxAttempts, from: now)
        #expect(capped == atMax)
    }

    @Test("a new mutation is eligible immediately")
    func freshMutationIsEligible() {
        let mutation = PendingMutation(entityType: .pack, entityId: "p1", operation: .delete)
        #expect(mutation.nextAttemptAt == .distantPast)
    }
}

// MARK: - Enqueue collapsing

@Suite("OutboxService.enqueue")
@MainActor
struct OutboxEnqueueTests {
    /// In-memory store so each test gets a clean queue.
    private func makeContext() throws -> ModelContext {
        let container = try ModelContainer(
            for: PendingMutation.self, CachedPack.self, CachedTrip.self,
            configurations: ModelConfiguration(isStoredInMemoryOnly: true)
        )
        return ModelContext(container)
    }

    private func mutations(_ context: ModelContext) -> [PendingMutation] {
        (try? context.fetch(FetchDescriptor<PendingMutation>())) ?? []
    }

    private func payload() -> Data? {
        OutboxService.encode(PackMutationPayload(
            name: "Trip pack", description: nil, category: nil, isPublic: false
        ))
    }

    @Test("deleting a never-synced pack drops its queued child items")
    func parentCancellationCascades() throws {
        let context = try makeContext()
        let outbox = OutboxService()

        outbox.enqueue(
            entityType: .pack, entityId: "pack-1", operation: .create,
            payload: payload(), context: context
        )
        outbox.enqueue(
            entityType: .packItem, entityId: "item-1", operation: .create,
            parentId: "pack-1",
            payload: OutboxService.encode(PackItemMutationPayload(
                name: "Tent", weight: nil, weightUnit: nil, quantity: nil,
                category: nil, consumable: false, worn: false, notes: nil
            )),
            context: context
        )
        #expect(mutations(context).count == 2)

        // The pack was never created server-side, so the item create can never land.
        outbox.enqueue(
            entityType: .pack, entityId: "pack-1", operation: .delete, context: context
        )

        #expect(mutations(context).isEmpty)
        #expect(outbox.pendingCount == 0)
    }

    @Test("cancelling one pack leaves another pack's items alone")
    func cascadeIsScopedToTheParent() throws {
        let context = try makeContext()
        let outbox = OutboxService()

        outbox.enqueue(
            entityType: .pack, entityId: "pack-1", operation: .create,
            payload: payload(), context: context
        )
        outbox.enqueue(
            entityType: .packItem, entityId: "item-2", operation: .delete,
            parentId: "pack-2", context: context
        )

        outbox.enqueue(
            entityType: .pack, entityId: "pack-1", operation: .delete, context: context
        )

        let remaining = mutations(context)
        #expect(remaining.count == 1)
        #expect(remaining.first?.entityId == "item-2")
    }

    @Test("a create/update with no payload is refused rather than queued to fail")
    func payloadlessWriteIsRefused() throws {
        let context = try makeContext()
        let outbox = OutboxService()

        // Only reachable if encoding failed. Such a row could never replay — decode
        // would throw missingPayload and the write would be marked failed.
        outbox.enqueue(
            entityType: .pack, entityId: "pack-1", operation: .create,
            payload: nil, context: context
        )
        outbox.enqueue(
            entityType: .pack, entityId: "pack-2", operation: .update,
            payload: nil, context: context
        )

        #expect(mutations(context).isEmpty)
    }

    @Test("a delete still queues without a payload")
    func deleteNeedsNoPayload() throws {
        let context = try makeContext()
        let outbox = OutboxService()

        outbox.enqueue(
            entityType: .pack, entityId: "pack-1", operation: .delete, context: context
        )

        #expect(mutations(context).count == 1)
    }

    @Test("consecutive updates collapse to the latest payload")
    func updatesCollapse() throws {
        let context = try makeContext()
        let outbox = OutboxService()

        let first = OutboxService.encode(PackMutationPayload(
            name: "First", description: nil, category: nil, isPublic: false
        ))
        let second = OutboxService.encode(PackMutationPayload(
            name: "Second", description: nil, category: nil, isPublic: false
        ))
        outbox.enqueue(
            entityType: .pack, entityId: "pack-1", operation: .update,
            payload: first, context: context
        )
        outbox.enqueue(
            entityType: .pack, entityId: "pack-1", operation: .update,
            payload: second, context: context
        )

        let remaining = mutations(context)
        #expect(remaining.count == 1)
        let decoded = remaining.first?.payload.flatMap {
            try? JSONDecoder().decode(PackMutationPayload.self, from: $0)
        }
        #expect(decoded?.name == "Second")
    }
}

// MARK: - Legacy local id migration

@Suite("LegacyLocalIDMigration")
@MainActor
struct LegacyLocalIDMigrationTests {
    private func makeContext() throws -> ModelContext {
        let container = try ModelContainer(
            for: PendingMutation.self, CachedPack.self, CachedTrip.self,
            configurations: ModelConfiguration(isStoredInMemoryOnly: true)
        )
        return ModelContext(container)
    }

    private func makePack(id: String) -> Pack {
        Pack(
            id: id, userId: nil, name: "Pack", description: nil, category: nil,
            isPublic: false, image: nil, tags: nil, templateId: nil,
            deleted: false, isAIGenerated: false, items: [],
            totalWeight: 0, baseWeight: 0, wornWeight: 0, consumableWeight: 0,
            createdAt: Date.iso8601Now(), updatedAt: Date.iso8601Now()
        )
    }

    @Test("recognises ids from the retired scheme")
    func detectsLegacyIds() {
        #expect(LegacyLocalIDMigration.isLegacy("local-ABC"))
        #expect(LegacyLocalIDMigration.isLegacy("local-item-ABC"))
        #expect(!LegacyLocalIDMigration.isLegacy(UUID().uuidString.lowercased()))
    }

    @Test("drops cached packs and their queued writes")
    func dropsLegacyPacks() throws {
        let context = try makeContext()
        context.insert(CachedPack(from: makePack(id: "local-old-pack")))
        context.insert(CachedPack(from: makePack(id: "11111111-2222-3333-4444-555555555555")))
        context.insert(PendingMutation(
            entityType: .pack, entityId: "local-old-pack", operation: .delete
        ))
        // A child item under the legacy pack — its parentId is just as unusable.
        context.insert(PendingMutation(
            entityType: .packItem, entityId: "local-item-9", operation: .delete,
            parentId: "local-old-pack"
        ))
        try context.save()

        LegacyLocalIDMigration.run(context: context)

        let packs = (try? context.fetch(FetchDescriptor<CachedPack>())) ?? []
        #expect(packs.count == 1)
        #expect(packs.first?.id == "11111111-2222-3333-4444-555555555555")
        #expect(((try? context.fetch(FetchDescriptor<PendingMutation>())) ?? []).isEmpty)
    }

    @Test("leaves a clean store untouched")
    func noOpOnCleanStore() throws {
        let context = try makeContext()
        context.insert(CachedPack(from: makePack(id: "11111111-2222-3333-4444-555555555555")))
        try context.save()

        #expect(LegacyLocalIDMigration.run(context: context) == 0)
        #expect(((try? context.fetch(FetchDescriptor<CachedPack>())) ?? []).count == 1)
    }

    @Test("is idempotent")
    func isIdempotent() throws {
        let context = try makeContext()
        context.insert(CachedPack(from: makePack(id: "local-old-pack")))
        try context.save()

        #expect(LegacyLocalIDMigration.run(context: context) == 1)
        #expect(LegacyLocalIDMigration.run(context: context) == 0)
    }

    @Test("runs only once per install")
    func runsOnceViaFlag() throws {
        let context = try makeContext()
        let defaults = UserDefaults(suiteName: "LegacyLocalIDMigrationTests-\(UUID().uuidString)")!
        context.insert(CachedPack(from: makePack(id: "local-old-pack")))
        try context.save()

        LegacyLocalIDMigration.runIfNeeded(context: context, defaults: defaults)
        #expect(((try? context.fetch(FetchDescriptor<CachedPack>())) ?? []).isEmpty)

        // A legacy row written after the flag is set is not re-scanned — the retired
        // scheme can't produce new ids, so one pass is enough.
        context.insert(CachedPack(from: makePack(id: "local-another")))
        try context.save()
        LegacyLocalIDMigration.runIfNeeded(context: context, defaults: defaults)
        #expect(((try? context.fetch(FetchDescriptor<CachedPack>())) ?? []).count == 1)
    }
}
