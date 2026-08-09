import Foundation
import Observation
import SwiftData

/// Drains queued offline writes to the server.
///
/// Writes made while offline (or that fail with a transport error) are recorded as
/// `PendingMutation` rows instead of being stranded on-device. This service replays
/// them in `createdAt` order — serially, so a create-then-update on the same entity
/// lands in the order the user made it — whenever connectivity returns or the app
/// comes to the foreground.
///
/// Retry policy: transport failures are retried up to `maxAttempts`. A 4xx from the
/// server is terminal — the payload is wrong, so retrying forever would never help;
/// the mutation is marked `failed` and left in the store for the UI to surface. A
/// 404 on delete, and a 409 on create, are treated as success: the server already
/// agrees with the local state.
@Observable
@MainActor
final class OutboxService {
    static let shared = OutboxService()

    /// Number of mutations still waiting to reach the server.
    private(set) var pendingCount: Int = 0
    /// Number of mutations that gave up and need user attention.
    private(set) var failedCount: Int = 0
    private(set) var isFlushing = false

    /// Transport failures beyond this count mark the mutation `failed` rather than
    /// retrying indefinitely.
    static let maxAttempts = 5

    private let packService: PackService
    private let tripService: TripService

    init(packService: PackService = .shared, tripService: TripService = .shared) {
        self.packService = packService
        self.tripService = tripService
    }

    // MARK: - Enqueue

    /// Records a write that could not reach the server.
    ///
    /// Collapses redundant work before inserting: a delete of a never-synced entity
    /// drops its queued create (and any updates) and never contacts the server, and
    /// consecutive updates to the same entity collapse to the latest payload.
    func enqueue(
        entityType: OutboxEntityType,
        entityId: String,
        operation: OutboxOperation,
        parentId: String? = nil,
        payload: Data? = nil,
        context: ModelContext?
    ) {
        guard let context else { return }

        let existing = pendingMutations(for: entityId, context: context)

        switch operation {
        case .delete:
            // A create still queued means the server has never seen this entity —
            // create + delete cancel out entirely.
            if existing.contains(where: { $0.operation == .create }) {
                for mutation in existing { context.delete(mutation) }
                saveAndRefresh(context)
                return
            }
            // Otherwise the delete supersedes any queued updates.
            for mutation in existing where mutation.operation == .update {
                context.delete(mutation)
            }

        case .update:
            // Fold into the queued create so the entity is created with its final
            // values in a single request.
            if let create = existing.first(where: { $0.operation == .create }) {
                create.payload = payload
                saveAndRefresh(context)
                return
            }
            // Collapse consecutive updates to the last one.
            for mutation in existing where mutation.operation == .update {
                context.delete(mutation)
            }

        case .create:
            break
        }

        context.insert(PendingMutation(
            entityType: entityType,
            entityId: entityId,
            operation: operation,
            parentId: parentId,
            payload: payload
        ))
        saveAndRefresh(context)
    }

    // MARK: - Flush

    /// Replays every queued write, oldest first. Safe to call repeatedly — it
    /// no-ops while a flush is already running or while offline.
    @discardableResult
    func flush(context: ModelContext?) async -> Bool {
        guard let context, !isFlushing else { return false }
        guard NetworkMonitor.shared.isConnected, KeychainService.shared.sessionToken != nil else {
            return false
        }

        isFlushing = true
        defer {
            isFlushing = false
            refreshCounts(context)
        }

        var descriptor = FetchDescriptor<PendingMutation>(
            predicate: #Predicate { !$0.failed }
        )
        descriptor.sortBy = [SortDescriptor(\.createdAt, order: .forward)]
        let queued = (try? context.fetch(descriptor)) ?? []
        guard !queued.isEmpty else { return false }

        var didSync = false
        for mutation in queued {
            // Connectivity can drop mid-drain; stop and keep the rest queued.
            guard NetworkMonitor.shared.isConnected else { break }
            let outcome = await apply(mutation)
            switch outcome {
            case .success:
                context.delete(mutation)
                didSync = true
            case .retry(let message):
                mutation.attemptCount += 1
                mutation.lastError = message
                if mutation.attemptCount >= Self.maxAttempts {
                    mutation.failed = true
                }
            case .terminal(let message):
                mutation.attemptCount += 1
                mutation.lastError = message
                mutation.failed = true
            }
            try? context.save()
        }
        return didSync
    }

    /// Clears mutations that gave up, after the user has acknowledged them.
    func discardFailed(context: ModelContext?) {
        guard let context else { return }
        let failed = (try? context.fetch(FetchDescriptor<PendingMutation>(
            predicate: #Predicate { $0.failed }
        ))) ?? []
        for mutation in failed { context.delete(mutation) }
        saveAndRefresh(context)
    }

    /// Recomputes `pendingCount` / `failedCount` from the store.
    func refreshCounts(_ context: ModelContext?) {
        guard let context else { return }
        let all = (try? context.fetch(FetchDescriptor<PendingMutation>())) ?? []
        pendingCount = all.filter { !$0.failed }.count
        failedCount = all.filter(\.failed).count
    }

    // MARK: - Replay

    private enum Outcome {
        case success
        /// Transport-level failure — worth another attempt later.
        case retry(String)
        /// Server rejected the payload; retrying can't fix it.
        case terminal(String)
    }

    private func apply(_ mutation: PendingMutation) async -> Outcome {
        guard let entityType = mutation.entityType, let operation = mutation.operation else {
            return .terminal("Unrecognised queued mutation")
        }
        do {
            switch (entityType, operation) {
            case (.pack, .create):
                let payload: PackMutationPayload = try decode(mutation.payload)
                _ = try await packService.createPack(
                    id: mutation.entityId,
                    name: payload.name,
                    description: payload.description,
                    category: payload.category,
                    isPublic: payload.isPublic
                )
            case (.pack, .update):
                let payload: PackMutationPayload = try decode(mutation.payload)
                _ = try await packService.updatePack(
                    mutation.entityId,
                    name: payload.name,
                    description: payload.description,
                    category: payload.category,
                    isPublic: payload.isPublic
                )
            case (.pack, .delete):
                try await packService.deletePack(mutation.entityId)

            case (.packItem, .create):
                let payload: PackItemMutationPayload = try decode(mutation.payload)
                guard let packId = mutation.parentId else {
                    return .terminal("Queued pack item has no pack")
                }
                _ = try await packService.addItem(
                    to: packId,
                    id: mutation.entityId,
                    name: payload.name,
                    weight: payload.weight,
                    weightUnit: payload.weightUnit,
                    quantity: payload.quantity,
                    category: payload.category,
                    consumable: payload.consumable,
                    worn: payload.worn,
                    notes: payload.notes
                )
            case (.packItem, .update):
                let payload: PackItemMutationPayload = try decode(mutation.payload)
                guard let packId = mutation.parentId else {
                    return .terminal("Queued pack item has no pack")
                }
                _ = try await packService.updateItem(
                    mutation.entityId,
                    in: packId,
                    name: payload.name,
                    weight: payload.weight,
                    weightUnit: payload.weightUnit,
                    quantity: payload.quantity,
                    category: payload.category,
                    consumable: payload.consumable,
                    worn: payload.worn,
                    notes: payload.notes
                )
            case (.packItem, .delete):
                guard let packId = mutation.parentId else {
                    return .terminal("Queued pack item has no pack")
                }
                try await packService.deleteItem(mutation.entityId, from: packId)

            case (.trip, .create):
                let payload: TripMutationPayload = try decode(mutation.payload)
                _ = try await tripService.createTrip(
                    id: mutation.entityId,
                    name: payload.name,
                    description: payload.description,
                    startDate: payload.startDate?.toDate(),
                    endDate: payload.endDate?.toDate(),
                    location: payload.location,
                    notes: payload.notes,
                    packId: payload.packId
                )
            case (.trip, .update):
                let payload: TripMutationPayload = try decode(mutation.payload)
                _ = try await tripService.updateTrip(
                    mutation.entityId,
                    name: payload.name,
                    description: payload.description,
                    startDate: payload.startDate?.toDate(),
                    endDate: payload.endDate?.toDate(),
                    location: payload.location,
                    notes: payload.notes,
                    packId: payload.packId
                )
            case (.trip, .delete):
                try await tripService.deleteTrip(mutation.entityId)
            }
            return .success
        } catch {
            return classify(error, operation: operation)
        }
    }

    /// Decides whether a replay failure is worth retrying.
    private func classify(_ error: Error, operation: OutboxOperation) -> Outcome {
        switch error {
        case PackRatError.httpError(let statusCode, let message):
            // The server already agrees with our intent.
            if operation == .delete, statusCode == 404 { return .success }
            if operation == .create, statusCode == 409 { return .success }
            // 4xx means the request itself is wrong — retrying can't fix it.
            if (400...499).contains(statusCode) {
                return .terminal(message ?? "Server rejected the change (\(statusCode))")
            }
            // 5xx is transient.
            return .retry(message ?? "Server error (\(statusCode))")
        case PackRatError.notFound:
            return operation == .delete ? .success : .terminal("The item no longer exists on the server")
        case PackRatError.unauthorized:
            // Keep queued: the write should survive a re-auth.
            return .retry("Sign-in required to sync")
        case PackRatError.decodingError:
            return .terminal("Could not read the server response")
        default:
            return .retry(error.localizedDescription)
        }
    }

    private func decode<T: Decodable>(_ data: Data?) throws -> T {
        guard let data else { throw PackRatError.decodingError(OutboxError.missingPayload) }
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func pendingMutations(for entityId: String, context: ModelContext) -> [PendingMutation] {
        var descriptor = FetchDescriptor<PendingMutation>(
            predicate: #Predicate { $0.entityId == entityId && !$0.failed }
        )
        descriptor.sortBy = [SortDescriptor(\.createdAt, order: .forward)]
        return (try? context.fetch(descriptor)) ?? []
    }

    private func saveAndRefresh(_ context: ModelContext) {
        try? context.save()
        refreshCounts(context)
    }
}

enum OutboxError: Error {
    case missingPayload
}

extension OutboxService {
    /// Convenience for encoding a payload at the call site.
    static func encode<T: Encodable>(_ value: T) -> Data? {
        try? JSONEncoder().encode(value)
    }
}
