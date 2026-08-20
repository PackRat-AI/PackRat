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
/// under the keys Legend-State derives from each store's `persist.name` (see `StoreKey`).
/// Each value is a JSON object keyed by entity id.
///
/// Covers every store Expo persists through that plugin:
///
/// | Store | Destination |
/// |---|---|
/// | `packs`, `packItems` | SwiftData cache + outbox |
/// | `trips` | SwiftData cache + outbox |
/// | `packTemplates`, `packTemplateItems` | outbox (no local cache exists) |
/// | `trail_condition_reports` | outbox (no local cache exists) |
/// | `packingMode` | `UserDefaults` — never had a server copy |
/// | `userPreferences` | `UserDefaults` weight unit |
/// | `packWeigthHistory` | *skipped* — server-derived, no create endpoint |
/// | `user` | *skipped* — re-fetched from the session `KeychainService` migrates |
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

    /// Legend-State stores each observable under its `persist.name`. These are the
    /// literal names from `apps/expo/features/**/store/*.ts` — including the misspelled
    /// `packWeigthHistory`, which has to match the key Expo actually wrote.
    private enum StoreKey {
        static let packs = "packs"
        static let packItems = "packItems"
        static let trips = "trips"
        static let packTemplates = "packTemplates"
        static let packTemplateItems = "packTemplateItems"
        static let trailConditionReports = "trail_condition_reports"
        static let packingMode = "packingMode"
        static let preferences = "userPreferences"
        /// `apps/expo/features/packs/store/packWeightHistory.ts` persists under this
        /// misspelling. Not a typo here — correcting it would read a key that never
        /// existed on disk.
        static let packWeightHistory = "packWeigthHistory"
    }

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

        // A signed-in user's Expo data was already synced to the server by Legend-State
        // (every store is a `syncedCrud`), so it will arrive on the first fetch. Queuing
        // it would replay a create for an id the server already holds — a duplicate
        // write per record, and the "N changes waiting to sync" banner sitting over an
        // import that needed no uploading at all.
        let isSignedIn = KeychainService.shared.sessionToken != nil

        if run(
            databasePath: path, context: context, outbox: outbox, isSignedIn: isSignedIn
        ) != nil {
            defaults.set(true, forKey: defaultsKey)
        }
    }

    /// The import itself, without the run-once gate. Exposed for tests.
    ///
    /// Returns the number of packs imported, or `nil` if the database could not be read —
    /// in which case the import is incomplete and must not be recorded as done.
    /// `isSignedIn` suppresses the outbox uploads. The rows still reach the local cache
    /// so they render on this first launch; they are simply not re-queued as creates,
    /// because a signed-in user's Expo stores were server-synced and the server already
    /// holds these ids. Guests keep the uploads — the outbox is the only thing that can
    /// ever carry their content to an account.
    @discardableResult
    static func run(
        databasePath: String,
        context: ModelContext,
        outbox: OutboxService?,
        isSignedIn: Bool = false
    ) -> Int? {
        guard let rows = readStorageRows(at: databasePath) else {
            logger.error("Failed to read Expo's SQLite store; will retry next launch")
            return nil
        }

        let uploads = isSignedIn ? nil : outbox

        var imported = 0
        imported += importPacks(rows: rows, context: context, outbox: uploads)
        imported += importTrips(rows: rows, context: context, outbox: uploads)
        imported += importTemplates(rows: rows, outbox: uploads, context: context)
        imported += importTrailConditionReports(rows: rows, outbox: uploads, context: context)

        // Local-only state: no server copy exists for either, so for *every* user — not
        // just guests — this is the only chance to carry it across.
        importPackingMode(rows: rows)
        importPreferences(rows: rows)

        // `packWeigthHistory` is deliberately not imported. It is a derived log the
        // server recomputes from pack contents, there is no create endpoint for it, and
        // the Swift app reads history from the API. Importing would mean inventing rows
        // the server would immediately contradict.

        if imported > 0 {
            do {
                try context.save()
            } catch {
                logger.error("Failed to save imported Expo data: \(error.localizedDescription, privacy: .public)")
                return nil
            }
            logger.info("Imported \(imported, privacy: .public) record(s) from the Expo install")
        }

        return imported
    }

    // MARK: - Packs

    private static func importPacks(
        rows: [String: String],
        context: ModelContext,
        outbox: OutboxService?
    ) -> Int {
        let packs = decodeRecords(from: rows[StoreKey.packs])
        let items = decodeRecords(from: rows[StoreKey.packItems])
        guard !packs.isEmpty else { return 0 }

        // Ids already present in the Swift store came from the server on an earlier
        // launch of this build; the server copy wins and re-importing would enqueue a
        // duplicate create.
        let existing = Set((try? context.fetch(FetchDescriptor<CachedPack>()))?.map(\.id) ?? [])

        var imported = 0
        for record in packs {
            guard let id = importableID(record, existing: existing),
                  let name = nonEmpty(record["name"])
            else { continue }

            let itemsForPack = items.filter { item in
                item["packId"] as? String == id
                    && item["deleted"] as? Bool != true
                    && nonEmpty(item["name"]) != nil
            }

            insertPack(record, named: name, id: id, items: itemsForPack, context: context)
            enqueuePack(record, named: name, id: id, items: itemsForPack, outbox: outbox, context: context)
            imported += 1
        }
        return imported
    }

    // MARK: - Trips

    private static func importTrips(
        rows: [String: String],
        context: ModelContext,
        outbox: OutboxService?
    ) -> Int {
        let trips = decodeRecords(from: rows[StoreKey.trips])
        guard !trips.isEmpty else { return 0 }

        let existing = Set((try? context.fetch(FetchDescriptor<CachedTrip>()))?.map(\.id) ?? [])

        var imported = 0
        for record in trips {
            guard let id = importableID(record, existing: existing),
                  let name = nonEmpty(record["name"])
            else { continue }

            // Expo nests location as `{ latitude, longitude, name }`; the Swift payload
            // carries it flattened.
            let location = record["location"] as? [String: Any]
            let latitude = numeric(location?["latitude"])
            let longitude = numeric(location?["longitude"])

            let trip = Trip(
                id: id,
                name: name,
                description: record["description"] as? String,
                notes: record["notes"] as? String,
                location: {
                    guard let latitude, let longitude else { return nil }
                    return TripLocation(
                        latitude: latitude,
                        longitude: longitude,
                        name: location?["name"] as? String
                    )
                }(),
                startDate: record["startDate"] as? String,
                endDate: record["endDate"] as? String,
                userId: nil,
                packId: record["packId"] as? String,
                deleted: false,
                createdAt: record["localCreatedAt"] as? String ?? record["createdAt"] as? String,
                updatedAt: record["localUpdatedAt"] as? String ?? record["updatedAt"] as? String
            )
            context.insert(CachedTrip(from: trip))

            let payload = TripMutationPayload(
                name: name,
                description: record["description"] as? String,
                startDate: record["startDate"] as? String,
                endDate: record["endDate"] as? String,
                latitude: latitude,
                longitude: longitude,
                locationName: location?["name"] as? String,
                notes: record["notes"] as? String,
                packId: record["packId"] as? String
            )
            enqueue(.trip, id: id, payload: payload, outbox: outbox, context: context)
            imported += 1
        }
        return imported
    }

    // MARK: - Pack templates

    /// Templates and their items have no SwiftData cache — the app reads them from the
    /// API — so these are queued for upload only. Without that, a guest's own templates
    /// are gone.
    private static func importTemplates(
        rows: [String: String],
        outbox: OutboxService?,
        context: ModelContext
    ) -> Int {
        let templates = decodeRecords(from: rows[StoreKey.packTemplates])
        let items = decodeRecords(from: rows[StoreKey.packTemplateItems])
        guard !templates.isEmpty else { return 0 }

        var imported = 0
        for record in templates {
            guard let id = importableID(record, existing: []),
                  let name = nonEmpty(record["name"])
            else { continue }
            // App-provided templates belong to the server's catalogue, not the user.
            guard record["isAppTemplate"] as? Bool != true else { continue }

            let payload = PackTemplateMutationPayload(
                name: name,
                description: record["description"] as? String,
                category: record["category"] as? String ?? "custom",
                image: record["image"] as? String,
                tags: record["tags"] as? [String]
            )
            enqueue(.packTemplate, id: id, payload: payload, outbox: outbox, context: context)
            imported += 1

            for item in items where item["packTemplateId"] as? String == id {
                guard item["deleted"] as? Bool != true,
                      let itemId = importableID(item, existing: []),
                      let itemName = nonEmpty(item["name"])
                else { continue }

                let itemPayload = PackTemplateItemMutationPayload(
                    name: itemName,
                    description: item["description"] as? String,
                    weight: numeric(item["weight"]),
                    weightUnit: item["weightUnit"] as? String,
                    quantity: numeric(item["quantity"]).map { Int($0) } ?? 1,
                    category: item["category"] as? String,
                    consumable: item["consumable"] as? Bool ?? false,
                    worn: item["worn"] as? Bool ?? false,
                    notes: item["notes"] as? String,
                    image: item["image"] as? String
                )
                enqueue(
                    .packTemplateItem, id: itemId, payload: itemPayload,
                    parentId: id, outbox: outbox, context: context
                )
                imported += 1
            }
        }
        return imported
    }

    // MARK: - Trail condition reports

    private static func importTrailConditionReports(
        rows: [String: String],
        outbox: OutboxService?,
        context: ModelContext
    ) -> Int {
        let reports = decodeRecords(from: rows[StoreKey.trailConditionReports])
        guard !reports.isEmpty else { return 0 }

        var imported = 0
        for record in reports {
            guard let id = importableID(record, existing: []),
                  let trailName = nonEmpty(record["trailName"]),
                  let condition = nonEmpty(record["overallCondition"])
            else { continue }

            let payload = TrailConditionReportMutationPayload(
                trailName: trailName,
                trailRegion: record["trailRegion"] as? String,
                surface: record["surface"] as? String,
                overallCondition: condition,
                hazards: record["hazards"] as? [String],
                waterCrossings: record["waterCrossings"] as? Bool,
                waterCrossingDifficulty: record["waterCrossingDifficulty"] as? String,
                notes: record["notes"] as? String,
                photos: record["photos"] as? [String],
                tripId: record["tripId"] as? String
            )
            enqueue(.trailConditionReport, id: id, payload: payload, outbox: outbox, context: context)
            imported += 1
        }
        return imported
    }

    // MARK: - Local-only state

    /// Carries over which items are checked off as packed.
    ///
    /// `pack_items` has no `isPacked` column and no endpoint exists, so this state has
    /// never left the device for anyone. Both apps use the same
    /// `[packId: [itemId: Bool]]` shape under the same `packingMode` key —
    /// Expo in its SQLite store, Swift in `UserDefaults` — so this is a straight copy.
    /// Existing Swift state wins so a re-run can't clobber packing done since.
    private static func importPackingMode(rows: [String: String], defaults: UserDefaults = .standard) {
        guard defaults.object(forKey: "packingMode") == nil,
              let json = rows[StoreKey.packingMode],
              let data = json.data(using: .utf8),
              let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return }

        // Keep only `true` entries, matching PackingModeStore's on-disk contract.
        var state: [String: [String: Bool]] = [:]
        for (packId, value) in raw {
            guard let items = value as? [String: Any] else { continue }
            let packed = items.compactMapValues { $0 as? Bool }.filter { $0.value }
            if !packed.isEmpty { state[packId] = packed }
        }
        guard !state.isEmpty else { return }

        defaults.set(state, forKey: "packingMode")
        logger.info("Imported packed state for \(state.count, privacy: .public) pack(s)")
    }

    /// Carries the weight unit across.
    ///
    /// Expo's preferences store is server-backed, so a signed-in user's preference
    /// returns on first fetch — but a guest's never synced, and the Swift app reads the
    /// unit from `@AppStorage(AppWeightUnit.storageKey)`, which a fresh install defaults
    /// to grams. Only set when the user hasn't already chosen one in this build.
    ///
    /// Expo persists `'kg' | 'lb'`; `AppWeightUnit` is the Swift-side display setting.
    /// Temperature and speed units are skipped: the Swift app has no equivalent setting
    /// to write them into, so there is nothing to carry them to.
    private static func importPreferences(rows: [String: String], defaults: UserDefaults = .standard) {
        guard defaults.object(forKey: AppWeightUnit.storageKey) == nil,
              let json = rows[StoreKey.preferences],
              let data = json.data(using: .utf8),
              let prefs = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let unit = prefs["weightUnit"] as? String
        else { return }

        switch unit {
        case "kg": defaults.set(AppWeightUnit.kg.rawValue, forKey: AppWeightUnit.storageKey)
        case "lb": defaults.set(AppWeightUnit.lb.rawValue, forKey: AppWeightUnit.storageKey)
        default: return
        }
        logger.info("Imported weight unit preference '\(unit, privacy: .public)'")
    }

    // MARK: - Shared helpers

    /// An id worth importing: present, not tombstoned, not from the retired `local-`
    /// scheme, and not already known to this install.
    private static func importableID(_ record: [String: Any], existing: Set<String>) -> String? {
        guard let id = record["id"] as? String, !id.isEmpty,
              record["deleted"] as? Bool != true,
              !LegacyLocalIDMigration.isLegacy(id),
              !existing.contains(id)
        else { return nil }
        return id
    }

    private static func nonEmpty(_ value: Any?) -> String? {
        guard let string = value as? String, !string.isEmpty else { return nil }
        return string
    }

    /// Encodes and queues a create, logging rather than throwing if encoding fails —
    /// one bad record must not abort the rest of the import.
    private static func enqueue<Payload: Encodable>(
        _ entityType: OutboxEntityType,
        id: String,
        payload: Payload,
        parentId: String? = nil,
        outbox: OutboxService?,
        context: ModelContext
    ) {
        guard let outbox else { return }
        guard let encoded = try? JSONEncoder().encode(payload) else {
            logger.error(
                "Failed to encode imported \(entityType.rawValue, privacy: .public) \(id, privacy: .public); skipping upload"
            )
            return
        }
        outbox.enqueue(
            entityType: entityType,
            entityId: id,
            operation: .create,
            parentId: parentId,
            payload: encoded,
            context: context
        )
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
        enqueue(
            .pack,
            id: id,
            payload: PackMutationPayload(
                name: name,
                description: record["description"] as? String,
                category: record["category"] as? String,
                isPublic: record["isPublic"] as? Bool ?? false
            ),
            outbox: outbox,
            context: context
        )

        for item in items {
            guard let itemId = item["id"] as? String, !itemId.isEmpty,
                  let itemName = nonEmpty(item["name"])
            else { continue }

            enqueue(
                .packItem,
                id: itemId,
                payload: PackItemMutationPayload(
                    name: itemName,
                    weight: numeric(item["weight"]),
                    weightUnit: item["weightUnit"] as? String,
                    quantity: numeric(item["quantity"]).map { Int($0) },
                    category: item["category"] as? String,
                    consumable: item["consumable"] as? Bool ?? false,
                    worn: item["worn"] as? Bool ?? false,
                    notes: item["notes"] as? String,
                    catalogItemId: numeric(item["catalogItemId"]).map { Int($0) },
                    image: item["image"] as? String
                ),
                parentId: id,
                outbox: outbox,
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
