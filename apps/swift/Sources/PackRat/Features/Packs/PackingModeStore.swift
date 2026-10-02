import Foundation
import Observation

/// Device-local record of which items in a pack are checked off as packed.
///
/// There is deliberately no backend for this. `pack_items` has no `isPacked`
/// column and no packing endpoint exists — Expo keeps the same state in a
/// Legend-State observable persisted under the name `packingMode`
/// (apps/expo/features/packs/store/packingMode.ts), local-only with no remote
/// CRUD. This is the Swift counterpart, so a pack's packed state stays on the
/// device that did the packing rather than syncing across a user's devices.
///
/// Shape matches Expo's: `[packId: [itemId: Bool]]`. Only `true` entries are
/// stored; unchecking removes the key so the payload stays proportional to what
/// is actually packed rather than to pack size.
@Observable
@MainActor
final class PackingModeStore {
    static let shared = PackingModeStore()

    private static let defaultsKey = "packingMode"

    private var state: [String: [String: Bool]] = [:]
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.state = Self.load(from: defaults)
    }

    // MARK: - Reads

    /// The packed-item map for a pack. Absent keys mean "not packed".
    func packedItems(in packId: String) -> [String: Bool] {
        state[packId] ?? [:]
    }

    func isPacked(_ itemId: String, in packId: String) -> Bool {
        state[packId]?[itemId] ?? false
    }

    /// Number of packed items in `packId` restricted to `itemIds`.
    ///
    /// Scoping to the pack's current items matters: an item deleted after being
    /// checked off would otherwise keep inflating the count past the total and
    /// push progress above 100%.
    func packedCount(in packId: String, among itemIds: some Sequence<String>) -> Int {
        let packed = state[packId] ?? [:]
        return itemIds.reduce(into: 0) { count, id in
            if packed[id] == true { count += 1 }
        }
    }

    // MARK: - Writes

    func setPacked(_ packed: Bool, itemId: String, in packId: String) {
        var forPack = state[packId] ?? [:]
        if packed {
            forPack[itemId] = true
        } else {
            forPack.removeValue(forKey: itemId)
        }
        state[packId] = forPack.isEmpty ? nil : forPack
        persist()
    }

    func toggle(itemId: String, in packId: String) {
        setPacked(!isPacked(itemId, in: packId), itemId: itemId, in: packId)
    }

    /// Overwrites a pack's packed map wholesale — used by the sheet's Save,
    /// which edits a working copy and commits it in one go.
    func replace(packedItems: [String: Bool], in packId: String) {
        let onlyPacked = packedItems.filter(\.value)
        state[packId] = onlyPacked.isEmpty ? nil : onlyPacked
        persist()
    }

    func reset(packId: String) {
        state.removeValue(forKey: packId)
        persist()
    }

    // MARK: - Persistence

    private func persist() {
        defaults.set(state, forKey: Self.defaultsKey)
    }

    private static func load(from defaults: UserDefaults) -> [String: [String: Bool]] {
        // UserDefaults hands back `Any` for nested collections, so re-narrow
        // rather than force-casting — a value written by an older build with a
        // different shape should degrade to "nothing packed", not a crash.
        guard let raw = defaults.dictionary(forKey: defaultsKey) else { return [:] }
        return raw.reduce(into: [:]) { result, entry in
            guard let inner = entry.value as? [String: Bool] else { return }
            let onlyPacked = inner.filter(\.value)
            if !onlyPacked.isEmpty { result[entry.key] = onlyPacked }
        }
    }
}
