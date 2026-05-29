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

    override init() {
        super.init()
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
        if ProcessInfo.processInfo.environment["PACKRAT_WATCH_RESET_SNAPSHOT"] == "1" {
            UserDefaults.standard.removeObject(forKey: snapshotKey)
        }
        if loadInjectedSnapshot() {
            return
        }
        loadSnapshot()
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
