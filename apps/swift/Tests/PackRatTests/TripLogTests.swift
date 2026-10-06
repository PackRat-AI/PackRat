import CoreLocation
import Foundation
import Testing
@testable import PackRat

/// Covers #1859 slice (b): reading a GPS track into a trip log, and the
/// figures logged trips add to trip stats.
@Suite("Trip log")
struct TripLogTests {

    // MARK: - GPX

    @Test("GPX track points are read with their elevations")
    func parsesTrackPoints() throws {
        let gpx = """
        <?xml version="1.0"?>
        <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
          <trk><trkseg>
            <trkpt lat="46.80" lon="-121.70"><ele>1600.5</ele></trkpt>
            <trkpt lat="46.81" lon="-121.71"><ele>1650</ele></trkpt>
            <trkpt lat="46.82" lon="-121.72"></trkpt>
          </trkseg></trk>
        </gpx>
        """
        let points = try GPXParser.parse(Data(gpx.utf8))
        #expect(points == [
            TrackPoint(latitude: 46.80, longitude: -121.70, elevation: 1600.5),
            TrackPoint(latitude: 46.81, longitude: -121.71, elevation: 1650),
            TrackPoint(latitude: 46.82, longitude: -121.72, elevation: nil),
        ])
    }

    @Test("A file holding only a planned route falls back to its route points")
    func fallsBackToRoutePoints() throws {
        let gpx = """
        <gpx><rte>
          <rtept lat="1" lon="2"/><rtept lat="3" lon="4"/>
        </rte></gpx>
        """
        let points = try GPXParser.parse(Data(gpx.utf8))
        #expect(points.map(\.latitude) == [1, 3])
    }

    @Test("A file with no points, or not XML at all, is refused")
    func refusesEmptyAndBrokenFiles() {
        #expect(throws: GPXParser.Failure.noPoints) { try GPXParser.parse(Data("<gpx></gpx>".utf8)) }
        #expect(throws: GPXParser.Failure.unreadable) { try GPXParser.parse(Data("not a gpx".utf8)) }
    }

    // MARK: - Track maths

    @Test("Distance follows the great circle: one degree of latitude is about 111 km")
    func distanceIsHaversine() {
        let points = [
            TrackPoint(latitude: 0, longitude: 0, elevation: nil),
            TrackPoint(latitude: 1, longitude: 0, elevation: nil),
        ]
        #expect(abs(TrackMath.distance(points) - 111_195) < 10)
    }

    @Test("Elevation gain ignores jitter below the threshold and counts real climbs")
    func elevationGainHasHysteresis() {
        func track(_ elevations: [Double?]) -> [TrackPoint] {
            elevations.map { TrackPoint(latitude: 0, longitude: 0, elevation: $0) }
        }
        // ±1 m GPS noise on flat ground adds nothing.
        #expect(TrackMath.elevationGain(track([100, 101, 100, 101, 100, 101])) == 0)
        // Climb 50, drop 20, climb 30: 80 m up.
        #expect(TrackMath.elevationGain(track([100, 150, 130, 160])) == 80)
        // A file with no elevations has no figure rather than zero.
        #expect(TrackMath.elevationGain(track([nil, nil])) == nil)
    }

    @Test("Simplifying drops points on a straight line and keeps the ends")
    func simplifyKeepsShape() {
        let straight = (0...100).map { TrackPoint(latitude: Double($0) * 0.0001, longitude: 0, elevation: nil) }
        let simplified = TrackMath.simplify(straight)
        #expect(simplified == [straight[0], straight[100]])

        let zigzag = (0...1000).map {
            TrackPoint(latitude: Double($0) * 0.0001, longitude: $0.isMultiple(of: 2) ? 0 : 0.001, elevation: nil)
        }
        #expect(TrackMath.simplify(zigzag, maxPoints: 100).count <= 100)
    }

    // MARK: - Polyline

    @Test("Encoding matches Google's reference polyline and decodes back")
    func polylineRoundTrips() {
        let coordinates = [
            CLLocationCoordinate2D(latitude: 38.5, longitude: -120.2),
            CLLocationCoordinate2D(latitude: 40.7, longitude: -120.95),
            CLLocationCoordinate2D(latitude: 43.252, longitude: -126.453),
        ]
        let encoded = Polyline.encode(coordinates)
        #expect(encoded == "_p~iF~ps|U_ulLnnqC_mqNvxq`@")
        let decoded = Polyline.decode(encoded)
        #expect(decoded.map(\.latitude) == [38.5, 40.7, 43.252])
        #expect(decoded.map(\.longitude) == [-120.2, -120.95, -126.453])
    }

    @Test("A truncated polyline decodes to nothing rather than a partial line")
    func truncatedPolylineIsEmpty() {
        #expect(Polyline.decode("_p~iF~ps|U_ulL").isEmpty)
    }

    @Test("A track summary carries distance, climbing and an encoded route")
    func trackSummary() throws {
        let points = [
            TrackPoint(latitude: 0, longitude: 0, elevation: 100),
            TrackPoint(latitude: 0.01, longitude: 0, elevation: 140),
        ]
        let summary = try #require(TrackSummary(points: points))
        #expect(abs(summary.distanceMeters - 1_112) < 1)
        #expect(summary.elevationGainMeters == 40)
        #expect(Polyline.decode(summary.route).count == 2)
        #expect(TrackSummary(points: [points[0]]) == nil)
    }

    // MARK: - Decoding

    @Test("An activity the app doesn't know is dropped, not a failed trip")
    func unknownActivityIsDropped() throws {
        let json = #"{"activities":["hiking","paragliding"],"distanceMeters":1200}"#
        let log = try JSONDecoder().decode(TripLog.self, from: Data(json.utf8))
        #expect(log.activities == [.hiking])
        #expect(log.distanceMeters == 1200)
    }

    // MARK: - Stats

    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }

    private func trip(_ id: String, day: Int, nights: Int = 1, log: TripLog? = nil, excluded: Bool = false) -> Trip {
        let start = calendar.date(from: DateComponents(year: 2026, month: 3, day: day, hour: 12))!
        let end = calendar.date(byAdding: .day, value: nights, to: start)!
        return Trip(
            id: id, name: "Trip \(id)", description: nil, notes: nil, location: nil,
            startDate: start.iso8601String(), endDate: end.iso8601String(),
            userId: nil, packId: nil, deleted: false, createdAt: nil, updatedAt: nil,
            log: log, excludedFromStats: excluded
        )
    }

    private var now: Date { calendar.date(from: DateComponents(year: 2026, month: 6, day: 1))! }

    @Test("Distance and climbing total only the trips that logged them")
    func totalsCountLoggedTripsOnly() {
        let stats = TripStats(trips: [
            trip("a", day: 1, log: TripLog(activities: [.hiking], distanceMeters: 10_000, elevationGainMeters: 500)),
            trip("b", day: 5, log: TripLog(activities: [.hiking], distanceMeters: 30_000)),
            trip("c", day: 9),
        ], packs: [], now: now, calendar: calendar)

        #expect(stats.totals.trips == 3)
        #expect(stats.totals.distance == 40_000)
        #expect(stats.totals.elevationGain == 500)
        #expect(stats.averageDistance == 20_000)
        #expect(stats.longestByDistance?.id == "b")
    }

    @Test("With no logged distance the figures are absent, not zero")
    func noLogsMeansNoDistance() {
        let stats = TripStats(trips: [trip("a", day: 1)], packs: [], now: now, calendar: calendar)
        #expect(stats.totals.distance == nil)
        #expect(stats.totals.elevationGain == nil)
        #expect(stats.averageDistance == nil)
        #expect(stats.longestByDistance == nil)
        #expect(stats.activities.isEmpty)
    }

    @Test("A trip with two activities counts in both, busiest activity first")
    func activitiesBucketPerActivity() {
        let stats = TripStats(trips: [
            trip("a", day: 1, nights: 2, log: TripLog(activities: [.hiking, .camping], distanceMeters: 8_000)),
            trip("b", day: 10, nights: 0, log: TripLog(activities: [.hiking], distanceMeters: 5_000)),
        ], packs: [], now: now, calendar: calendar)

        #expect(stats.activities.map(\.activity) == [.hiking, .camping])
        #expect(stats.activities.first == TripStats.ActivityBucket(activity: .hiking, trips: 2, nights: 2, distance: 13_000))
    }

    @Test("A trip left out of stats counts toward nothing")
    func excludedTripsDontCount() {
        let stats = TripStats(trips: [
            trip("a", day: 1, log: TripLog(activities: [.hiking], distanceMeters: 10_000)),
            trip("b", day: 5, log: TripLog(activities: [.paddling], distanceMeters: 99_000), excluded: true),
        ], packs: [], now: now, calendar: calendar)

        #expect(stats.totals.trips == 1)
        #expect(stats.totals.distance == 10_000)
        #expect(stats.activities.map(\.activity) == [.hiking])
    }

    @Test("Logged routes are decoded for the map")
    func routesAreDecoded() {
        let route = Polyline.encode([
            CLLocationCoordinate2D(latitude: 46.8, longitude: -121.7),
            CLLocationCoordinate2D(latitude: 46.9, longitude: -121.8),
        ])
        let stats = TripStats(trips: [
            trip("a", day: 1, log: TripLog(route: route)),
            trip("b", day: 5, log: TripLog(route: "garbage~")),
        ], packs: [], now: now, calendar: calendar)
        #expect(stats.routes.map(\.id) == ["a"])
        #expect(stats.routes.first?.coordinates.count == 2)
    }

    // MARK: - Request encoding

    @Test("An update always sends the log, as null when cleared")
    func updateEncodesClearedLog() throws {
        let request = UpdateTripRequest(
            name: "Trip", description: nil, location: nil, startDate: nil, endDate: nil,
            notes: nil, packId: nil, log: nil, excludedFromStats: true,
            localUpdatedAt: "2026-01-01T00:00:00Z"
        )
        let object = try JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? [String: Any]
        #expect(object?["log"] is NSNull)
        #expect(object?["excludedFromStats"] as? Bool == true)
    }
}
