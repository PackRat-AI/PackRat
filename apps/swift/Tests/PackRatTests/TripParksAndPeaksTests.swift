import CoreLocation
import Foundation
import MapKit
import Testing
@testable import PackRat

/// Covers #1859 slice (d1): the National Parks checklist, the summits list,
/// the parks and summits goal metrics, and the bundled park boundaries.
@Suite("Trip parks and peaks")
struct TripParksAndPeaksTests {

    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }

    private func day(_ y: Int, _ m: Int, _ d: Int) -> Date {
        calendar.date(from: DateComponents(year: y, month: m, day: d, hour: 12))!
    }

    private var now: Date { day(2026, 10, 5) }

    /// A 1° square from (10, 10) to (11, 11), with a hole from (10.4, 10.4) to (10.6, 10.6).
    private var squarePark: NationalPark {
        func ring(_ a: Double, _ b: Double) -> [CLLocationCoordinate2D] {
            [(a, a), (a, b), (b, b), (b, a), (a, a)].map { CLLocationCoordinate2D(latitude: $0.0, longitude: $0.1) }
        }
        return NationalPark(code: "SQUA", name: "Square", states: ["XX"], rings: [ring(10, 11), ring(10.4, 10.6)])
    }

    private var otherPark: NationalPark {
        let ring = [(20.0, 20.0), (20, 21), (21, 21), (21, 20), (20, 20)]
            .map { CLLocationCoordinate2D(latitude: $0.0, longitude: $0.1) }
        return NationalPark(code: "OTHR", name: "Other", states: ["YY"], rings: [ring])
    }

    private func trip(
        _ id: String, _ start: Date, at point: (Double, Double)? = nil,
        route: [(Double, Double)] = [], summits: [TripSummit] = []
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

    private func record(_ trips: [Trip], entries: [TripStatsEntry] = []) -> TripParksAndPeaks {
        let finished = TripStats(trips: trips, packs: [], now: now, calendar: calendar).finished
        return TripParksAndPeaks(finished: finished, entries: entries, parks: [squarePark, otherPark])
    }

    private func summit(_ name: String, _ metres: Double?, osm: Int? = nil) -> TripSummit {
        TripSummit(name: name, elevationMeters: metres, latitude: 0, longitude: 0, osmId: osm)
    }

    // MARK: - Boundaries

    @Test("A point inside the boundary is in the park; a hole and the outside are not")
    func pointInPolygon() {
        let park = squarePark
        #expect(park.contains(CLLocationCoordinate2D(latitude: 10.2, longitude: 10.8)))
        #expect(!park.contains(CLLocationCoordinate2D(latitude: 10.5, longitude: 10.5)))
        #expect(!park.contains(CLLocationCoordinate2D(latitude: 11.5, longitude: 10.5)))
        #expect(!park.contains(CLLocationCoordinate2D(latitude: 10.5, longitude: 9.9)))
    }

    @Test("The bundled dataset holds all 63 parks, and real places land in the right one")
    func bundledParks() throws {
        let parks = NationalParks.all
        #expect(parks.count == NationalParks.count)
        #expect(Set(parks.map(\.code)).count == 63)
        let yosemite = try #require(parks.first { $0.code == "YOSE" })
        #expect(yosemite.contains(CLLocationCoordinate2D(latitude: 37.7459, longitude: -119.5332)))   // Half Dome
        #expect(!yosemite.contains(CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194)))  // San Francisco
        let rainier = try #require(parks.first { $0.code == "MORA" })
        #expect(rainier.contains(CLLocationCoordinate2D(latitude: 46.8523, longitude: -121.7603)))
    }

    @Test("Decoding reads flat lng/lat rings")
    func decode() throws {
        let json = #"[{"code":"TEST","name":"Test","states":["CA"],"rings":[[0,0,1,0,1,1,0,1,0,0]]}]"#
        let park = try #require(NationalParks.decode(Data(json.utf8)).first)
        #expect(park.code == "TEST")
        #expect(park.rings.first?.count == 5)
        #expect(park.rings.first?[1].longitude == 1)
        #expect(park.contains(CLLocationCoordinate2D(latitude: 0.5, longitude: 0.5)))
        #expect(NationalParks.decode(Data("nope".utf8)).isEmpty)
    }

    // MARK: - Checklist

    @Test("A trip visits a park by its location or by any point of its route")
    func tripVisits() throws {
        let result = record([
            trip("located", day(2025, 6, 1), at: (10.1, 10.1)),
            trip("routed", day(2026, 3, 1), at: (30, 30), route: [(30, 30), (20.5, 20.5), (30, 31)]),
            trip("elsewhere", day(2026, 4, 1), at: (50, 50)),
        ])
        #expect(result.visitedParks.map(\.park.code) == ["SQUA", "OTHR"])
        let square = try #require(result.parks.first { $0.park.code == "SQUA" })
        #expect(square.visits.map(\.tripId) == ["located"])
        #expect(square.firstVisit == calendar.startOfDay(for: day(2025, 6, 1)))
        #expect(square.manualEntryIds.isEmpty)
    }

    @Test("Hand-added visits tick a park, undated ones sort last, deleted ones don't count")
    func manualVisits() throws {
        let result = record(
            [trip("t", day(2026, 2, 1), at: (10.1, 10.1))],
            entries: [
                TripStatsEntry(id: "undated", kind: .park, parkCode: "SQUA"),
                TripStatsEntry(id: "old", kind: .park, parkCode: "SQUA", date: "2019-05-01T00:00:00.000Z"),
                TripStatsEntry(id: "gone", kind: .park, parkCode: "OTHR", deleted: true),
            ]
        )
        let square = try #require(result.parks.first { $0.park.code == "SQUA" })
        #expect(square.visits.map(\.id) == ["old", "trip:t", "undated"])
        #expect(square.manualEntryIds == ["old", "undated"])
        #expect(result.visitedParks.count == 1)
    }

    @Test("Parks visited in a window count each park once")
    func parksInWindow() {
        let result = record([
            trip("a", day(2026, 2, 1), at: (10.1, 10.1)),
            trip("b", day(2026, 5, 1), at: (10.2, 10.2)),
            trip("c", day(2025, 5, 1), at: (20.5, 20.5)),
        ])
        #expect(result.parksVisited(from: day(2026, 1, 1), to: day(2026, 12, 31)) == 1)
        #expect(result.parksVisited(from: day(2025, 1, 1), to: day(2026, 12, 31)) == 2)
    }

    // MARK: - Summits

    @Test("Summits from trips and by hand list newest first; peaks count once; highest wins")
    func ascents() {
        let result = record(
            [
                trip("a", day(2026, 7, 1), summits: [summit("Rainier", 4_392, osm: 1), summit("Unknown Knob", nil)]),
                trip("b", day(2026, 8, 1), summits: [summit("Rainier", 4_392, osm: 1)]),
            ],
            entries: [
                TripStatsEntry(id: "whitney", kind: .summit, name: "Whitney", elevationMeters: 4_421, date: "2019-08-14T00:00:00.000Z"),
                TripStatsEntry(id: "undated", kind: .summit, name: "Old Hill", elevationMeters: 300),
                TripStatsEntry(id: "nameless", kind: .summit, name: ""),
            ]
        )
        #expect(result.ascents.map(\.summit.name) == ["Rainier", "Rainier", "Unknown Knob", "Whitney", "Old Hill"])
        #expect(result.peakCount == 4)
        #expect(result.highest?.summit.name == "Whitney")
        #expect(result.ascents.first?.tripId == "b")
        #expect(result.peaksSummited(from: day(2026, 1, 1), to: day(2026, 12, 31)) == 2)
    }

    @Test("The same peak typed twice matches by name, whatever the case")
    func peakKeys() {
        #expect(summit(" Mount Si ", 1_270).peakKey == summit("mount si", nil).peakKey)
        #expect(summit("Mount Si", 1_270, osm: 9).peakKey == "osm:9")
    }

    // MARK: - Goals

    @Test("Summits and parks goals read from the record")
    func goalMetrics() throws {
        let trips = [
            trip("a", day(2026, 2, 1), at: (10.1, 10.1), summits: [summit("A", 100), summit("B", 200)]),
            trip("b", day(2026, 3, 1), at: (20.5, 20.5), summits: [summit("A", 100)]),
        ]
        let finished = TripStats(trips: trips, packs: [], now: now, calendar: calendar).finished
        let parksAndPeaks = TripParksAndPeaks(finished: finished, entries: [], parks: [squarePark, otherPark])

        let summits = try #require(TripGoalProgress(
            goal: TripGoal(id: "s", kind: .annual, metric: .summits, target: 4, year: 2026),
            finished: finished, parksAndPeaks: parksAndPeaks, now: now, calendar: calendar
        ))
        #expect(summits.value == 2)

        let parks = try #require(TripGoalProgress(
            goal: TripGoal(id: "p", kind: .annual, metric: .parks, target: 2, year: 2026),
            finished: finished, parksAndPeaks: parksAndPeaks, now: now, calendar: calendar
        ))
        #expect(parks.value == 2)
        #expect(parks.isComplete)

        let without = try #require(TripGoalProgress(
            goal: TripGoal(id: "p", kind: .annual, metric: .parks, target: 2, year: 2026),
            finished: finished, now: now, calendar: calendar
        ))
        #expect(without.value == 0)
    }

    @Test("Summits and parks format as counts")
    func formatting() {
        #expect(TripGoal.Metric.summits.format(1, unit: .metric) == "1 peak")
        #expect(TripGoal.Metric.parks.format(14, unit: .imperial) == "14 parks")
    }

    // MARK: - Wire shapes

    @Test("A log decodes summits, drops a bad one, and reads an old log as having none")
    func logSummitsDecode() throws {
        let json = #"""
        {"activities":["hiking"],"summits":[
          {"name":"Mount Si","elevationMeters":1270,"latitude":47.49,"longitude":-121.72,"osmId":42},
          {"name":"Broken"}
        ]}
        """#
        let log = try JSONDecoder().decode(TripLog.self, from: Data(json.utf8))
        #expect(log.summits == [TripSummit(name: "Mount Si", elevationMeters: 1_270, latitude: 47.49, longitude: -121.72, osmId: 42)])
        #expect(!log.isEmpty)

        let old = try JSONDecoder().decode(TripLog.self, from: Data(#"{"activities":[]}"#.utf8))
        #expect(old.summits.isEmpty)
        #expect(old.isEmpty)
    }

    @Test("An entry request carries the whole entry, and an entry becomes a summit only with a name")
    func entryRequest() throws {
        let entry = TripStatsEntry(
            id: "e1", kind: .summit, name: "Whitney", elevationMeters: 4_421,
            latitude: 36.57, longitude: -118.29, osmId: 7, date: "2019-08-14T00:00:00.000Z"
        )
        let request = TripStatsEntryRequest(entry: entry, now: "2026-10-06T00:00:00.000Z")
        let object = try #require(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? [String: Any]
        )
        #expect(object["id"] as? String == "e1")
        #expect(object["kind"] as? String == "summit")
        #expect(object["osmId"] as? Int == 7)
        #expect(object["localCreatedAt"] as? String == "2026-10-06T00:00:00.000Z")
        #expect(entry.summit?.osmId == 7)
        #expect(TripStatsEntry(id: "p", kind: .park, parkCode: "YOSE").summit == nil)
    }

    @Test("The peak search box stays inside what the server accepts")
    func peakBox() {
        let wide = MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 40, longitude: -105),
            span: MKCoordinateSpan(latitudeDelta: 5, longitudeDelta: 8)
        )
        let box = PeakPickerView.box(around: wide)
        #expect(box.north - box.south <= 1)
        #expect(box.east - box.west <= 1.5)
        #expect(abs((box.north + box.south) / 2 - 40) < 0.0001)
    }

    // MARK: - Peak suggestions

    private func nearby(_ id: Int, _ name: String, _ lat: Double, _ lng: Double, _ metres: Double? = nil) -> NearbyPeak {
        NearbyPeak(osmId: id, name: name, elevationMeters: metres, latitude: lat, longitude: lng)
    }

    @Test("Peaks the route crosses come first, in route order; the rest by distance")
    func suggestionsWithRoute() {
        // A route running north along longitude 0 from 0° to 0.1°.
        let route = stride(from: 0.0, through: 0.1, by: 0.001).map { CLLocationCoordinate2D(latitude: $0, longitude: 0) }
        let ranked = PeakSuggestions(
            peaks: [
                nearby(1, "Far High", 0.05, 0.05, 3_000),   // ~5.5 km off
                nearby(2, "Late Summit", 0.09, 0.001, 900),  // ~110 m off, near the end
                nearby(3, "Early Summit", 0.01, 0.0005, 800),// ~55 m off, near the start
                nearby(4, "Close By", 0.05, 0.01, 500),     // ~1.1 km off
            ],
            route: route,
            center: CLLocationCoordinate2D(latitude: 0.05, longitude: 0)
        )
        #expect(ranked.onRoute.map(\.peak.name) == ["Early Summit", "Late Summit"])
        #expect(ranked.nearby.map(\.peak.name) == ["Close By", "Far High"])
        #expect(ranked.onRoute.allSatisfy { $0.isOnRoute && $0.distanceMeters <= PeakSuggestions.onRouteMeters })
        #expect(ranked.all.count == 4)
    }

    @Test("Without a route every peak is nearby, nearest to the map centre first")
    func suggestionsWithoutRoute() {
        let ranked = PeakSuggestions(
            peaks: [nearby(1, "Far", 1, 1), nearby(2, "Near", 0.01, 0.01)],
            route: [],
            center: CLLocationCoordinate2D(latitude: 0, longitude: 0)
        )
        #expect(ranked.onRoute.isEmpty)
        #expect(ranked.nearby.map(\.peak.name) == ["Near", "Far"])
    }

    @Test("Short distances read in metres or tenths of a mile")
    func shortDistance() {
        #expect(TripDistanceUnit.metric.formatShortDistance(247) == "250 m")
        #expect(TripDistanceUnit.metric.formatShortDistance(1_500) == "1.5 km")
        #expect(TripDistanceUnit.imperial.formatShortDistance(1_609.344) == "1.0 mi")
    }
}
