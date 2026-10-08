import CoreLocation
import Foundation
import Testing
@testable import PackRat

/// Covers #1859 trails: registry trails named in trip logs, and joining a
/// trail's parts into one trip-log route.
@Suite("Trip trails")
struct TripTrailsTests {
    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }

    private var now: Date { calendar.date(from: DateComponents(year: 2026, month: 6, day: 1))! }

    private let halfDome = TripTrail(id: "fe63954f-386b-4251-9d28-0a11ad044bc3", name: "Half Dome Trail", lengthMeters: 3284)
    private let mist = TripTrail(id: "912e9b12-9bbe-4cf1-b34c-c7c1d5db507c", name: "Mist Trail", lengthMeters: 2392)

    private func trip(_ id: String, day: Int, trails: [TripTrail], excluded: Bool = false) -> Trip {
        let start = calendar.date(from: DateComponents(year: 2026, month: 3, day: day, hour: 12))!
        return Trip(
            id: id, name: "Trip \(id)", description: nil, notes: nil, location: nil,
            startDate: start.iso8601String(), endDate: start.iso8601String(),
            userId: nil, packId: nil, deleted: false, createdAt: nil, updatedAt: nil,
            log: TripLog(activities: [.hiking], trails: trails), excludedFromStats: excluded
        )
    }

    private func record(_ trips: [Trip]) -> TripTrailsRecord {
        TripTrailsRecord(finished: TripStats(trips: trips, packs: [], now: now, calendar: calendar).finished)
    }

    // MARK: - Record

    @Test("A trail walked on several trips is one trail with each walk, newest first")
    func groupsWalksByTrail() throws {
        let record = record([
            trip("a", day: 1, trails: [halfDome, mist]),
            trip("b", day: 9, trails: [mist]),
        ])
        #expect(record.trails.map(\.trail.name) == ["Mist Trail", "Half Dome Trail"])
        let walked = try #require(record.trail(id: mist.id))
        #expect(walked.walks.map(\.tripId) == ["b", "a"])
        #expect(record.totalLengthMeters == 3284 + 2392)
    }

    @Test("Excluded trips and unfinished trips add no trails")
    func skipsExcludedTrips() {
        let record = record([
            trip("a", day: 1, trails: [halfDome], excluded: true),
            trip("future", day: 200, trails: [mist]),
        ])
        #expect(record.isEmpty)
    }

    @Test("A trail listed twice in one log counts as one walk")
    func dedupesWithinATrip() {
        let record = record([trip("a", day: 1, trails: [mist, mist])])
        #expect(record.trail(id: mist.id)?.walks.count == 1)
    }

    @Test("The newest log's name wins when the registry renamed a trail")
    func newestNameWins() {
        let renamed = TripTrail(id: mist.id, name: "Mist Trail (John Muir)", lengthMeters: 2392)
        let record = record([
            trip("b", day: 9, trails: [renamed]),
            trip("a", day: 1, trails: [mist]),
        ])
        #expect(record.trails.map(\.trail.name) == ["Mist Trail (John Muir)"])
    }

    // MARK: - Log decoding

    @Test("Trails round-trip through a trip log; a bad row is dropped, not fatal")
    func decodesTrailsLeniently() throws {
        let json = """
        {"activities":["hiking"],"trails":[{"id":"\(mist.id)","name":"Mist Trail","lengthMeters":2392},{"name":"no id"}]}
        """
        let log = try JSONDecoder().decode(TripLog.self, from: Data(json.utf8))
        #expect(log.trails == [mist])
        let again = try JSONDecoder().decode(TripLog.self, from: JSONEncoder().encode(log))
        #expect(again.trails == [mist])
        #expect(!TripLog(trails: [mist]).isEmpty)
    }

    // MARK: - Joining parts

    @Test("Parts chain nearest end to nearest end, flipping any that run backwards")
    func joinsPartsInOrder() {
        let main = [CLLocationCoordinate2D(latitude: 0, longitude: 0), CLLocationCoordinate2D(latitude: 0, longitude: 0.01),
                    CLLocationCoordinate2D(latitude: 0, longitude: 0.02)]
        // Runs east to west, so it joins the main line's end reversed.
        let backwards = [CLLocationCoordinate2D(latitude: 0, longitude: 0.04), CLLocationCoordinate2D(latitude: 0, longitude: 0.03)]
        let line = TrailRoute.join([backwards, main])
        #expect(line.map(\.longitude) == [0, 0.01, 0.02, 0.03, 0.04])
    }

    @Test("Nothing drawable gives no route")
    func emptyPartsGiveNoRoute() {
        #expect(TrailRoute.join([]).isEmpty)
        #expect(TrailRoute.encoded([[CLLocationCoordinate2D(latitude: 1, longitude: 1)]]) == nil)
    }
}
