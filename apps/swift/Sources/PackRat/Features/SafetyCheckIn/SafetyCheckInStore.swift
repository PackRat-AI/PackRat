import Foundation
import Observation
import Sentry
import UserNotifications

/// Owns emergency contacts and every active safety check-in on this device.
///
/// Check-ins are local-first. Starting one, checking in, extending and I'm Safe
/// all take effect on the phone immediately and queue a write; the queue is
/// replayed in order whenever there is signal. That is what lets a user with
/// no coverage check in or mark themselves safe and have it reach their
/// contacts as soon as they walk back into range.
@Observable
@MainActor
final class SafetyCheckInStore {
    static let shared = SafetyCheckInStore()
    static let flagKey = "enableSafetyCheckIn"

    private(set) var contacts: [EmergencyContact] = []
    private(set) var contactsLoaded = false
    /// Active check-ins keyed by trip id.
    private(set) var active: [String: LocalSafetyCheckIn] = [:]
    private(set) var queue: [PendingSafetyOperation] = []
    private(set) var isFlushing = false

    private let service: SafetyCheckInService
    private let fileURL: URL?

    init(service: SafetyCheckInService = .shared, fileURL: URL? = SafetyCheckInStore.defaultFileURL) {
        self.service = service
        self.fileURL = fileURL
        restore()
    }

    static var isEnabled: Bool { FeatureFlagStore.shared.isEnabled(flagKey) }

    nonisolated static var defaultFileURL: URL? {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
            .appendingPathComponent("safety-check-in.json")
    }

    var defaultContact: EmergencyContact? { contacts.first(where: \.isDefault) }
    var hasTrackingCheckIn: Bool { active.values.contains(where: \.trackingEnabled) }

    func checkIn(forTrip tripId: String) -> LocalSafetyCheckIn? { active[tripId] }

    /// Writes for this trip still waiting for signal.
    func pendingCount(forTrip tripId: String) -> Int {
        guard let id = active[tripId]?.id else { return 0 }
        return queue.filter { $0.checkInId == id }.count
    }

    // MARK: - Contacts

    func loadContacts() async {
        do {
            contacts = try await service.listContacts()
            contactsLoaded = true
            persist()
        } catch {
            // Offline: keep the cached list so a check-in can still be started.
            contactsLoaded = true
        }
    }

    func addContact(name: String, phone: String?, email: String?, isDefault: Bool) async throws {
        let request = CreateEmergencyContactRequest(
            id: UUID().uuidString.lowercased(),
            name: name,
            phone: phone,
            email: email,
            isDefault: isDefault || contacts.isEmpty
        )
        let created = try await capture("addContact") { try await self.service.createContact(request) }
        applyContact(created)
    }

    func updateContact(_ id: String, name: String, phone: String?, email: String?, isDefault: Bool) async throws {
        let request = UpdateEmergencyContactRequest(name: name, phone: phone, email: email, isDefault: isDefault)
        let updated = try await capture("updateContact") { try await self.service.updateContact(id, request) }
        applyContact(updated)
    }

    func deleteContact(_ id: String) async throws {
        try await capture("deleteContact") { try await self.service.deleteContact(id) }
        contacts.removeAll { $0.id == id }
        persist()
    }

    private func applyContact(_ contact: EmergencyContact) {
        if contact.isDefault {
            contacts = contacts.map { existing in
                guard existing.isDefault, existing.id != contact.id else { return existing }
                return EmergencyContact(
                    id: existing.id, name: existing.name, phone: existing.phone,
                    email: existing.email, isDefault: false
                )
            }
        }
        if let idx = contacts.firstIndex(where: { $0.id == contact.id }) {
            contacts[idx] = contact
        } else {
            contacts.append(contact)
        }
        persist()
    }

    // MARK: - Check-in lifecycle

    func start(
        tripId: String,
        tripName: String,
        contacts chosen: [EmergencyContact],
        expectedReturnAt: Date,
        graceMinutes: Int,
        gear: [IdentifyingGearItem],
        trackingEnabled: Bool,
        now: Date = Date()
    ) {
        let request = StartSafetyCheckInRequest(
            id: UUID().uuidString.lowercased(),
            contactIds: chosen.map(\.id),
            expectedReturnAt: expectedReturnAt.iso8601String(),
            graceMinutes: graceMinutes,
            identifyingGear: gear.filter { !$0.name.trimmingCharacters(in: .whitespaces).isEmpty },
            trackingEnabled: trackingEnabled,
            startedAt: now.iso8601String(),
            timeZone: TimeZone.current.identifier
        )
        let local = LocalSafetyCheckIn(
            id: request.id,
            tripId: tripId,
            tripName: tripName,
            contactNames: chosen.map(\.name),
            expectedReturnAt: expectedReturnAt,
            graceMinutes: graceMinutes,
            trackingEnabled: trackingEnabled,
            startedAt: now
        )
        let crumb = Breadcrumb(level: .info, category: "safetyCheckIn")
        crumb.message = "Check-in started"
        crumb.data = ["tripId": tripId, "trackingEnabled": trackingEnabled]
        SentrySDK.addBreadcrumb(crumb)
        active[tripId] = local
        enqueue(.start(tripId: tripId, request: request))
        SafetyCheckInNotifications.schedule(for: local)
        #if os(iOS)
        if trackingEnabled { SafetyLocationTracker.shared.start() }
        #endif
    }

    /// Records a check-in at `location` and queues it for the contacts.
    func recordCheckIn(tripId: String, location: SafetyLocationFix, note: String?) {
        guard var checkIn = active[tripId] else { return }
        let input = SafetyLocationInput(
            id: UUID().uuidString.lowercased(),
            kind: .checkIn,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracyMeters: location.accuracy,
            placeName: location.placeName,
            note: note?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            recordedAt: location.recordedAt.iso8601String()
        )
        checkIn.lastCheckInAt = location.recordedAt
        active[tripId] = checkIn
        enqueue(.locations(checkInId: checkIn.id, [input]))
    }

    /// Background track points for every check-in that allowed tracking.
    func recordTrackPoints(_ fixes: [SafetyLocationFix]) {
        guard !fixes.isEmpty else { return }
        for checkIn in active.values where checkIn.trackingEnabled {
            let inputs = fixes.map { fix in
                SafetyLocationInput(
                    id: UUID().uuidString.lowercased(),
                    kind: .track,
                    latitude: fix.latitude,
                    longitude: fix.longitude,
                    accuracyMeters: fix.accuracy,
                    placeName: nil,
                    note: nil,
                    recordedAt: fix.recordedAt.iso8601String()
                )
            }
            enqueue(.locations(checkInId: checkIn.id, inputs))
        }
    }

    func extend(tripId: String, to date: Date) {
        guard var checkIn = active[tripId] else { return }
        checkIn.expectedReturnAt = date
        active[tripId] = checkIn
        enqueue(.extend(checkInId: checkIn.id, expectedReturnAt: date))
        SafetyCheckInNotifications.schedule(for: checkIn)
    }

    /// I'm Safe (`.safe`) or called off (`.cancel`). The check-in leaves the
    /// phone at once; the server hears about it as soon as there's signal.
    func end(tripId: String, outcome: SafetyCheckInOutcome, at date: Date = Date()) {
        guard let checkIn = active.removeValue(forKey: tripId) else { return }
        SafetyCheckInNotifications.cancel(for: checkIn)
        if checkIn.contactsNotified || queue.contains(where: { $0.checkInId == checkIn.id }) {
            // Drop unsent track points; they would be deleted on arrival anyway.
            queue.removeAll {
                if case .locations(let id, let inputs) = $0, id == checkIn.id {
                    return inputs.allSatisfy { $0.kind == .track }
                }
                return false
            }
            enqueue(.end(checkInId: checkIn.id, outcome: outcome, at: date))
        }
        #if os(iOS)
        if !hasTrackingCheckIn { SafetyLocationTracker.shared.stop() }
        #endif
        persist()
    }

    /// Pulls the server's view of a trip's check-in, e.g. whether the overdue
    /// alert has gone out, or a check-in started on another device.
    func refresh(tripId: String, tripName: String) async {
        guard queue.allSatisfy({ $0.checkInId != active[tripId]?.id }) else { return }
        let remote: SafetyCheckInResponse?
        do {
            remote = try await service.activeCheckIn(tripId: tripId)
        } catch {
            return
        }
        guard let remote else {
            // Ended elsewhere (or never started here). Only drop it once the
            // server has confirmed it existed, never a start still in flight.
            if active[tripId]?.contactsNotified == true {
                if let local = active.removeValue(forKey: tripId) {
                    SafetyCheckInNotifications.cancel(for: local)
                }
                persist()
            }
            return
        }
        var local = active[tripId] ?? LocalSafetyCheckIn(
            id: remote.id,
            tripId: tripId,
            tripName: tripName,
            contactNames: remote.contacts.map(\.name),
            expectedReturnAt: remote.expectedReturnAt.toDate() ?? Date(),
            graceMinutes: remote.graceMinutes,
            trackingEnabled: remote.trackingEnabled,
            startedAt: remote.startedAt.toDate() ?? Date()
        )
        apply(remote, to: &local)
        active[tripId] = local
        persist()
    }

    private func apply(_ remote: SafetyCheckInResponse, to local: inout LocalSafetyCheckIn) {
        local.shareUrl = remote.shareUrl
        local.contactNames = remote.contacts.map(\.name)
        local.overdueAlertSent = remote.overdueAlertSentAt != nil
        local.startError = nil
    }

    // MARK: - Queue

    private func enqueue(_ operation: PendingSafetyOperation) {
        queue.append(operation)
        persist()
        Task { await flush() }
    }

    /// Replays queued writes in order. Stops at the first one that fails for
    /// lack of signal so later writes can't overtake it; a write the server
    /// refuses outright is dropped so it can't block the queue forever.
    func flush() async {
        guard !isFlushing, !queue.isEmpty else { return }
        isFlushing = true
        defer { isFlushing = false }

        while let operation = queue.first {
            do {
                try await perform(operation)
                queue.removeFirst()
                persist()
            } catch where Self.isRetryable(error) {
                return
            } catch {
                SentrySDK.capture(error: error) { scope in
                    scope.setTag(value: "safetyCheckIn", key: "feature")
                    scope.setExtra(value: operation.checkInId, key: "checkInId")
                }
                queue.removeFirst()
                if case .start(let tripId, let request) = operation {
                    // Nothing else for this check-in can land without its start.
                    queue.removeAll { $0.checkInId == request.id }
                    active[tripId]?.startError = (error as? LocalizedError)?.errorDescription
                        ?? "Your contacts couldn't be notified."
                }
                persist()
            }
        }
    }

    private func perform(_ operation: PendingSafetyOperation) async throws {
        switch operation {
        case .start(let tripId, let request):
            let remote = try await service.start(tripId: tripId, request)
            if var local = active[tripId], local.id == request.id {
                apply(remote, to: &local)
                active[tripId] = local
            }
        case .extend(let id, let date):
            _ = try await service.extend(checkInId: id, to: date)
        case .end(let id, let outcome, let date):
            _ = try await service.end(checkInId: id, outcome: outcome, at: date)
        case .locations(let id, let inputs):
            try await service.uploadLocations(checkInId: id, inputs)
        }
    }

    nonisolated static func isRetryable(_ error: Error) -> Bool {
        guard let error = error as? PackRatError else { return true }
        switch error {
        case .httpError(let status, _):
            return status == 408 || status == 429 || status >= 500
        case .notFound, .decodingError:
            return false
        default:
            return true
        }
    }

    // MARK: - Persistence

    private struct Snapshot: Codable {
        var contacts: [EmergencyContact]
        var active: [String: LocalSafetyCheckIn]
        var queue: [PendingSafetyOperation]
    }

    private func persist() {
        guard let fileURL else { return }
        let snapshot = Snapshot(contacts: contacts, active: active, queue: queue)
        do {
            try FileManager.default.createDirectory(
                at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true
            )
            try JSONEncoder().encode(snapshot).write(to: fileURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        } catch {
            SentrySDK.capture(error: error) { $0.setTag(value: "safetyCheckIn", key: "feature") }
        }
    }

    private func restore() {
        guard let fileURL, let data = try? Data(contentsOf: fileURL),
              let snapshot = try? JSONDecoder().decode(Snapshot.self, from: data)
        else { return }
        contacts = snapshot.contacts
        active = snapshot.active
        queue = snapshot.queue
    }

    /// Clears everything on sign-out.
    func reset() {
        for checkIn in active.values { SafetyCheckInNotifications.cancel(for: checkIn) }
        contacts = []
        active = [:]
        queue = []
        contactsLoaded = false
        #if os(iOS)
        SafetyLocationTracker.shared.stop()
        #endif
        if let fileURL { try? FileManager.default.removeItem(at: fileURL) }
    }

    private func capture<T>(_ action: String, _ body: () async throws -> T) async throws -> T {
        do {
            return try await body()
        } catch {
            SentrySDK.capture(error: error) { scope in
                scope.setTag(value: "safetyCheckIn", key: "feature")
                scope.setTag(value: action, key: "action")
            }
            throw error
        }
    }
}

/// A position from Core Location, decoupled from `CLLocation` so the store
/// is testable without a location manager.
struct SafetyLocationFix: Sendable {
    let latitude: Double
    let longitude: Double
    let accuracy: Double?
    let recordedAt: Date
    var placeName: String?
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
