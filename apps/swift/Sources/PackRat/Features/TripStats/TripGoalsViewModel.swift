import Foundation
import Observation
import SwiftData

/// The user's trip stats goals, settings, and the park visits and summits
/// they added by hand, local-first like trips: every
/// change lands on device at once, then reaches the server directly or
/// through the outbox when offline. Both follow the account across devices.
@Observable
@MainActor
final class TripGoalsViewModel {
    static let settingsDefaultsKey = "tripStatsSettings"
    /// Outbox key for the single settings record.
    static let settingsEntityId = "trip-stats-settings"

    private(set) var goals: [TripGoal] = []
    private(set) var entries: [TripStatsEntry] = []
    private(set) var settings: TripStatsSettings

    private let service: TripStatsService
    private let outbox: OutboxService
    private let defaults: UserDefaults
    private var isCacheLoaded = false

    init(service: TripStatsService = .shared, outbox: OutboxService? = nil, defaults: UserDefaults = .standard) {
        self.service = service
        self.outbox = outbox ?? .shared
        self.defaults = defaults
        self.settings = defaults.data(forKey: Self.settingsDefaultsKey)
            .flatMap { try? JSONDecoder().decode(TripStatsSettings.self, from: $0) }
            ?? TripStatsSettings()
    }

    /// On once the user says so.
    var isEnabled: Bool { settings.enabled == true }
    /// Said no: entry points hide, the logs stay.
    var isTurnedOff: Bool { settings.enabled == false }

    private var canUseRemote: Bool {
        NetworkMonitor.shared.isConnected && KeychainService.shared.sessionToken != nil
    }

    // MARK: - Load

    func load(context: ModelContext?) async {
        if let context, !isCacheLoaded {
            let cached = (try? context.fetch(FetchDescriptor<CachedTripGoal>())) ?? []
            let local = cached.compactMap { $0.toGoal() }.activeGoals
            if !local.isEmpty || goals.isEmpty { goals = local.sorted(by: Self.order) }
            let cachedEntries = (try? context.fetch(FetchDescriptor<CachedTripStatsEntry>())) ?? []
            let localEntries = cachedEntries.compactMap { $0.toEntry() }.activeEntries
            if !localEntries.isEmpty || entries.isEmpty { entries = localEntries }
            isCacheLoaded = true
        }
        guard !VisualSampleData.isEnabled, canUseRemote else { return }

        // A change still queued is newer than anything the server holds, so it
        // wins over the fetched copy until the outbox lands it.
        let queued = queuedEntityIds(context: context)

        if !queued.contains(Self.settingsEntityId), let remote = try? await service.settings() {
            applySettings(remote)
        }
        if let remote = try? await service.listGoals() {
            let localQueued = goals.filter { queued.contains($0.id) }
            let remoteKept = remote.activeGoals.filter { !queued.contains($0.id) }
            goals = (remoteKept + localQueued).sorted(by: Self.order)
            writeCache(context: context)
        }
        if let remote = try? await service.listEntries() {
            let localQueued = entries.filter { queued.contains($0.id) }
            let remoteKept = remote.activeEntries.filter { !queued.contains($0.id) }
            entries = remoteKept + localQueued
            writeEntriesCache(context: context)
        }
    }

    // MARK: - Hand-added park visits and summits

    func save(_ entry: TripStatsEntry, context: ModelContext?) async {
        var entry = entry
        let now = Date.iso8601Now()
        let isNew = !entries.contains { $0.id == entry.id }
        if entry.localCreatedAt == nil { entry.localCreatedAt = now }
        entry.localUpdatedAt = now
        if let index = entries.firstIndex(where: { $0.id == entry.id }) {
            entries[index] = entry
        } else {
            entries.append(entry)
        }
        writeEntriesCache(context: context)

        let request = TripStatsEntryRequest(entry: entry, now: now)
        let operation: OutboxOperation = isNew ? .create : .update
        if canUseRemote, !queuedEntityIds(context: context).contains(entry.id) {
            do {
                _ = isNew
                    ? try await service.createEntry(request)
                    : try await service.updateEntry(entry.id, request)
                return
            } catch {
                guard case .retry = outbox.classify(error, operation: operation) else { return }
            }
        }
        outbox.enqueue(
            entityType: .tripStatsEntry,
            entityId: entry.id,
            operation: operation,
            payload: OutboxService.encode(request),
            context: context
        )
    }

    func deleteEntries(ids: [String], context: ModelContext?) async {
        guard !ids.isEmpty else { return }
        entries.removeAll { ids.contains($0.id) }
        writeEntriesCache(context: context)
        let queued = queuedEntityIds(context: context)
        for id in ids {
            if canUseRemote, !queued.contains(id) {
                do {
                    try await service.deleteEntry(id)
                    continue
                } catch {
                    guard case .retry = outbox.classify(error, operation: .delete) else { continue }
                }
            }
            outbox.enqueue(entityType: .tripStatsEntry, entityId: id, operation: .delete, context: context)
        }
    }

    // MARK: - Goals

    /// Creates or replaces `goal`.
    func save(_ goal: TripGoal, context: ModelContext?) async {
        var goal = goal
        let now = Date.iso8601Now()
        let isNew = !goals.contains { $0.id == goal.id }
        if goal.localCreatedAt == nil { goal.localCreatedAt = now }
        goal.localUpdatedAt = now

        if let index = goals.firstIndex(where: { $0.id == goal.id }) {
            goals[index] = goal
        } else {
            goals.append(goal)
        }
        goals.sort(by: Self.order)
        writeCache(context: context)

        let request = TripGoalRequest(goal: goal, now: now)
        let operation: OutboxOperation = isNew ? .create : .update
        if canUseRemote, !queuedEntityIds(context: context).contains(goal.id) {
            do {
                _ = isNew
                    ? try await service.createGoal(request)
                    : try await service.updateGoal(goal.id, request)
                return
            } catch {
                guard case .retry = outbox.classify(error, operation: operation) else { return }
            }
        }
        outbox.enqueue(
            entityType: .tripGoal,
            entityId: goal.id,
            operation: operation,
            payload: OutboxService.encode(request),
            context: context
        )
    }

    func delete(_ goal: TripGoal, context: ModelContext?) async {
        goals.removeAll { $0.id == goal.id }
        writeCache(context: context)

        if canUseRemote, !queuedEntityIds(context: context).contains(goal.id) {
            do {
                try await service.deleteGoal(goal.id)
                return
            } catch {
                guard case .retry = outbox.classify(error, operation: .delete) else { return }
            }
        }
        outbox.enqueue(entityType: .tripGoal, entityId: goal.id, operation: .delete, context: context)
    }

    // MARK: - Settings

    func setEnabled(_ enabled: Bool, context: ModelContext?) async {
        var next = settings
        next.enabled = enabled
        await saveSettings(next, context: context)
    }

    /// Sets, or with nil clears, why the user was away before the comeback
    /// that started with `tripId`.
    func setBreakReason(_ reason: TripBreakReason?, comebackTripId tripId: String, context: ModelContext?) async {
        var next = settings
        next.breakReason = reason
        next.breakReasonTripId = reason == nil ? nil : tripId
        await saveSettings(next, context: context)
    }

    private func saveSettings(_ next: TripStatsSettings, context: ModelContext?) async {
        applySettings(next)
        if canUseRemote, !queuedEntityIds(context: context).contains(Self.settingsEntityId) {
            do {
                _ = try await service.saveSettings(next)
                return
            } catch {
                guard case .retry = outbox.classify(error, operation: .update) else { return }
            }
        }
        outbox.enqueue(
            entityType: .tripStatsSettings,
            entityId: Self.settingsEntityId,
            operation: .update,
            payload: OutboxService.encode(next),
            context: context
        )
    }

    private func applySettings(_ next: TripStatsSettings) {
        settings = next
        defaults.set(try? JSONEncoder().encode(next), forKey: Self.settingsDefaultsKey)
    }

    // MARK: - Sample data

    /// Screenshot and demo runs only: shows goals without touching the server.
    func applySample(goals sample: [TripGoal], entries sampleEntries: [TripStatsEntry] = []) {
        goals = sample.sorted(by: Self.order)
        entries = sampleEntries
        isCacheLoaded = true
    }

    // MARK: - Helpers

    /// Annual goals first (they're the year's headline), then custom goals by
    /// when they end, then by creation.
    private static func order(_ lhs: TripGoal, _ rhs: TripGoal) -> Bool {
        if lhs.kind != rhs.kind { return lhs.kind == .annual }
        if lhs.kind == .custom, lhs.endDate != rhs.endDate { return (lhs.endDate ?? "") < (rhs.endDate ?? "") }
        return (lhs.localCreatedAt ?? "") < (rhs.localCreatedAt ?? "")
    }

    private func queuedEntityIds(context: ModelContext?) -> Set<String> {
        guard let context else { return [] }
        let goalType = OutboxEntityType.tripGoal.rawValue
        let settingsType = OutboxEntityType.tripStatsSettings.rawValue
        let entryType = OutboxEntityType.tripStatsEntry.rawValue
        let rows = (try? context.fetch(FetchDescriptor<PendingMutation>(
            predicate: #Predicate {
                !$0.failed
                    && ($0.entityTypeRaw == goalType || $0.entityTypeRaw == settingsType || $0.entityTypeRaw == entryType)
            }
        ))) ?? []
        return Set(rows.map(\.entityId))
    }

    private func writeCache(context: ModelContext?) {
        guard let context, !VisualSampleData.isEnabled else { return }
        try? context.delete(model: CachedTripGoal.self)
        for goal in goals { context.insert(CachedTripGoal(from: goal)) }
        try? context.save()
    }

    private func writeEntriesCache(context: ModelContext?) {
        guard let context, !VisualSampleData.isEnabled else { return }
        try? context.delete(model: CachedTripStatsEntry.self)
        for entry in entries { context.insert(CachedTripStatsEntry(from: entry)) }
        try? context.save()
    }
}
