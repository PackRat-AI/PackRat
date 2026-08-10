import Foundation
import OSLog
import SwiftData

private let logger = Logger(subsystem: "com.packrat.app", category: "migration")

/// One-time cleanup of cached entities created by builds that minted local ids as
/// `local-<uuid>` (packs, trips) and `local-item-<uuid>` (pack items).
///
/// Those ids were never valid server ids. Offline writes now use a plain lowercase
/// UUID — the same scheme the server accepts on create — so a queued create lands
/// as-is. Rows left on disk from the older scheme have no such path: they were never
/// uploaded, and any edit or delete would queue a mutation keyed on an id the server
/// answers 404 for, which `OutboxService.classify` marks terminal. The user would see
/// permanent, unfixable sync failures with no way to clear them.
///
/// These rows are cache entries for entities the server has never seen, and nothing
/// references them by id, so dropping them is safe and leaves the store consistent.
/// Re-minting a fresh UUID and enqueuing a create was the alternative, but that would
/// resurrect content the user may have deleted on another device and can't be
/// reconciled without server state. Dropping is the conservative choice.
enum LegacyLocalIDMigration {
    /// Ids from the retired scheme all carry this prefix (`local-item-` included).
    static let legacyPrefix = "local-"

    /// True for an id minted by the retired local-id scheme.
    static func isLegacy(_ id: String) -> Bool {
        id.hasPrefix(legacyPrefix)
    }

    private static let defaultsKey = "legacyLocalIDMigrationCompleted"

    /// Drops every cached pack, pack item, and trip still keyed on a `local-` id,
    /// along with any queued mutation that targets one. Runs at most once per install.
    ///
    /// Idempotent regardless of the flag — a second run simply finds nothing.
    static func runIfNeeded(context: ModelContext?, defaults: UserDefaults = .standard) {
        guard let context, !defaults.bool(forKey: defaultsKey) else { return }
        run(context: context)
        defaults.set(true, forKey: defaultsKey)
    }

    /// The migration itself, without the run-once gate. Exposed for tests.
    @discardableResult
    static func run(context: ModelContext) -> Int {
        var removed = 0

        let packs = (try? context.fetch(FetchDescriptor<CachedPack>())) ?? []
        for pack in packs where isLegacy(pack.id) {
            context.delete(pack)
            removed += 1
        }

        // Pack items are serialized inside `CachedPack.jsonData` rather than stored as
        // their own rows, so legacy `local-item-` items go with their parent pack
        // above. Items with legacy ids under a server-side pack are unreachable
        // without re-encoding every cached pack; the next successful `load` overwrites
        // that pack's cache from the server anyway.

        let trips = (try? context.fetch(FetchDescriptor<CachedTrip>())) ?? []
        for trip in trips where isLegacy(trip.id) {
            context.delete(trip)
            removed += 1
        }

        // Queued writes against a legacy id can only ever fail. Drop them too, so the
        // user isn't left with failed pending writes they can't act on.
        let mutations = (try? context.fetch(FetchDescriptor<PendingMutation>())) ?? []
        for mutation in mutations
        where isLegacy(mutation.entityId) || mutation.parentId.map(isLegacy) == true {
            context.delete(mutation)
            removed += 1
        }

        if removed > 0 {
            try? context.save()
            logger.info("Dropped \(removed, privacy: .public) cached rows using retired local- ids")
        }
        return removed
    }
}
