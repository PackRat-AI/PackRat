import Foundation
import Observation
import SwiftData

@Observable
@MainActor
final class TripsViewModel {
    var trips: [Trip] = []
    var isLoading = false
    var isCacheLoaded = false
    var error: String?
    var searchText = ""

    private let service: TripService

    init(service: TripService = .shared) {
        self.service = service
    }

    var currentPage = 1
    var hasMore = true
    private let pageSize = 30
    private var canUseRemotePersonalStore: Bool {
        NetworkMonitor.shared.isConnected && KeychainService.shared.sessionToken != nil
    }

    var filteredTrips: [Trip] {
        guard !searchText.isEmpty else { return trips }
        return trips.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
            || ($0.description?.localizedCaseInsensitiveContains(searchText) ?? false)
            || ($0.location?.name?.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }

    var upcomingTrips: [Trip] {
        let today = Calendar.current.startOfDay(for: Date())
        return trips
            .filter { ($0.startDate?.toDate() ?? .distantPast) >= today }
            .sorted { ($0.startDate ?? "") < ($1.startDate ?? "") }
    }

    var pastTrips: [Trip] {
        let today = Calendar.current.startOfDay(for: Date())
        return trips.filter { ($0.startDate?.toDate() ?? .distantPast) < today }
    }

    func load(context: ModelContext? = nil) async {
        if VisualSampleData.isEnabled && !trips.isEmpty {
            isLoading = false
            error = nil
            return
        }
        if VisualSampleData.isScreenshotCapture {
            isLoading = false
            error = nil
            isCacheLoaded = true
            hasMore = false
            return
        }

        if let context, !isCacheLoaded {
            let cached = (try? context.fetch(FetchDescriptor<CachedTrip>(
                sortBy: [SortDescriptor(\.cachedAt, order: .reverse)]
            ))) ?? []
            let cachedTrips = cached.compactMap { $0.toTrip() }
            if !cachedTrips.isEmpty {
                trips = cachedTrips
            }
            isCacheLoaded = true
        }

        isLoading = trips.isEmpty
        error = nil
        defer { isLoading = false }

        guard canUseRemotePersonalStore else {
            if trips.isEmpty { isCacheLoaded = true }
            return
        }

        do {
            let fresh = try await service.listTrips(page: 1, limit: pageSize)
            trips = fresh
            currentPage = 1
            hasMore = fresh.count == pageSize
            if let context {
                writeCacheTrips(fresh, context: context)
            }
        } catch {
            if trips.isEmpty {
                // Keep the personal store local-first: an unavailable refresh
                // should not replace an otherwise usable empty local library
                // with a blocking connection error.
                isCacheLoaded = true
            } else {
                self.error = error.localizedDescription
            }
        }
    }

    func loadMore() async {
        guard hasMore, !isLoading, canUseRemotePersonalStore else { return }
        let nextPage = currentPage + 1
        isLoading = true
        defer { isLoading = false }
        do {
            let more = try await service.listTrips(page: nextPage, limit: pageSize)
            trips.append(contentsOf: more)
            currentPage = nextPage
            hasMore = more.count == pageSize
        } catch { }
    }

    private func writeCacheTrips(_ freshTrips: [Trip], context: ModelContext) {
        let existing = (try? context.fetch(FetchDescriptor<CachedTrip>())) ?? []
        let existingMap = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })
        for trip in freshTrips {
            if let cached = existingMap[trip.id] {
                cached.name = trip.name
                cached.startDate = trip.startDate
                cached.jsonData = try? JSONEncoder().encode(trip)
                cached.cachedAt = Date()
            } else {
                context.insert(CachedTrip(from: trip))
            }
        }
        let freshIds = Set(freshTrips.map(\.id))
        for cached in existing where !freshIds.contains(cached.id) {
            context.delete(cached)
        }
        try? context.save()
    }

    func createTrip(name: String, description: String?, startDate: Date?, endDate: Date?,
                    location: TripLocationBody?, notes: String?, packId: String?,
                    context: ModelContext? = nil) async throws {
        let localTrip = makeLocalTrip(
            name: name, description: description, startDate: startDate, endDate: endDate,
            location: location, notes: notes, packId: packId
        )
        let trip: Trip
        if canUseRemotePersonalStore {
            do {
                trip = try await service.createTrip(
                    name: name, description: description, startDate: startDate, endDate: endDate,
                    location: location, notes: notes, packId: packId
                )
            } catch {
                trip = localTrip
            }
        } else {
            trip = localTrip
        }
        trips.insert(trip, at: 0)
        upsertCachedTrip(trip, context: context)
    }

    func updateTrip(_ tripId: String, name: String, description: String?, startDate: Date?,
                    endDate: Date?, location: TripLocationBody?, notes: String?, packId: String?,
                    context: ModelContext? = nil) async throws {
        guard let existing = trips.first(where: { $0.id == tripId }) else { return }
        let localUpdated = rebuildTrip(
            existing,
            name: name,
            description: description,
            startDate: startDate?.iso8601String(),
            endDate: endDate?.iso8601String(),
            location: location.map { TripLocation(latitude: $0.latitude, longitude: $0.longitude, name: $0.name) },
            notes: notes,
            packId: packId,
            updatedAt: Date.iso8601Now()
        )
        let updated: Trip
        if canUseRemotePersonalStore {
            do {
                updated = try await service.updateTrip(
                    tripId, name: name, description: description, startDate: startDate, endDate: endDate,
                    location: location, notes: notes, packId: packId
                )
            } catch {
                updated = localUpdated
            }
        } else {
            updated = localUpdated
        }
        if let idx = trips.firstIndex(where: { $0.id == tripId }) {
            trips[idx] = updated
        }
        upsertCachedTrip(updated, context: context)
    }

    // Optimistic delete
    func deleteTrip(_ tripId: String, context: ModelContext? = nil) async throws {
        guard let idx = trips.firstIndex(where: { $0.id == tripId }) else { return }
        let removed = trips.remove(at: idx)
        deleteCachedTrip(tripId, context: context)
        guard !tripId.hasPrefix("local-") else { return }
        guard canUseRemotePersonalStore else { return }
        do {
            try await service.deleteTrip(tripId)
        } catch {
            trips.insert(removed, at: idx)
            upsertCachedTrip(removed, context: context)
            throw error
        }
    }

    private func makeLocalTrip(
        name: String,
        description: String?,
        startDate: Date?,
        endDate: Date?,
        location: TripLocationBody?,
        notes: String?,
        packId: String?
    ) -> Trip {
        let now = Date.iso8601Now()
        return Trip(
            id: "local-\(UUID().uuidString)",
            name: name,
            description: description,
            notes: notes,
            location: location.map { TripLocation(latitude: $0.latitude, longitude: $0.longitude, name: $0.name) },
            startDate: startDate?.iso8601String(),
            endDate: endDate?.iso8601String(),
            userId: nil,
            packId: packId,
            deleted: false,
            createdAt: now,
            updatedAt: now
        )
    }

    private func rebuildTrip(
        _ trip: Trip,
        name: String,
        description: String?,
        startDate: String?,
        endDate: String?,
        location: TripLocation?,
        notes: String?,
        packId: String?,
        updatedAt: String
    ) -> Trip {
        Trip(
            id: trip.id,
            name: name,
            description: description,
            notes: notes,
            location: location,
            startDate: startDate,
            endDate: endDate,
            userId: trip.userId,
            packId: packId,
            deleted: trip.deleted,
            createdAt: trip.createdAt,
            updatedAt: updatedAt
        )
    }

    private func upsertCachedTrip(_ trip: Trip, context: ModelContext?) {
        guard let context else { return }
        if let existing = try? context.fetch(FetchDescriptor<CachedTrip>(predicate: #Predicate { $0.id == trip.id })).first {
            existing.name = trip.name
            existing.tripDescription = trip.description
            existing.startDate = trip.startDate
            existing.endDate = trip.endDate
            existing.locationName = trip.location?.name
            existing.packId = trip.packId
            existing.jsonData = try? JSONEncoder().encode(trip)
            existing.cachedAt = Date()
        } else {
            context.insert(CachedTrip(from: trip))
        }
        try? context.save()
    }

    private func deleteCachedTrip(_ tripId: String, context: ModelContext?) {
        guard let context else { return }
        if let cached = try? context.fetch(FetchDescriptor<CachedTrip>(predicate: #Predicate { $0.id == tripId })).first {
            context.delete(cached)
            try? context.save()
        }
    }
}
