import CoreLocation
import Foundation
import Testing
@testable import PackRat

/// Covers #1859 slice (d2): long-trail progress from logged routes, and the
/// long-trail, peak-list and park-list goals.
@Suite("Long trails and list goals")
struct LongTrailsTests {

    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }

    private func day(_ y: Int, _ m: Int, _ d: Int) -> Date {
        calendar.date(from: DateComponents(year: y, month: m, day: d, hour: 12))!
    }

    private var now: Date { day(2026, 10, 5) }

    /// One degree of longitude due east along 40° N: about 85 km.
    private var straightTrail: LongTrail {
        LongTrail(
            code: "TST", name: "Test Trail", officialMiles: 60, states: ["XX"],
            lines: [[CLLocationCoordinate2D(latitude: 40, longitude: -120), CLLocationCoordinate2D(latitude: 40, longitude: -119)]]
        )
    }

    /// A route along the trail from `from` to `to` (shares of its length),
    /// `offset` degrees of latitude off it (0.001° ≈ 110 m).
    private func route(_ from: Double, _ to: Double, offset: Double = 0.001) -> [(Double, Double)] {
        stride(from: from, through: to, by: 0.01).map { (40 + offset, -120 + $0) }
    }

    private func trip(
        _ id: String, _ start: Date, route: [(Double, Double)] = [], summits: [TripSummit] = [],
        at point: (Double, Double)? = nil
    ) -> Trip {
        let log: TripLog? = route.isEmpty && summits.isEmpty ? nil : TripLog(
            route: route.isEmpty ? nil : Polyline.encode(route.map { CLLocationCoordinate2D(latitude: $0.0, longitude: $0.1) }),
            summits: summits
        )
        return Trip(
            id: id, name: "Trip \(id)", description: nil, notes: nil,
            location: point.map { TripLocation(latitude: $0.0, longitude: $0.1, name: nil) },
            startDate: start.iso8601String(), endDate: start.iso8601String(),
            userId: nil, packId: nil, deleted: false, createdAt: nil, updatedAt: nil,
            log: log
        )
    }

    private func finished(_ trips: [Trip]) -> [TripStats.FinishedTrip] {
        TripStats(trips: trips, packs: [], now: now, calendar: calendar).finished
    }

    // MARK: - Trail geometry

    @Test("Stations add up to the line's length")
    func stations() {
        let trail = straightTrail
        let expected = LocalProjection.distance(trail.lines[0][0], trail.lines[0][1])
        #expect(abs(trail.lineMeters - expected) < 1)
        #expect(trail.stations.count == Int((expected / LongTrail.stationSpacing).rounded(.up)))
        #expect(trail.stations.dropLast().allSatisfy { $0.meters == LongTrail.stationSpacing })
    }

    @Test("The bundled trails load with lines close to their official lengths")
    func bundled() throws {
        let codes = LongTrails.all.map(\.code)
        #expect(codes == ["PCT", "AT", "CDT"])
        for trail in LongTrails.all {
            // Simplification shortens a line; it shouldn't lose more than a quarter.
            let ratio = trail.lineMeters / trail.officialMeters
            #expect(ratio > 0.75 && ratio < 1.05, "\(trail.code) line is \(ratio) of official")
        }
        let pct = try #require(LongTrails.trail(code: "PCT"))
        #expect(pct.minLatitude < 32.7 && pct.maxLatitude > 48.9)
    }

    // MARK: - Progress

    @Test("A route along part of the trail walks that share of it, scaled to the official length")
    func partialRoute() {
        let progress = LongTrailProgress(trail: straightTrail, finished: finished([trip("a", day(2026, 6, 1), route: route(0, 0.25))]))
        #expect(abs(progress.fraction - 0.25) < 0.02)
        #expect(abs(progress.meters - 0.25 * straightTrail.officialMeters) < 0.02 * straightTrail.officialMeters)
        #expect(progress.trips.map(\.id) == ["a"])
    }

    @Test("A route a kilometre off the trail walks none of it")
    func offTrail() {
        let progress = LongTrailProgress(trail: straightTrail, finished: finished([trip("a", day(2026, 6, 1), route: route(0, 0.5, offset: 0.01))]))
        #expect(!progress.hasProgress)
        #expect(progress.trips.isEmpty)
    }

    @Test("A stretch walked twice counts once, and the later trip shows only what was new")
    func overlap() throws {
        let progress = LongTrailProgress(trail: straightTrail, finished: finished([
            trip("later", day(2026, 8, 1), route: route(0.2, 0.5)),
            trip("first", day(2026, 6, 1), route: route(0, 0.3)),
        ]))
        #expect(abs(progress.fraction - 0.5) < 0.02)
        #expect(progress.trips.map(\.id) == ["first", "later"])
        let later = try #require(progress.trips.last)
        #expect(abs(later.meters / straightTrail.officialMeters - 0.3) < 0.02)
        #expect(abs(later.newMeters / straightTrail.officialMeters - 0.2) < 0.02)
    }

    @Test("Walked stretches come back as separate lines to draw")
    func walkedLines() {
        let progress = LongTrailProgress(trail: straightTrail, finished: finished([
            trip("a", day(2026, 6, 1), route: route(0, 0.2)),
            trip("b", day(2026, 7, 1), route: route(0.6, 0.8)),
        ]))
        let lines = progress.walkedLines
        #expect(lines.count == 2)
        #expect(lines.allSatisfy { $0.count >= 2 })
    }

    @Test("A sparse route still walks the trail between its points")
    func sparseRoute() {
        // Two points 40 km apart: only segment distance can tell this walked the trail.
        let progress = LongTrailProgress(trail: straightTrail, finished: finished([
            trip("a", day(2026, 6, 1), route: [(40.001, -120), (40.001, -119.5)]),
        ]))
        #expect(abs(progress.fraction - 0.5) < 0.02)
    }

    // MARK: - Goals

    @Test("A long-trail goal reads the trail's progress, with no pace until it has a finish date")
    func longTrailGoal() throws {
        let trail = straightTrail
        let trails = [LongTrailProgress(trail: trail, finished: finished([trip("a", day(2025, 6, 1), route: route(0, 0.5))]))]
        var goal = TripGoal(
            id: "g", kind: .longTrail, metric: .distance, target: trail.officialMeters,
            startDate: "2026-01-01T00:00:00.000Z", trailCode: "TST"
        )
        let open = try #require(TripGoalProgress(goal: goal, finished: [], longTrails: trails, now: now, calendar: calendar))
        // A trip from before the goal was set still counts.
        #expect(abs(open.fraction - 0.5) < 0.02)
        #expect(open.phase == .active)
        #expect(open.end == nil)
        #expect(open.pace == nil)

        goal.endDate = "2026-12-31T00:00:00.000Z"
        let dated = try #require(TripGoalProgress(goal: goal, finished: [], longTrails: trails, now: now, calendar: calendar))
        #expect(dated.end != nil)
        // ~76% of the year gone, half the trail done.
        guard case .behind = dated.pace else {
            Issue.record("Expected behind pace, got \(String(describing: dated.pace))")
            return
        }

        goal.trailCode = "NOPE"
        #expect(TripGoalProgress(goal: goal, finished: [], longTrails: trails, now: now, calendar: calendar) == nil)
    }

    @Test("A peak list ticks off by OpenStreetMap node, else by name")
    func peakListGoal() throws {
        let trips = [trip("a", day(2019, 8, 1), summits: [
            TripSummit(name: "Mount Whitney", elevationMeters: 4421, latitude: 36.58, longitude: -118.29, osmId: 1),
            TripSummit(name: "Mt. Langley", elevationMeters: 4275, latitude: 36.52, longitude: -118.24, osmId: nil),
        ])]
        let done = finished(trips)
        let record = TripParksAndPeaks(finished: done, entries: [], parks: [])
        let goal = TripGoal(
            id: "p", kind: .peakList, metric: .summits, target: 3,
            peaks: [
                TripSummit(name: "Whitney", elevationMeters: nil, latitude: 0, longitude: 0, osmId: 1),
                TripSummit(name: "Mount Langley", elevationMeters: nil, latitude: 0, longitude: 0, osmId: 2),
                TripSummit(name: "Mount Russell", elevationMeters: nil, latitude: 0, longitude: 0, osmId: 3),
            ]
        )
        let progress = try #require(TripGoalProgress(goal: goal, finished: done, parksAndPeaks: record, now: now, calendar: calendar))
        #expect(progress.value == 2)
        #expect(progress.remaining == 1)
    }

    @Test("A park list counts only its parks; with none named it counts them all")
    func parkListGoal() throws {
        func square(_ code: String, _ lat: Double) -> NationalPark {
            let ring = [(lat, 0.0), (lat, 1), (lat + 1, 1), (lat + 1, 0), (lat, 0)]
                .map { CLLocationCoordinate2D(latitude: $0.0, longitude: $0.1) }
            return NationalPark(code: code, name: code, states: [], rings: [ring])
        }
        let parks = [square("AAAA", 10), square("BBBB", 20), square("CCCC", 30)]
        let done = finished([
            trip("a", day(2018, 5, 1), at: (10.5, 0.5)),
            trip("b", day(2026, 5, 1), at: (20.5, 0.5)),
        ])
        let record = TripParksAndPeaks(finished: done, entries: [], parks: parks)

        let listed = try #require(TripGoalProgress(
            goal: TripGoal(id: "l", kind: .parkList, metric: .parks, target: 2, parkCodes: ["AAAA", "CCCC"]),
            finished: done, parksAndPeaks: record, now: now, calendar: calendar
        ))
        #expect(listed.value == 1)

        let all = try #require(TripGoalProgress(
            goal: TripGoal(id: "e", kind: .parkList, metric: .parks, target: 3),
            finished: done, parksAndPeaks: record, now: now, calendar: calendar
        ))
        #expect(all.value == 2)
    }

    @Test("Peak names match across spellings")
    func peakNames() {
        #expect(TripGoal.normalizedPeakName("Mt. Whitney") == TripGoal.normalizedPeakName("mount  whitney"))
        #expect(TripGoal.normalizedPeakName("Mount Whitney") != TripGoal.normalizedPeakName("Mount Russell"))
    }

    @Test("A goal request carries only its own kind's fields")
    func requestFields() {
        let peak = TripSummit(name: "A", elevationMeters: nil, latitude: 0, longitude: 0, osmId: nil)
        let trail = TripGoalRequest(goal: TripGoal(
            id: "t", kind: .longTrail, metric: .distance, target: 1, year: 2026, name: "x",
            startDate: "2026-01-01T00:00:00.000Z", trailCode: "PCT", peaks: [peak], parkCodes: ["YOSE"]
        ))
        #expect(trail.trailCode == "PCT")
        #expect(trail.year == nil)
        #expect(trail.name == nil)
        #expect(trail.peaks == nil)
        #expect(trail.parkCodes == nil)
        #expect(trail.startDate == "2026-01-01T00:00:00.000Z")

        let list = TripGoalRequest(goal: TripGoal(id: "p", kind: .peakList, metric: .summits, target: 1, name: "14ers", trailCode: "PCT", peaks: [peak]))
        #expect(list.name == "14ers")
        #expect(list.peaks == [peak])
        #expect(list.trailCode == nil)
    }

    @Test("List goals are titled by what they list")
    func titles() {
        #expect(TripGoal(id: "a", kind: .longTrail, metric: .distance, target: 1, trailCode: "PCT").title == "Pacific Crest Trail")
        #expect(TripGoal(id: "b", kind: .parkList, metric: .parks, target: 63).title == "Every National Park")
        #expect(TripGoal(id: "c", kind: .parkList, metric: .parks, target: 2, name: "Mighty Five", parkCodes: ["ZION"]).title == "Mighty Five")
        #expect(TripGoal(id: "d", kind: .peakList, metric: .summits, target: 1).title == "Peak List")
    }
}
