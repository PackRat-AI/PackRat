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
        if let context, !isCacheLoaded {
            let cached = (try? context.fetch(FetchDescriptor<CachedTrip>(
                sortBy: [SortDescriptor(\.cachedAt, order: .reverse)]
            ))) ?? []
            let cachedTrips = cached.compactMap { $0.toTrip() }
            if !cachedTrips.isEmpty {
                trips = cachedTrips
                isCacheLoaded = true
            }
        }

        isLoading = trips.isEmpty
        error = nil
        defer { isLoading = false }

        do {
            let fresh = try await service.listTrips(page: 1, limit: pageSize)
            trips = fresh
            currentPage = 1
            hasMore = fresh.count == pageSize
            if let context {
                writeCacheTrips(fresh, context: context)
            }
        } catch {
            if trips.isEmpty { self.error = error.localizedDescription }
        }
    }

    func loadMore() async {
        guard hasMore, !isLoading else { return }
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
                    location: TripLocationBody?, notes: String?, packId: String?) async throws {
        let trip = try await service.createTrip(
            name: name, description: description, startDate: startDate, endDate: endDate,
            location: location, notes: notes, packId: packId
        )
        trips.insert(trip, at: 0)
    }

    func updateTrip(_ tripId: String, name: String, description: String?, startDate: Date?,
                    endDate: Date?, location: TripLocationBody?, notes: String?, packId: String?) async throws {
        let updated = try await service.updateTrip(
            tripId, name: name, description: description, startDate: startDate, endDate: endDate,
            location: location, notes: notes, packId: packId
        )
        if let idx = trips.firstIndex(where: { $0.id == tripId }) {
            trips[idx] = updated
        }
    }

    // Optimistic delete
    func deleteTrip(_ tripId: String) async throws {
        guard let idx = trips.firstIndex(where: { $0.id == tripId }) else { return }
        let removed = trips.remove(at: idx)
        do {
            try await service.deleteTrip(tripId)
        } catch {
            trips.insert(removed, at: idx)
            throw error
        }
    }
}
