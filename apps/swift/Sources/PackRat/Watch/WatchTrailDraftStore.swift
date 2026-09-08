#if os(iOS)
import Foundation
import Observation

/// Trail-condition drafts captured on the Apple Watch, waiting to be finished
/// on the phone.
///
/// The watch can only capture a condition and a note (`WatchTrailReportDraft`) —
/// it has no trail-name field, and `POST /trail-conditions` requires one. So a
/// watch capture is deliberately *not* submittable on arrival: it parks here
/// until someone opens it on the phone, adds the trail, and submits.
///
/// This is the "capture on the wrist, triage on the phone" pattern watch
/// companions converge on: the draft syncs silently and waits in a list rather
/// than interrupting whatever the phone is doing with an unbidden modal
/// (#2721 — previously the draft was written to three loose UserDefaults keys
/// that nothing on the phone ever read, so it simply vanished).
///
/// Drafts are device-local, like `PackingModeStore`: they belong to the phone
/// paired with the watch that captured them, not to the account.
@Observable
@MainActor
final class WatchTrailDraftStore {
    static let shared = WatchTrailDraftStore()

    private static let defaultsKey = "watch.trailDrafts"

    /// Newest first, so the list surfaces the most recent capture at the top.
    private(set) var drafts: [WatchTrailDraft] = []

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.drafts = Self.load(from: defaults)
    }

    var hasDrafts: Bool { !drafts.isEmpty }

    // MARK: - Writes

    /// Records a draft that arrived from the watch.
    ///
    /// Idempotent by `createdAt`: WatchConnectivity delivers each draft over
    /// both `sendMessage` and `transferUserInfo` so it survives the phone being
    /// unreachable, which means the same capture routinely arrives twice.
    func add(_ draft: WatchTrailReportDraft) {
        let incoming = WatchTrailDraft(
            id: Self.identifier(for: draft),
            condition: draft.condition,
            note: draft.note,
            createdAt: draft.createdAt
        )
        guard !drafts.contains(where: { $0.id == incoming.id }) else { return }
        drafts.insert(incoming, at: 0)
        drafts.sort { $0.createdAt > $1.createdAt }
        persist()
    }

    /// Drops a draft once it has been submitted as a real report, or dismissed.
    func remove(_ id: String) {
        guard drafts.contains(where: { $0.id == id }) else { return }
        drafts.removeAll { $0.id == id }
        persist()
    }

    func removeAll() {
        guard !drafts.isEmpty else { return }
        drafts.removeAll()
        persist()
    }

    // MARK: - Persistence

    /// Keyed on the capture instant rather than a fresh UUID so the duplicate
    /// delivery described in `add` collapses onto one row.
    private static func identifier(for draft: WatchTrailReportDraft) -> String {
        "watch-\(Int(draft.createdAt.timeIntervalSince1970.rounded()))"
    }

    private func persist() {
        guard let data = try? JSONEncoder.watchDraft.encode(drafts) else { return }
        defaults.set(data, forKey: Self.defaultsKey)
    }

    private static func load(from defaults: UserDefaults) -> [WatchTrailDraft] {
        guard let data = defaults.data(forKey: Self.defaultsKey),
              let stored = try? JSONDecoder.watchDraft.decode([WatchTrailDraft].self, from: data)
        else { return [] }
        return stored.sorted { $0.createdAt > $1.createdAt }
    }
}

/// A watch capture as the phone stores it: the watch's payload plus a stable id.
struct WatchTrailDraft: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let condition: String
    let note: String
    let createdAt: Date
}

private extension JSONEncoder {
    static let watchDraft: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()
}

private extension JSONDecoder {
    static let watchDraft: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()
}
#endif
