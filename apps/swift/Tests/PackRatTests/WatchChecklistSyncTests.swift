import Foundation
import Testing
@testable import PackRat

/// Covers the two defects in #2694 (and the #2718 duplicate of defect 1): the
/// checklist mapping must reflect real packed state, and a watch toggle must
/// land in the phone's `PackingModeStore`.
@Suite("Watch checklist sync")
struct WatchChecklistSyncTests {
    private func items(_ count: Int) -> [WatchSnapshotBuilder.Item] {
        (1...count).map {
            WatchSnapshotBuilder.Item(id: "item-\($0)", name: "Item \($0)", category: nil)
        }
    }

    @MainActor
    private func makeStore() -> PackingModeStore {
        let defaults = UserDefaults(suiteName: "watch.checklist.tests.\(UUID().uuidString)")!
        return PackingModeStore(defaults: defaults)
    }

    // MARK: - Defect 1: packed state and counts

    @Test("checklist reflects real packed state instead of hardcoding packed")
    func checklistReflectsRealPackedState() {
        let packed: Set<String> = ["item-2", "item-4"]

        let checklist = WatchSnapshotBuilder.makeChecklist(from: items(4)) { packed.contains($0) }

        #expect(checklist.map(\.isPacked) == [false, true, false, true])
    }

    @Test("nothing packed yields an all-unpacked checklist")
    func nothingPackedYieldsAllUnpackedChecklist() {
        let checklist = WatchSnapshotBuilder.makeChecklist(from: items(3)) { _ in false }

        #expect(checklist.allSatisfy { !$0.isPacked })
        #expect(checklist.count == 3)
    }

    // MARK: - Defect 1 / #2718: the count line must agree with the phone

    @Test("packed count matches the phone for a partially packed pack")
    func packedCountMatchesPhoneForPartiallyPackedPack() {
        // The exact numbers reported in #2718: iPhone said 5 of 7.
        let packed: Set<String> = ["item-1", "item-2", "item-3", "item-4", "item-5"]

        let snapshot = WatchSnapshotBuilder.makePackSnapshot(
            packId: "pack-1",
            name: "Weekend",
            baseWeightText: "10.0 lb",
            items: items(7),
            isPacked: { packed.contains($0) }
        )

        #expect(snapshot.packedItemCount == 5)
        #expect(snapshot.totalItemCount == 7)
    }

    @Test("counts describe the whole pack even when the checklist is capped")
    func countsDescribeWholePackEvenWhenChecklistIsCapped() {
        let snapshot = WatchSnapshotBuilder.makePackSnapshot(
            packId: "pack-1",
            name: "Big",
            baseWeightText: "20.0 lb",
            items: items(12),
            isPacked: { _ in true }
        )

        // Only 8 rows travel to the wrist, but 12 of 12 are packed — counting
        // the window instead of the pack is what made the two disagree.
        #expect(snapshot.checklist.count == WatchSnapshotBuilder.checklistLimit)
        #expect(snapshot.packedItemCount == 12)
        #expect(snapshot.totalItemCount == 12)
    }

    @Test("an empty pack reports no packed items rather than a full checklist")
    func emptyPackReportsNoPackedItems() {
        let snapshot = WatchSnapshotBuilder.makePackSnapshot(
            packId: nil,
            name: "No Pack Selected",
            baseWeightText: "--",
            items: [],
            isPacked: { _ in true }
        )

        #expect(snapshot.packedItemCount == 0)
        #expect(snapshot.totalItemCount == 0)
        #expect(snapshot.checklist.isEmpty)
    }

    // MARK: - Defect 2: a watch toggle reaches phone-side state

    @MainActor
    @Test("a toggle from the watch persists to the phone's packing store")
    func toggleFromWatchPersistsToPhoneStore() {
        let store = makeStore()
        let service = WatchCompanionService(packingModeStore: store)

        service.applyChecklistToggle(
            WatchChecklistToggleMessage(packId: "pack-1", itemId: "item-1", isPacked: true)
        )

        #expect(store.isPacked("item-1", in: "pack-1"))
    }

    @MainActor
    @Test("unpacking from the watch clears the phone's packed state")
    func unpackingFromWatchClearsPhoneState() {
        let store = makeStore()
        store.setPacked(true, itemId: "item-1", in: "pack-1")
        let service = WatchCompanionService(packingModeStore: store)

        service.applyChecklistToggle(
            WatchChecklistToggleMessage(packId: "pack-1", itemId: "item-1", isPacked: false)
        )

        #expect(!store.isPacked("item-1", in: "pack-1"))
    }

    @MainActor
    @Test("the same toggle delivered twice is idempotent")
    func sameToggleDeliveredTwiceIsIdempotent() {
        // WatchConnectivity sends each toggle over both sendMessage and
        // transferUserInfo, so duplicate delivery is expected, not exceptional.
        let store = makeStore()
        let service = WatchCompanionService(packingModeStore: store)
        let message = WatchChecklistToggleMessage(packId: "pack-1", itemId: "item-1", isPacked: true)

        service.applyChecklistToggle(message)
        service.applyChecklistToggle(message)

        #expect(store.packedCount(in: "pack-1", among: ["item-1"]) == 1)
    }

    @MainActor
    @Test("a toggle only affects the pack it names")
    func toggleOnlyAffectsNamedPack() {
        let store = makeStore()
        let service = WatchCompanionService(packingModeStore: store)

        service.applyChecklistToggle(
            WatchChecklistToggleMessage(packId: "pack-1", itemId: "item-1", isPacked: true)
        )

        #expect(store.isPacked("item-1", in: "pack-1"))
        #expect(!store.isPacked("item-1", in: "pack-2"))
    }

    // MARK: - Transport shape

    @Test("toggle message round-trips through JSON")
    func toggleMessageRoundTripsThroughJSON() throws {
        let message = WatchChecklistToggleMessage(packId: "pack-1", itemId: "item-1", isPacked: true)

        let data = try JSONEncoder().encode(message)
        let decoded = try JSONDecoder().decode(WatchChecklistToggleMessage.self, from: data)

        #expect(decoded == message)
    }

    @Test("a snapshot cached by a build without packId still decodes")
    func snapshotWithoutPackIdStillDecodes() throws {
        let legacy = """
        {"name":"Old Pack","baseWeightText":"5.0 lb","packedItemCount":1,
         "totalItemCount":2,"checklist":[]}
        """
        let decoded = try JSONDecoder().decode(WatchPackSnapshot.self, from: Data(legacy.utf8))

        #expect(decoded.packId == nil)
        #expect(decoded.name == "Old Pack")
    }
}
