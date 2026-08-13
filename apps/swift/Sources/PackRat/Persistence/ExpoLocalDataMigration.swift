import Foundation
import OSLog
import SQLite3
import SwiftData

private let logger = Logger(subsystem: "com.packrat.app", category: "migration")

/// One-time import of pack data the Expo build kept only on the device.
///
/// The Swift app ships as a same-bundle-id update over the Expo build, so it inherits
/// that install's container — including Expo's SQLite store. Auth carries over via
/// `KeychainService`'s legacy read, and anything the Expo app had already synced comes
/// back from the server on first fetch. Two classes of data have no server copy and
/// would be lost silently without this:
///
/// 1. **Guest-mode content.** Expo gates every `syncedCrud` store on `waitFor: isAuthed`,
///    so a user who tapped "Continue without logging in" has packs that were *never*
///    uploaded. For them the device is the only copy.
/// 2. **Queued offline writes.** `syncedCrud` is configured with `retrySync: true` and
///    infinite retry, so a create made offline (or one the server rejected) sits in the
///    same SQLite store awaiting a retry that this install will never run.
///
/// Both live in Expo's `expo-sqlite/kv-store` database at
/// `<Documents>/SQLite/ExpoSQLiteStorage`, table `storage (key TEXT PRIMARY KEY, value TEXT)`,
/// under the keys Legend-State derives from each store's `persist.name` — `packs` and
/// `packItems`. Each value is a JSON object keyed by entity id.
///
/// Imported rows are written to the SwiftData cache *and* enqueued on the outbox as
/// creates, which is what actually rescues them: `OutboxService` replays creates in
/// `createdAt` order and holds child items until their parent pack lands, so a guest who
/// later signs in uploads their packs intact. Expo minted plain lowercase UUIDs for these
/// ids and the server accepts a client-supplied id on create, so a replayed create keeps
/// the id the item already has and child items keep valid foreign keys.
///
/// The source database is opened **read-only** and never modified. If the user rolls back
/// to the Expo build, their data is still there.
///
/// `@MainActor` to match `OutboxService`, which this has to call to queue the uploads.
@MainActor
enum ExpoLocalDataMigration {
    private static let defaultsKey = "expoLocalDataMigrationCompleted"

    /// Legend-State stores each observable under its `persist.name`.
    private static let packsKey = "packs"
    private static let packItemsKey = "packItems"

    /// Imports Expo's local packs and pack items, at most once per install.
    ///
    /// The completion flag is set only after an import that ran to completion. A failure
    /// to open or read the database leaves it clear so a later launch retries, matching
    /// `LegacyLocalIDMigration`. A missing database counts as complete: there is nothing
    /// to import and never will be.
    static func runIfNeeded(
        context: ModelContext?,
        outbox: OutboxService?,
        defaults: UserDefaults = .standard
    ) {
        guard let context, !defaults.bool(forKey: defaultsKey) else { return }

        guard let path = databasePath() else {
            logger.error("Could not resolve the documents directory; will retry next launch")
            return
        }

        guard FileManager.default.fileExists(atPath: path) else {
            // No Expo install preceded this one (fresh install, or already migrated and
            // the file removed). Nothing to do, ever.
            defaults.set(true, forKey: defaultsKey)
            return
        }

        if run(databasePath: path, context: context, outbox: outbox) != nil {
            defaults.set(true, forKey: defaultsKey)
        }
    }

    /// The import itself, without the run-once gate. Exposed for tests.
    ///
    /// Returns the number of packs imported, or `nil` if the database could not be read —
    /// in which case the import is incomplete and must not be recorded as done.
    @discardableResult
    static func run(
        databasePath: String,
        context: ModelContext,
        outbox: OutboxService?
    ) -> Int? {
        guard let rows = readStorageRows(at: databasePath) else {
            logger.error("Failed to read Expo's SQLite store; will retry next launch")
            return nil
        }

        let packs = decodeRecords(from: rows[packsKey])
        let items = decodeRecords(from: rows[packItemsKey])

        guard !packs.isEmpty || !items.isEmpty else { return 0 }

        // Ids already present in the Swift store came from the server on an earlier
        // launch of this build; the server copy wins and re-importing would enqueue a
        // duplicate create.
        let existingPackIDs = Set(
            (try? context.fetch(FetchDescriptor<CachedPack>()))?.map(\.id) ?? []
        )

        var imported = 0
        for record in packs {
            guard let id = record["id"] as? String, !id.isEmpty else { continue }
            // Expo tombstones rather than deleting; a tombstoned pack is not content.
            guard record["deleted"] as? Bool != true else { continue }
            guard !existingPackIDs.contains(id) else { continue }
            guard !LegacyLocalIDMigration.isLegacy(id) else { continue }
            guard let name = record["name"] as? String, !name.isEmpty else { continue }

            let itemsForPack = items.filter { item in
                item["packId"] as? String == id
                    && item["deleted"] as? Bool != true
                    && (item["name"] as? String)?.isEmpty == false
            }

            insertPack(record, named: name, id: id, items: itemsForPack, context: context)
            enqueuePack(record, named: name, id: id, items: itemsForPack, outbox: outbox, context: context)
            imported += 1
        }

        if imported > 0 {
            do {
                try context.save()
            } catch {
                logger.error("Failed to save imported Expo packs: \(error.localizedDescription, privacy: .public)")
                return nil
            }
            logger.info("Imported \(imported, privacy: .public) pack(s) from the Expo install")
        }

        return imported
    }

    // MARK: - SwiftData cache

    /// Writes the pack into the local cache so it is visible before the outbox drains.
    ///
    /// `CachedPack` derives everything from a `Pack`, and the app's weight rollups are
    /// computed from items, so the pack is rebuilt through `Pack` rather than by setting
    /// cache columns directly.
    private static func insertPack(
        _ record: [String: Any],
        named name: String,
        id: String,
        items: [[String: Any]],
        context: ModelContext
    ) {
        let packItems = items.compactMap { packItem(from: $0, packId: id) }
        let weights = weightTotals(of: packItems)

        let pack = Pack(
            id: id,
            userId: nil,
            name: name,
            description: record["description"] as? String,
            category: (record["category"] as? String).flatMap(PackCategory.init(rawValue:)),
            isPublic: record["isPublic"] as? Bool ?? false,
            image: record["image"] as? String,
            tags: record["tags"] as? [String],
            templateId: record["templateId"] as? String,
            deleted: false,
            isAIGenerated: record["isAIGenerated"] as? Bool,
            items: packItems,
            totalWeight: weights.total,
            baseWeight: weights.base,
            wornWeight: weights.worn,
            consumableWeight: weights.consumable,
            createdAt: record["localCreatedAt"] as? String ?? record["createdAt"] as? String,
            updatedAt: record["localUpdatedAt"] as? String ?? record["updatedAt"] as? String
        )
        context.insert(CachedPack(from: pack))
    }

    private static func packItem(from record: [String: Any], packId: String) -> PackItem? {
        guard let id = record["id"] as? String, !id.isEmpty,
              let name = record["name"] as? String, !name.isEmpty
        else { return nil }

        return PackItem(
            id: id,
            packId: packId,
            name: name,
            description: record["description"] as? String,
            weight: numeric(record["weight"]) ?? 0,
            weightUnit: (record["weightUnit"] as? String).flatMap(WeightUnit.init(rawValue:)) ?? .g,
            quantity: numeric(record["quantity"]).map { Int($0) } ?? 1,
            category: record["category"] as? String,
            consumable: record["consumable"] as? Bool ?? false,
            worn: record["worn"] as? Bool ?? false,
            image: record["image"] as? String,
            notes: record["notes"] as? String,
            catalogItemId: numeric(record["catalogItemId"]).map { Int($0) },
            userId: nil,
            deleted: false,
            isAIGenerated: record["isAIGenerated"] as? Bool,
            templateItemId: record["templateItemId"] as? String,
            createdAt: record["createdAt"] as? String,
            updatedAt: record["updatedAt"] as? String
        )
    }

    /// Weight rollups for the imported pack.
    ///
    /// The server computes these on read, but the cache is what the UI shows until the
    /// outbox drains and the first fetch returns — leaving them nil renders an imported
    /// pack as "0 g" next to items that plainly have weight. Mirrors the server's split:
    /// base excludes worn and consumable.
    private static func weightTotals(
        of items: [PackItem]
    ) -> (total: Double, base: Double, worn: Double, consumable: Double) {
        var total = 0.0, base = 0.0, worn = 0.0, consumable = 0.0
        for item in items {
            let grams = item.weight * item.weightUnit.gramsPerUnit * Double(item.quantity)
            total += grams
            if item.worn {
                worn += grams
            } else if item.consumable {
                consumable += grams
            } else {
                base += grams
            }
        }
        return (total, base, worn, consumable)
    }

    // MARK: - Outbox

    /// Queues the pack and its items as creates so they reach the server.
    ///
    /// This is the part that rescues guest-mode content: nothing else in the app would
    /// ever upload it. Items are queued with `parentId` set to the pack so
    /// `OutboxService` holds them until the pack itself lands.
    private static func enqueuePack(
        _ record: [String: Any],
        named name: String,
        id: String,
        items: [[String: Any]],
        outbox: OutboxService?,
        context: ModelContext
    ) {
        guard let outbox else { return }

        let packPayload = PackMutationPayload(
            name: name,
            description: record["description"] as? String,
            category: record["category"] as? String,
            isPublic: record["isPublic"] as? Bool ?? false
        )
        guard let encodedPack = try? JSONEncoder().encode(packPayload) else {
            logger.error("Failed to encode imported pack \(id, privacy: .public); skipping upload")
            return
        }

        outbox.enqueue(
            entityType: .pack,
            entityId: id,
            operation: .create,
            payload: encodedPack,
            context: context
        )

        for item in items {
            guard let itemId = item["id"] as? String, !itemId.isEmpty,
                  let itemName = item["name"] as? String, !itemName.isEmpty
            else { continue }

            let payload = PackItemMutationPayload(
                name: itemName,
                weight: numeric(item["weight"]),
                weightUnit: item["weightUnit"] as? String,
                quantity: numeric(item["quantity"]).map(Int.init),
                category: item["category"] as? String,
                consumable: item["consumable"] as? Bool ?? false,
                worn: item["worn"] as? Bool ?? false,
                notes: item["notes"] as? String,
                catalogItemId: numeric(item["catalogItemId"]).map(Int.init),
                image: item["image"] as? String
            )
            guard let encoded = try? JSONEncoder().encode(payload) else { continue }

            outbox.enqueue(
                entityType: .packItem,
                entityId: itemId,
                operation: .create,
                parentId: id,
                payload: encoded,
                context: context
            )
        }
    }

    // MARK: - Reading Expo's store

    /// `<Documents>/SQLite/ExpoSQLiteStorage` — the path `expo-sqlite`'s default
    /// `Storage` singleton uses (`defaultDatabaseDirectory` is `documentDirectory/SQLite`,
    /// and `kv-store` names the database `ExpoSQLiteStorage`).
    static func databasePath() -> String? {
        FileManager.default
            .urls(for: .documentDirectory, in: .userDomainMask)
            .first?
            .appendingPathComponent("SQLite/ExpoSQLiteStorage")
            .path
    }

    /// Reads the whole `storage` key/value table.
    ///
    /// Opened read-only so the Expo database is never mutated — a user who reinstalls the
    /// old build keeps their data. Returns `nil` only when the database cannot be opened
    /// or queried, which is what distinguishes "retry next launch" from "nothing here".
    private static func readStorageRows(at path: String) -> [String: String]? {
        var handle: OpaquePointer?
        // SQLITE_OPEN_READONLY alone still writes a WAL/journal if the file needs
        // recovery; the immutable URI flag guarantees the file is left untouched.
        let uri = "file:\(path)?immutable=1"
        guard sqlite3_open_v2(uri, &handle, SQLITE_OPEN_READONLY | SQLITE_OPEN_URI, nil) == SQLITE_OK,
              let db = handle
        else {
            if let handle { sqlite3_close(handle) }
            return nil
        }
        defer { sqlite3_close(db) }

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, "SELECT key, value FROM storage;", -1, &statement, nil) == SQLITE_OK,
              let stmt = statement
        else {
            // A readable file with no `storage` table is not an Expo kv-store. Treat it
            // as empty rather than retrying forever.
            if let statement { sqlite3_finalize(statement) }
            return [:]
        }
        defer { sqlite3_finalize(stmt) }

        var rows: [String: String] = [:]
        while sqlite3_step(stmt) == SQLITE_ROW {
            guard let keyC = sqlite3_column_text(stmt, 0),
                  let valueC = sqlite3_column_text(stmt, 1)
            else { continue }
            rows[String(cString: keyC)] = String(cString: valueC)
        }
        return rows
    }

    /// Legend-State persists each store as a JSON object keyed by entity id.
    private static func decodeRecords(from json: String?) -> [[String: Any]] {
        guard let json, let data = json.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return [] }

        return object.values.compactMap { $0 as? [String: Any] }
    }

    /// Numbers survive JSON as `NSNumber`, but a value the Expo app wrote as a string
    /// (or one that round-tripped through a text column) still needs to parse.
    private static func numeric(_ value: Any?) -> Double? {
        switch value {
        case let number as NSNumber: return number.doubleValue
        case let string as String: return Double(string)
        default: return nil
        }
    }
}
