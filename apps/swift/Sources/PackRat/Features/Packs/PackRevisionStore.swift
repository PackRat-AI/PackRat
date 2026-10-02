import Foundation
import Observation

/// Broadcasts pack mutations to every window in the process.
///
/// On macOS a pack can be visible in several windows at once — the main
/// window's Packs detail, a standalone "Pack" window, and the Pack section of
/// any Trip window that links it. Each of those scenes owns its own
/// `PacksViewModel` (`PackWindowView` and `TripWindowView` each construct one),
/// because SwiftUI gives every `WindowGroup` instance its own `@State`. That
/// isolation is what made #2667 visible: adding an item updated the window that
/// performed the write, while the other windows kept rendering the `Pack` value
/// they had loaded at `.task` time and showed a stale `itemCount`.
///
/// The pack models are plain structs rather than SwiftData `@Model` classes, so
/// there is no managed-object change notification to observe — writing to the
/// shared `CachedPack` store does not tell anyone. This store supplies the
/// missing signal explicitly: `PacksViewModel` publishes here from the same
/// choke points that already persist to the cache, and every other view model
/// adopts the new value for packs it is holding.
///
/// A single shared `@Observable` instance, matching `PackingModeStore` and the
/// other app-wide stores, rather than `NotificationCenter`: observation is
/// automatic in SwiftUI, the payload stays typed, and no scene has to remember
/// to add or tear down an observer.
@Observable
@MainActor
final class PackRevisionStore {
    static let shared = PackRevisionStore()

    /// The most recent value published for each pack id.
    ///
    /// Keyed by id and holding the whole `Pack` rather than a counter, so a
    /// window that adopts a revision picks up the name, weights and item list
    /// in one step instead of refetching. Deletions publish `nil`.
    private(set) var revisions: [String: Pack] = [:]

    /// Bumped on every publish, including deletions.
    ///
    /// Observers key on this rather than on `revisions` so a window re-reads
    /// once per mutation even when the change was a delete (which removes the
    /// entry) or a same-value republish.
    private(set) var revision: Int = 0

    /// Deleted pack ids, so a window holding one can drop it.
    private(set) var deletedIds: Set<String> = []

    init() {}

    // MARK: - Publishing

    /// Announces a pack's current value to the other windows.
    ///
    /// Called from `PacksViewModel.upsertCachedPack`, which every mutation
    /// already routes through, so new pack mutations are covered without
    /// remembering to add a call.
    func publish(_ pack: Pack) {
        revisions[pack.id] = pack
        deletedIds.remove(pack.id)
        revision += 1
    }

    /// Announces that a pack is gone.
    func publishDeletion(of packId: String) {
        revisions.removeValue(forKey: packId)
        deletedIds.insert(packId)
        revision += 1
    }

    // MARK: - Reads

    func latest(_ packId: String) -> Pack? { revisions[packId] }

    func isDeleted(_ packId: String) -> Bool { deletedIds.contains(packId) }

    /// Applies every known revision to `packs`, returning the reconciled array.
    ///
    /// Only touches packs the caller already holds — a pack this window never
    /// loaded stays absent rather than appearing because another window created
    /// it, which keeps a filtered or paginated list from growing behind the
    /// user's back. Deleted packs are dropped.
    func reconcile(_ packs: [Pack]) -> [Pack] {
        guard revision > 0 else { return packs }
        return packs.compactMap { pack in
            if deletedIds.contains(pack.id) { return nil }
            return revisions[pack.id] ?? pack
        }
    }
}
