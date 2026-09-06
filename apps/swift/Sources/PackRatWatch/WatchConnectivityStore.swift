import Foundation
import Observation
import WatchConnectivity

@Observable
final class WatchConnectivityStore: NSObject {
    private let snapshotKey = "watch.snapshot"
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private var session: WCSession?

    var snapshot = PackRatWatchSnapshot.fallback
    var lastDraft: WatchTrailReportDraft?
    var isPhoneReachable = false

    /// Whether the paired phone's user holds the Pro entitlement.
    ///
    /// Resolved entirely on the phone, which owns the RevenueCat SDK. False
    /// until a snapshot arrives, so a watch that has never synced — or one
    /// paired with a phone build predating this field — treats the viewer as
    /// non-Pro rather than assuming access.
    var isPro: Bool { snapshot.isPro }

    override init() {
        super.init()
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
        if ProcessInfo.processInfo.environment["PACKRAT_WATCH_RESET_SNAPSHOT"] == "1" {
            UserDefaults.standard.removeObject(forKey: snapshotKey)
        }
        if loadInjectedSnapshot() {
            loadInjectedDraft()
            return
        }
        loadSnapshot()
        loadInjectedDraft()
    }

    func activate() {
        guard WCSession.isSupported(), session == nil else { return }
        let activeSession = WCSession.default
        activeSession.delegate = self
        activeSession.activate()
        session = activeSession
        isPhoneReachable = activeSession.isReachable
        handle(activeSession.receivedApplicationContext)
    }

    func saveTrailDraft(condition: String, note: String) {
        let draft = WatchTrailReportDraft(
            condition: condition,
            note: note.trimmingCharacters(in: .whitespacesAndNewlines),
            createdAt: Date()
        )
        lastDraft = draft

        guard let session, let data = try? encoder.encode(draft) else { return }
        let payload = [WatchCompanionMessage.trailDraft: data]
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil)
        }
        session.transferUserInfo(payload)
    }

    /// Records a packed/unpacked change made on the watch.
    ///
    /// Applied optimistically to the in-memory snapshot and written to the same
    /// cached-snapshot key the phone's payloads land in, so the toggle survives
    /// leaving and returning to the screen even before the phone answers
    /// (#2694 defect 2). The change is then sent to the phone, which owns the
    /// durable state in `PackingModeStore` and republishes a corrected snapshot.
    func setChecklistItemPacked(_ isPacked: Bool, itemId: String) {
        applyLocally(isPacked: isPacked, itemId: itemId)

        guard let packId = snapshot.pack.packId else { return }
        let message = WatchChecklistToggleMessage(packId: packId, itemId: itemId, isPacked: isPacked)
        guard let session, let data = try? encoder.encode(message) else { return }

        let payload = [WatchCompanionMessage.checklistToggle: data]
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil)
        }
        // Queued regardless of reachability so a toggle made out of range still
        // reaches the phone, mirroring how trail drafts are delivered.
        session.transferUserInfo(payload)
    }

    private func applyLocally(isPacked: Bool, itemId: String) {
        guard let index = snapshot.pack.checklist.firstIndex(where: { $0.id == itemId }),
              snapshot.pack.checklist[index].isPacked != isPacked
        else { return }

        var next = snapshot
        next.pack.checklist[index].isPacked = isPacked
        // Keep the "N of M packed" line in step with the toggles on screen.
        next.pack.packedItemCount = max(0, next.pack.packedItemCount + (isPacked ? 1 : -1))
        snapshot = next
        persistSnapshot()
    }

    private func persistSnapshot() {
        guard let data = try? encoder.encode(snapshot) else { return }
        UserDefaults.standard.set(data, forKey: snapshotKey)
    }

    private func handle(_ payload: [String: Any]) {
        guard let data = payload[WatchCompanionMessage.snapshot] as? Data,
              let next = try? decoder.decode(PackRatWatchSnapshot.self, from: data)
        else { return }
        snapshot = next
        UserDefaults.standard.set(data, forKey: snapshotKey)
    }

    private func loadSnapshot() {
        guard let data = UserDefaults.standard.data(forKey: snapshotKey),
              let cached = try? decoder.decode(PackRatWatchSnapshot.self, from: data)
        else { return }
        snapshot = cached
    }

    private func loadInjectedSnapshot() -> Bool {
        guard let encoded = ProcessInfo.processInfo.environment["PACKRAT_WATCH_SNAPSHOT_BASE64"],
              let data = Data(base64Encoded: encoded),
              let injected = try? decoder.decode(PackRatWatchSnapshot.self, from: data)
        else { return false }
        snapshot = injected
        UserDefaults.standard.set(data, forKey: snapshotKey)
        return true
    }

    private func loadInjectedDraft() {
        guard ProcessInfo.processInfo.environment["PACKRAT_WATCH_DRAFT_SAVED"] == "1" else { return }
        lastDraft = WatchTrailReportDraft(
            condition: "Muddy",
            note: "Creek crossing is high near the bridge.",
            createdAt: Date(timeIntervalSince1970: 1_779_984_300)
        )
    }
}

extension WatchConnectivityStore: WCSessionDelegate {
    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {}

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in
            self.isPhoneReachable = session.isReachable
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        Task { @MainActor in
            self.handle(applicationContext)
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        Task { @MainActor in
            self.handle(userInfo)
        }
    }
}
