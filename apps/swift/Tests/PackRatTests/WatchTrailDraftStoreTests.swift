import Foundation
import Testing
@testable import PackRat

/// Covers #2721: a trail-conditions draft captured on the watch used to be
/// written to three `watch.latestTrailDraft.*` UserDefaults keys that no phone
/// screen read, so it never appeared on the iPhone. Drafts now land in
/// `WatchTrailDraftStore`, which the Trail Conditions list renders.
@Suite("Watch trail draft store")
struct WatchTrailDraftStoreTests {
    @MainActor
    private func makeStore() -> WatchTrailDraftStore {
        let defaults = UserDefaults(suiteName: "watch.trailDraft.tests.\(UUID().uuidString)")!
        return WatchTrailDraftStore(defaults: defaults)
    }

    private func draft(
        condition: String = "fair",
        note: String = "Creek crossing is high",
        secondsAgo: TimeInterval = 0
    ) -> WatchTrailReportDraft {
        WatchTrailReportDraft(
            condition: condition,
            note: note,
            createdAt: Date(timeIntervalSince1970: 1_756_000_000 - secondsAgo)
        )
    }

    // MARK: - Arrival

    @Test("a draft from the watch becomes visible to the phone")
    @MainActor
    func draftArrives() {
        let store = makeStore()
        #expect(store.hasDrafts == false)

        store.add(draft())

        #expect(store.drafts.count == 1)
        #expect(store.hasDrafts)
        #expect(store.drafts[0].condition == "fair")
        #expect(store.drafts[0].note == "Creek crossing is high")
    }

    @Test("the same draft delivered twice collapses to one row")
    @MainActor
    func duplicateDeliveryIsIdempotent() {
        let store = makeStore()
        let captured = draft()

        // WatchConnectivity sends each draft over both sendMessage and
        // transferUserInfo, so double arrival is the normal case, not an edge.
        store.add(captured)
        store.add(captured)

        #expect(store.drafts.count == 1)
    }

    @Test("distinct captures are kept newest first")
    @MainActor
    func draftsAreOrderedNewestFirst() {
        let store = makeStore()

        store.add(draft(condition: "poor", note: "Older", secondsAgo: 600))
        store.add(draft(condition: "good", note: "Newer", secondsAgo: 0))

        #expect(store.drafts.map(\.note) == ["Newer", "Older"])
    }

    // MARK: - Clearing

    @Test("submitting a draft removes it")
    @MainActor
    func removeDropsOneDraft() {
        let store = makeStore()
        store.add(draft(note: "Keep", secondsAgo: 600))
        store.add(draft(note: "Drop", secondsAgo: 0))
        let dropId = store.drafts[0].id

        store.remove(dropId)

        #expect(store.drafts.map(\.note) == ["Keep"])
    }

    @Test("removing an unknown id leaves the list untouched")
    @MainActor
    func removeUnknownIdIsANoop() {
        let store = makeStore()
        store.add(draft())

        store.remove("watch-does-not-exist")

        #expect(store.drafts.count == 1)
    }

    // MARK: - Persistence

    @Test("drafts survive the app being relaunched")
    @MainActor
    func draftsPersistAcrossLaunches() {
        let suite = "watch.trailDraft.tests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!

        let first = WatchTrailDraftStore(defaults: defaults)
        first.add(draft(condition: "poor", note: "Ice above the saddle"))

        // A capture must outlive the launch it arrived in — the phone may not be
        // opened until well after the watch sent it.
        let reloaded = WatchTrailDraftStore(defaults: defaults)

        #expect(reloaded.drafts.count == 1)
        #expect(reloaded.drafts[0].condition == "poor")
        #expect(reloaded.drafts[0].note == "Ice above the saddle")
    }

    @Test("clearing removes drafts from storage too")
    @MainActor
    func removeAllPersists() {
        let suite = "watch.trailDraft.tests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!

        let first = WatchTrailDraftStore(defaults: defaults)
        first.add(draft())
        first.removeAll()

        #expect(WatchTrailDraftStore(defaults: defaults).drafts.isEmpty)
    }

    // MARK: - Companion service wiring

    @Test("the companion service files an incoming draft into the store")
    @MainActor
    func companionServiceStoresIncomingDraft() {
        let defaults = UserDefaults(suiteName: "watch.trailDraft.tests.\(UUID().uuidString)")!
        let store = WatchTrailDraftStore(defaults: defaults)
        let service = WatchCompanionService(
            packingModeStore: PackingModeStore(defaults: defaults),
            trailDraftStore: store,
            defaults: defaults
        )

        service.handleTrailDraft(draft(condition: "excellent", note: "Dry and clear"))

        #expect(store.drafts.count == 1)
        #expect(store.drafts[0].condition == "excellent")
        #expect(store.drafts[0].note == "Dry and clear")
    }
}
