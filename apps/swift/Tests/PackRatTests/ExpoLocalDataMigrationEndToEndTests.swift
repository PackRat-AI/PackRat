import Foundation
import SQLite3
import SwiftData
import Testing
@testable import PackRat

// End-to-end coverage for `runIfNeeded`, the entry point the app actually calls.
//
// `ExpoLocalDataMigrationOutboxTests` drives `run(databasePath:…)` with `isSignedIn`
// injected, so it proves the import's behaviour but not the wiring: nothing checked
// that `runIfNeeded` reads the session, resolves the real database path, or honours the
// run-once flag. This suite writes a fixture to the same `<Documents>/SQLite` path the
// app reads and drives the real thing, keychain included.
//
// `.serialized` because these tests mutate `KeychainService.shared` and a file on disk
// at a fixed path; two of them interleaving would read each other's state.
@Suite("ExpoLocalDataMigration.runIfNeeded", .serialized)
@MainActor
struct ExpoLocalDataMigrationEndToEndTests {
    private let keychain = KeychainService.shared

    /// Writes an Expo-shaped kv store to the path `databasePath()` resolves to.
    private func seedExpoDatabase() throws {
        guard let path = ExpoLocalDataMigration.databasePath() else {
            throw MigrationEndToEndError.noDocumentsDirectory
        }
        try FileManager.default.createDirectory(
            at: URL(fileURLWithPath: path).deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try? FileManager.default.removeItem(atPath: path)

        var handle: OpaquePointer?
        guard sqlite3_open(path, &handle) == SQLITE_OK, let db = handle else {
            throw MigrationEndToEndError.couldNotOpen
        }
        defer { sqlite3_close(db) }

        #expect(sqlite3_exec(
            db, "CREATE TABLE storage (key TEXT PRIMARY KEY, value TEXT);", nil, nil, nil
        ) == SQLITE_OK)

        let packId = "7c9e1a44-2b3d-4e55-8f61-0a2b3c4d5e6f"
        let packs = [packId: [
            "id": packId, "name": "Carried Over Pack", "category": "hiking", "isPublic": false,
        ] as [String: Any]]
        let items = ["8d0f2b55-3c4e-4f66-9a72-1b2c3d4e5f60": [
            "id": "8d0f2b55-3c4e-4f66-9a72-1b2c3d4e5f60", "packId": packId,
            "name": "Tent", "weight": 1200, "weightUnit": "g", "quantity": 1,
        ] as [String: Any]]

        for (key, value) in [("packs", packs), ("packItems", items)] {
            let json = String(
                data: try JSONSerialization.data(withJSONObject: value), encoding: .utf8
            )!
            #expect(sqlite3_exec(
                db, "INSERT INTO storage (key, value) VALUES ('\(key)', '\(json)');", nil, nil, nil
            ) == SQLITE_OK)
        }
    }

    private func removeExpoDatabase() {
        guard let path = ExpoLocalDataMigration.databasePath() else { return }
        try? FileManager.default.removeItem(atPath: path)
    }

    private func makeContext() throws -> ModelContext {
        let container = try ModelContainer(
            for: PendingMutation.self, CachedPack.self, CachedTrip.self,
            configurations: ModelConfiguration(isStoredInMemoryOnly: true)
        )
        return ModelContext(container)
    }

    /// A defaults domain of its own, so the run-once flag never leaks between tests or
    /// into the app's real preferences.
    private func makeDefaults() -> UserDefaults {
        let suite = UserDefaults(suiteName: "migration-e2e-\(UUID().uuidString)")!
        suite.removePersistentDomain(forName: suite.description)
        return suite
    }

    private func pending(_ context: ModelContext) -> [PendingMutation] {
        (try? context.fetch(FetchDescriptor<PendingMutation>())) ?? []
    }

    @Test("a signed-in carryover imports the data without queueing uploads")
    func signedInCarryoverQueuesNothing() throws {
        try seedExpoDatabase()
        defer { removeExpoDatabase(); keychain.clearTokens() }

        keychain.saveSessionToken("carried-over-session")
        let context = try makeContext()
        let defaults = makeDefaults()

        ExpoLocalDataMigration.runIfNeeded(
            context: context, outbox: OutboxService(), defaults: defaults
        )

        // The pack is visible on this first launch...
        let cached = (try? context.fetch(FetchDescriptor<CachedPack>())) ?? []
        #expect(cached.count == 1)
        #expect(cached.first?.name == "Carried Over Pack")
        // ...and nothing is queued, so no banner and no duplicate creates.
        #expect(pending(context).isEmpty)
        #expect(defaults.bool(forKey: "expoLocalDataMigrationCompleted"))
    }

    @Test("a guest carryover queues the import so signing in can upload it")
    func guestCarryoverQueuesUploads() throws {
        try seedExpoDatabase()
        defer { removeExpoDatabase() }

        keychain.clearTokens()
        let context = try makeContext()
        let defaults = makeDefaults()

        ExpoLocalDataMigration.runIfNeeded(
            context: context, outbox: OutboxService(), defaults: defaults
        )

        #expect(((try? context.fetch(FetchDescriptor<CachedPack>())) ?? []).count == 1)
        #expect(pending(context).count == 2) // 1 pack + 1 item
    }

    @Test("the run-once flag stops a second import")
    func runsOnlyOnce() throws {
        try seedExpoDatabase()
        defer { removeExpoDatabase(); keychain.clearTokens() }

        keychain.clearTokens()
        let context = try makeContext()
        let defaults = makeDefaults()

        ExpoLocalDataMigration.runIfNeeded(
            context: context, outbox: OutboxService(), defaults: defaults
        )
        let afterFirst = pending(context).count

        ExpoLocalDataMigration.runIfNeeded(
            context: context, outbox: OutboxService(), defaults: defaults
        )

        #expect(pending(context).count == afterFirst)
        #expect(((try? context.fetch(FetchDescriptor<CachedPack>())) ?? []).count == 1)
    }
}

enum MigrationEndToEndError: Error {
    case noDocumentsDirectory
    case couldNotOpen
}
