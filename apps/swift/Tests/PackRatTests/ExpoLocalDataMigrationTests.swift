import Foundation
import SQLite3
import SwiftData
import Testing
@testable import PackRat

// Coverage for the Expo -> Swift local data import. `ExpoLocalDataMigration.run` was
// shipped with no tests at all despite exposing `run(databasePath:context:outbox:)`
// "for tests", which is how the outbox flood below reached TestFlight.
//
// The bug: the import enqueues an outbox `create` for every record it reads, deduping
// only against the SwiftData cache. On a signed-in user's first launch of the Swift
// build the cache is necessarily empty — nothing has synced yet, and the import
// deliberately runs *before* the first server fetch — so every pack the server already
// owns is re-queued as if it were unsynced guest content. That is the "210 changes
// waiting to sync" figure observed during the carryover QA run.

@Suite("ExpoLocalDataMigration outbox enqueue")
@MainActor
struct ExpoLocalDataMigrationOutboxTests {
    /// Writes an Expo-shaped Legend-State kv store: `storage(key, value)` where each
    /// value is a JSON object keyed by entity id. Mirrors what
    /// `<Documents>/SQLite/ExpoSQLiteStorage` actually contains.
    private func makeExpoDatabase(packs: [String: Any], packItems: [String: Any]) throws -> String {
        let path = FileManager.default.temporaryDirectory
            .appendingPathComponent("expo-\(UUID().uuidString).db").path

        var handle: OpaquePointer?
        #expect(sqlite3_open(path, &handle) == SQLITE_OK)
        guard let db = handle else { throw MigrationFixtureError.couldNotOpen }
        defer { sqlite3_close(db) }

        #expect(sqlite3_exec(
            db, "CREATE TABLE storage (key TEXT PRIMARY KEY, value TEXT);", nil, nil, nil
        ) == SQLITE_OK)

        for (key, value) in [("packs", packs), ("packItems", packItems)] {
            let json = String(
                data: try JSONSerialization.data(withJSONObject: value), encoding: .utf8
            )!
            let sql = "INSERT INTO storage (key, value) VALUES ('\(key)', '\(json)');"
            #expect(sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK)
        }
        return path
    }

    /// One pack with two items, as Expo would have persisted it.
    private func expoFixture() -> (packs: [String: Any], items: [String: Any]) {
        let packId = "3f8a1c2e-0b5d-4a71-9c33-8e2d5f7a1b04"
        let packs: [String: Any] = [packId: [
            "id": packId, "name": "Server Owned Pack", "category": "hiking", "isPublic": false,
        ]]
        let items: [String: Any] = [
            "aa11bb22-cc33-dd44-ee55-ff6677889900": [
                "id": "aa11bb22-cc33-dd44-ee55-ff6677889900", "packId": packId,
                "name": "Tent", "weight": 1200, "weightUnit": "g", "quantity": 1,
            ],
            "bb22cc33-dd44-ee55-ff66-778899001122": [
                "id": "bb22cc33-dd44-ee55-ff66-778899001122", "packId": packId,
                "name": "Stove", "weight": 300, "weightUnit": "g", "quantity": 2,
            ],
        ]
        return (packs, items)
    }

    private func makeContext() throws -> ModelContext {
        let container = try ModelContainer(
            for: PendingMutation.self, CachedPack.self, CachedTrip.self,
            configurations: ModelConfiguration(isStoredInMemoryOnly: true)
        )
        return ModelContext(container)
    }

    private func pending(_ context: ModelContext) -> [PendingMutation] {
        (try? context.fetch(FetchDescriptor<PendingMutation>())) ?? []
    }

    @Test("guest carryover queues the import so it can be uploaded on sign-in")
    func guestImportEnqueues() throws {
        let fixture = expoFixture()
        let path = try makeExpoDatabase(packs: fixture.packs, packItems: fixture.items)
        defer { try? FileManager.default.removeItem(atPath: path) }

        let context = try makeContext()
        let outbox = OutboxService()

        let imported = ExpoLocalDataMigration.run(
            databasePath: path, context: context, outbox: outbox
        )

        // This is the behaviour worth keeping: a guest's data exists nowhere else, so
        // queuing it is the only thing that rescues it.
        #expect(imported == 1)
        #expect(pending(context).count == 3) // 1 pack + 2 items
    }

    @Test("signed-in carryover does not re-queue packs the server already owns")
    func signedInImportDoesNotEnqueue() throws {
        let fixture = expoFixture()
        let path = try makeExpoDatabase(packs: fixture.packs, packItems: fixture.items)
        defer { try? FileManager.default.removeItem(atPath: path) }

        let context = try makeContext()
        let outbox = OutboxService()

        // The signed-in first launch: the cache is empty because nothing has synced
        // yet, and the import runs before the first `listPacks`. The pack nevertheless
        // already exists server-side, carried by the session the keychain migrated.
        #expect((try? context.fetch(FetchDescriptor<CachedPack>()))?.isEmpty == true)

        let imported = ExpoLocalDataMigration.run(
            databasePath: path, context: context, outbox: outbox, isSignedIn: true
        )

        // The rows still have to reach the local cache so they render on this first
        // launch, but they must not be queued as creates: the server has them, and
        // replaying a create against an id it already holds is a duplicate write.
        #expect(imported == 1)
        #expect(pending(context).isEmpty)

        // Suppressing the uploads must not cost the user their data on this launch —
        // the whole point of the import is that the packs are visible immediately.
        let cached = (try? context.fetch(FetchDescriptor<CachedPack>())) ?? []
        #expect(cached.count == 1)
        #expect(cached.first?.name == "Server Owned Pack")
    }

    @Test("cached ids are never re-queued")
    func cachedPacksAreSkipped() throws {
        let fixture = expoFixture()
        let path = try makeExpoDatabase(packs: fixture.packs, packItems: fixture.items)
        defer { try? FileManager.default.removeItem(atPath: path) }

        let context = try makeContext()
        context.insert(CachedPack(from: Pack(
            id: "3f8a1c2e-0b5d-4a71-9c33-8e2d5f7a1b04",
            userId: "user-1",
            name: "Server Owned Pack",
            description: nil,
            category: .hiking,
            isPublic: false,
            image: nil,
            tags: nil,
            templateId: nil,
            deleted: false,
            isAIGenerated: nil,
            items: nil,
            totalWeight: nil,
            baseWeight: nil,
            wornWeight: nil,
            consumableWeight: nil,
            createdAt: nil,
            updatedAt: nil
        )))
        try? context.save()

        let imported = ExpoLocalDataMigration.run(
            databasePath: path, context: context, outbox: OutboxService()
        )

        #expect(imported == 0)
        #expect(pending(context).isEmpty)
    }
}

enum MigrationFixtureError: Error {
    case couldNotOpen
}
