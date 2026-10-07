import CoreLocation
import Foundation
import Testing
@testable import PackRat

/// Covers #1859 slice (e): the year in review, share-card map geometry, and
/// the CSV and GPX exports.
@Suite("Trip year in review, sharing and export")
struct TripShareAndExportTests {

    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }

    private func day(_ y: Int, _ m: Int, _ d: Int) -> Date {
        calendar.date(from: DateComponents(year: y, month: m, day: d, hour: 12))!
    }

    private func trip(
        _ id: String,
        _ start: Date,
        _ end: Date,
        name: String? = nil,
        lat: Double? = nil,
        lng: Double = 0,
        log: TripLog? = nil,
        notes: String? = nil,
        excluded: Bool = false
    ) -> Trip {
        Trip(
            id: id, name: name ?? "Trip \(id)", description: nil, notes: notes,
            location: lat.map { TripLocation(latitude: $0, longitude: lng, name: "Spot \(id)") },
            startDate: start.iso8601String(), endDate: end.iso8601String(),
            userId: nil, packId: nil, deleted: false, createdAt: nil, updatedAt: nil,
            log: log, excludedFromStats: excluded
        )
    }

    private let now = Calendar(identifier: .gregorian).date(from: DateComponents(
        timeZone: TimeZone(identifier: "UTC"), year: 2026, month: 12, day: 10, hour: 12
    ))!

    private func finished(_ trips: [Trip]) -> [TripStats.FinishedTrip] {
        TripStats(trips: trips, packs: [], now: now, calendar: calendar).finished
    }

    /// A 0.2° square park around (40, -110).
    private let park = NationalPark(
        code: "TEST", name: "Test Park", states: ["UT"],
        rings: [[
            CLLocationCoordinate2D(latitude: 39.9, longitude: -110.1),
            CLLocationCoordinate2D(latitude: 39.9, longitude: -109.9),
            CLLocationCoordinate2D(latitude: 40.1, longitude: -109.9),
            CLLocationCoordinate2D(latitude: 40.1, longitude: -110.1),
            CLLocationCoordinate2D(latitude: 39.9, longitude: -110.1),
        ]]
    )

    private func review(_ trips: [Trip], year: Int = 2026, goals: [TripGoalProgress] = []) -> YearInReview? {
        let done = finished(trips)
        let record = TripParksAndPeaks(finished: done, entries: [], parks: [park])
        return YearInReview(year: year, finished: done, record: record, goals: goals, calendar: calendar)
    }

    // MARK: - When it's offered

    @Test("Offered for the closing year in December and the year gone in January, never otherwise")
    func offeredYear() {
        #expect(YearInReview.offeredYear(now: day(2026, 12, 1), calendar: calendar) == 2026)
        #expect(YearInReview.offeredYear(now: day(2027, 1, 31), calendar: calendar) == 2026)
        #expect(YearInReview.offeredYear(now: day(2026, 10, 7), calendar: calendar) == nil)
        #expect(YearInReview.offeredYear(now: day(2026, 10, 7), calendar: calendar, force: true) == 2026)
    }

    @Test("A year with no finished trips has no review")
    func emptyYear() {
        #expect(review([trip("a", day(2025, 6, 1), day(2025, 6, 3))]) == nil)
    }

    // MARK: - Contents

    @Test("Totals clip a trip crossing into the year after, and count only the year's trips")
    func totalsForTheYear() throws {
        let result = try #require(review([
            trip("old", day(2025, 6, 1), day(2025, 6, 4)),
            trip("a", day(2026, 3, 1), day(2026, 3, 3)),
            trip("nye", day(2026, 12, 30), day(2027, 1, 2)),
        ], year: 2026))
        // The New Year trip ends after `now`, so it isn't finished yet.
        #expect(result.totals.trips == 1)
        #expect(result.totals.nights == 2)

        let lastYear = try #require(review([
            trip("x", day(2025, 12, 30), day(2026, 1, 2)),
        ], year: 2025))
        #expect(lastYear.totals.nights == 1)
    }

    @Test("Busiest month by nights; the month bars cover all twelve months")
    func busiestMonth() throws {
        let result = try #require(review([
            trip("a", day(2026, 3, 1), day(2026, 3, 2)),
            trip("b", day(2026, 3, 20), day(2026, 3, 21)),
            trip("c", day(2026, 7, 1), day(2026, 7, 5)),
        ]))
        #expect(result.months.count == 12)
        #expect(calendar.component(.month, from: try #require(result.busiestMonth).month) == 7)
        #expect(result.months[2].trips == 2)
    }

    @Test("Longest by nights and farthest by logged distance")
    func longestAndFarthest() throws {
        let result = try #require(review([
            trip("long", day(2026, 3, 1), day(2026, 3, 6)),
            trip("far", day(2026, 4, 1), day(2026, 4, 2), log: TripLog(distanceMeters: 40_000)),
        ]))
        #expect(result.longestTrip?.id == "long")
        #expect(result.farthestTrip?.id == "far")
        #expect(result.pages.contains(.longestTrip))
    }

    @Test("New places are more than a kilometre from every earlier trip")
    func newPlaces() throws {
        let result = try #require(review([
            trip("before", day(2025, 5, 1), day(2025, 5, 2), lat: 45, lng: 7),
            trip("again", day(2026, 5, 1), day(2026, 5, 2), lat: 45.001, lng: 7),
            trip("new", day(2026, 6, 1), day(2026, 6, 2), lat: 46, lng: 8),
            trip("newTwice", day(2026, 7, 1), day(2026, 7, 2), lat: 46.001, lng: 8),
        ]))
        #expect(result.newPlaces == 1)
    }

    @Test("A park first visited this year is new; one visited before is not")
    func newParks() throws {
        let first = try #require(review([trip("a", day(2026, 5, 1), day(2026, 5, 2), lat: 40, lng: -110)]))
        #expect(first.newParks.map(\.code) == ["TEST"])

        let returning = try #require(review([
            trip("a", day(2025, 5, 1), day(2025, 5, 2), lat: 40, lng: -110),
            trip("b", day(2026, 5, 1), day(2026, 5, 2), lat: 40, lng: -110),
        ]))
        #expect(returning.newParks.isEmpty)
        #expect(!returning.pages.contains(.newPlaces))
    }

    @Test("Summits this year: distinct peaks and the highest")
    func summits() throws {
        let rainier = TripSummit(name: "Mount Rainier", elevationMeters: 4_392, latitude: 46.85, longitude: -121.76, osmId: 1)
        let pinnacle = TripSummit(name: "Pinnacle Peak", elevationMeters: 1_955, latitude: 46.77, longitude: -121.72, osmId: 2)
        let result = try #require(review([
            trip("old", day(2025, 8, 1), day(2025, 8, 2), log: TripLog(summits: [rainier])),
            trip("a", day(2026, 8, 1), day(2026, 8, 2), log: TripLog(summits: [pinnacle])),
            trip("b", day(2026, 9, 1), day(2026, 9, 2), log: TripLog(summits: [pinnacle, rainier])),
        ]))
        #expect(result.peakCount == 2)
        #expect(result.highest?.summit.name == "Mount Rainier")
        #expect(result.summits.count == 3)
    }

    @Test("Goals met: this year's annual goals and dated goals ending this year, only when complete")
    func goalsMet() throws {
        let trips = [trip("a", day(2026, 3, 1), day(2026, 3, 11))]
        let done = finished(trips)
        func progress(_ goal: TripGoal) -> TripGoalProgress? {
            TripGoalProgress(goal: goal, finished: done, now: now, calendar: calendar)
        }
        let met = try #require(progress(TripGoal(id: "met", kind: .annual, metric: .nights, target: 5, year: 2026)))
        let missed = try #require(progress(TripGoal(id: "missed", kind: .annual, metric: .nights, target: 50, year: 2026)))
        let result = try #require(review(trips, goals: [met, missed]))
        #expect(result.goalsMet.map(\.goal.id) == ["met"])
        #expect(result.pages.contains(.goals))
    }

    @Test("Pages with nothing to say are left out")
    func pagesSkipEmpty() throws {
        let result = try #require(review([trip("a", day(2026, 3, 1), day(2026, 3, 1))]))
        #expect(result.pages == [.intro, .totals, .summary])
    }

    // MARK: - Share map

    @Test("The line drawing fits routes inside the frame with a margin, north up")
    func lineDrawingFits() throws {
        let route = [
            CLLocationCoordinate2D(latitude: 46.0, longitude: -121.0),
            CLLocationCoordinate2D(latitude: 47.0, longitude: -120.0),
        ]
        let map = ProjectedMap.lineDrawing(routes: [route], pins: [], aspect: 1)
        let points = try #require(map.routes.first)
        for point in points {
            #expect(point.x >= 0.099 && point.x <= 0.901)
            #expect(point.y >= 0.099 && point.y <= 0.901)
        }
        // North is up: the higher latitude sits nearer the top.
        #expect(points[1].y < points[0].y)
        #expect(map.image == nil)
    }

    @Test("A single pin lands in the middle")
    func lineDrawingSinglePin() throws {
        let map = ProjectedMap.lineDrawing(routes: [], pins: [CLLocationCoordinate2D(latitude: 10, longitude: 10)], aspect: 2)
        let pin = try #require(map.pins.first)
        #expect(abs(pin.x - 0.5) < 0.001)
        #expect(abs(pin.y - 0.5) < 0.001)
    }

    // MARK: - CSV

    @Test("CSV fields with commas, quotes and line breaks are quoted; formulas are defused")
    func csvEscaping() {
        #expect(TripExport.csvField("Plain") == "Plain")
        #expect(TripExport.csvField("Rainier, WA") == "\"Rainier, WA\"")
        #expect(TripExport.csvField("The \"big\" one") == "\"The \"\"big\"\" one\"")
        #expect(TripExport.csvField("line\nbreak") == "\"line\nbreak\"")
        #expect(TripExport.csvField("=HYPERLINK(\"x\")") == "\"'=HYPERLINK(\"\"x\"\")\"")
        #expect(TripExport.csvField("-12.5") == "-12.5")
    }

    @Test("CSV has a header and one row per finished trip, including those left out of stats")
    func csvRows() throws {
        let trips = TripExport.finishedTrips([
            trip("b", day(2026, 5, 1), day(2026, 5, 3), name: "Second", lat: 46.5, lng: -121.25,
                 log: TripLog(activities: [.hiking, .camping], distanceMeters: 16_093.44, elevationGainMeters: 304.8)),
            trip("a", day(2026, 4, 1), day(2026, 4, 1), name: "First", excluded: true),
            trip("future", day(2027, 1, 1), day(2027, 1, 2)),
        ], now: now, calendar: calendar)
        #expect(trips.map(\.id) == ["a", "b"])

        let lines = TripExport.csv(trips, unit: .imperial, calendar: calendar).components(separatedBy: "\r\n")
        #expect(lines[0].hasPrefix("Name,Start,End,Nights,Place,Latitude,Longitude,Activities,Distance (mi),Elevation Gain (ft)"))
        #expect(lines[1] == "First,2026-04-01,2026-04-01,0,,,,,,,,No,No,")
        #expect(lines[2] == "Second,2026-05-01,2026-05-03,2,Spot b,46.500000,-121.250000,Hiking; Camping,10.00,1000,,No,Yes,")
        #expect(lines.last == "")
    }

    // MARK: - GPX

    @Test("GPX writes a track per routed trip and a waypoint per summit, escaped")
    func gpx() throws {
        let route = Polyline.encode([
            CLLocationCoordinate2D(latitude: 46.1, longitude: -121.1),
            CLLocationCoordinate2D(latitude: 46.2, longitude: -121.2),
        ])
        let summit = TripSummit(name: "Peak <1>", elevationMeters: 2_000, latitude: 46.2, longitude: -121.2, osmId: nil)
        let xml = try #require(TripExport.gpx([
            trip("a", day(2026, 4, 1), day(2026, 4, 2), name: "Fish & Chips",
                 log: TripLog(activities: [.backpacking], route: route, summits: [summit])),
            trip("b", day(2026, 5, 1), day(2026, 5, 2)),
        ]))
        #expect(xml.contains(#"<gpx version="1.1" creator="PackRat""#))
        #expect(xml.components(separatedBy: "<trk>").count == 2)
        #expect(xml.components(separatedBy: "<trkpt ").count == 3)
        #expect(xml.contains("<name>Fish &amp; Chips</name>"))
        #expect(xml.contains("<name>Peak &lt;1&gt;</name>"))
        #expect(xml.contains("<type>backpacking</type>"))
        // Waypoints come before tracks in GPX 1.1.
        let wpt = try #require(xml.range(of: "<wpt"))
        let trk = try #require(xml.range(of: "<trk>"))
        #expect(wpt.lowerBound < trk.lowerBound)
    }

    @Test("No routes and no summits means no GPX")
    func gpxEmpty() {
        #expect(TripExport.gpx([trip("a", day(2026, 4, 1), day(2026, 4, 2))]) == nil)
    }
}
