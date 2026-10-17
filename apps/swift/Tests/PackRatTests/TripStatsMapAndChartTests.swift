import Accessibility
import CoreLocation
import Foundation
import MapKit
import Testing
@testable import PackRat

/// Covers #1859 polish: pin clustering on the Trip Stats map, the Audio Graph
/// descriptors behind its charts, a route drawn by hand and the one-way /
/// out-and-back choice for a trail-filled log.
@Suite("Trip Stats map, charts and hand-drawn routes")
struct TripStatsMapAndChartTests {

    private func point(_ id: String, _ lat: Double, _ lon: Double) -> (id: String, coordinate: CLLocationCoordinate2D) {
        (id, CLLocationCoordinate2D(latitude: lat, longitude: lon))
    }

    @Test func withoutASpanEveryPinStandsAlone() {
        let clusters = MapClusters.cluster([point("a", 47, -121), point("b", 47, -121)], span: nil)
        #expect(clusters.map(\.members) == [["a"], ["b"]])
    }

    @Test func nearbyPinsMergeWhenZoomedOut() {
        let points = [point("a", 47.01, -121.01), point("b", 47.02, -121.02), point("c", 40.5, -111.5)]
        let clusters = MapClusters.cluster(points, span: MKCoordinateSpan(latitudeDelta: 20, longitudeDelta: 20))
        #expect(clusters.count == 2)
        let merged = clusters.first { !$0.isSingle }
        #expect(merged?.members == ["a", "b"])
        #expect(merged?.id.hasPrefix("cluster:") == true)
        #expect(abs((merged?.coordinate.latitude ?? 0) - 47.015) < 0.0001)
        #expect(clusters.first { $0.isSingle }?.id == "c")
    }

    @Test func nearbyPinsSplitWhenZoomedIn() {
        let points = [point("a", 47.01, -121.01), point("b", 47.2, -121.3)]
        let clusters = MapClusters.cluster(points, span: MKCoordinateSpan(latitudeDelta: 0.5, longitudeDelta: 0.5))
        #expect(clusters.allSatisfy { $0.isSingle })
    }

    @Test func clusterRegionFramesItsPinsWithAFloor() {
        let region = MapClusters.region(framing: [
            CLLocationCoordinate2D(latitude: 46, longitude: -122),
            CLLocationCoordinate2D(latitude: 48, longitude: -120),
        ])
        #expect(region?.center.latitude == 47)
        #expect(abs((region?.span.latitudeDelta ?? 0) - 3.2) < 0.0001)
        let same = MapClusters.region(framing: Array(repeating: CLLocationCoordinate2D(latitude: 47, longitude: -121), count: 2))
        #expect(same?.span.latitudeDelta == 0.02)
        #expect(MapClusters.region(framing: []) == nil)
    }

    @Test func monthlyDescriptorSummarisesTotalAndPeak() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let months = (1...3).map { month in
            TripStats.MonthBucket(
                month: calendar.date(from: DateComponents(year: 2026, month: month, day: 1))!,
                trips: month,
                nights: month == 2 ? 6 : 1
            )
        }
        let descriptor = TripStatsChartDescriptors.monthly(months, metric: "Nights", title: "Last 12 Months")
        #expect(descriptor.title == "Last 12 Months")
        #expect(descriptor.summary?.hasPrefix("8 nights in the last 3 months. Most in Feb") == true)
        #expect(descriptor.series.first?.dataPoints.count == 3)
    }

    @Test func activitiesDescriptorNamesTheLeader() {
        let descriptor = TripStatsChartDescriptors.activities([
            TripStats.ActivityBucket(activity: .backpacking, trips: 4),
            TripStats.ActivityBucket(activity: .hiking, trips: 1),
        ])
        #expect(descriptor.summary == "2 activities across your logged trips. Backpacking leads with 4 trips.")
        #expect(descriptor.series.first?.dataPoints.count == 2)
    }

    @Test func drawnRouteMeasuresItsLegs() {
        // 0.01° of latitude is about 1.11 km.
        let points = [(47.0, -121.0), (47.01, -121.0), (47.02, -121.0)]
            .map { CLLocationCoordinate2D(latitude: $0.0, longitude: $0.1) }
        #expect(abs(RouteDrawing.distance(points) - 2_224) < 5)
        #expect(RouteDrawing.distance(Array(points.prefix(1))) == 0)
    }

    @Test func outAndBackRetracesTheLine() {
        let points = [(47.0, -121.0), (47.01, -121.0), (47.02, -121.0)]
            .map { CLLocationCoordinate2D(latitude: $0.0, longitude: $0.1) }
        let both = RouteDrawing.outAndBack(points)
        #expect(both.map(\.latitude) == [47.0, 47.01, 47.02, 47.01, 47.0])
        #expect(abs(RouteDrawing.distance(both) - 2 * RouteDrawing.distance(points)) < 0.01)
        #expect(RouteDrawing.outAndBack(Array(points.prefix(1))).count == 1)
    }

    @Test func drawingFramesTheTripSpotWhenThereIsNoLine() {
        let spot = CLLocationCoordinate2D(latitude: 46.85, longitude: -121.76)
        let region = RouteDrawing.region(points: [], center: spot)
        #expect(region?.center.latitude == 46.85)
        #expect(RouteDrawing.region(points: [], center: nil) == nil)
    }

    @Test func headroomFramesPinsLowerWithRoomAbove() {
        let pins = [
            CLLocationCoordinate2D(latitude: 36, longitude: -122),
            CLLocationCoordinate2D(latitude: 48, longitude: -83),
        ]
        let region = MapClusters.region(framing: pins, headroom: true)
        let delta = region?.span.latitudeDelta ?? 0
        #expect(abs(delta - 12 * 1.9) < 0.0001)
        // The northern pin sits below the top edge by more than a fifth of the view.
        let top = (region?.center.latitude ?? 0) + delta / 2
        #expect(top - 48 > delta * 0.2)
        #expect((region?.center.latitude ?? 0) - delta / 2 < 36)
    }

    @Test func trailSuggestionsOfferOneWayAndThereAndBack() {
        let trails = [
            TripTrail(id: "a", name: "Mist Trail", lengthMeters: 2_400),
            TripTrail(id: "b", name: "Half Dome Trail", lengthMeters: 3_200),
            TripTrail(id: "c", name: "Unmeasured", lengthMeters: nil),
        ]
        let options = TripLogEditor.trailDistances(TripLogEditor.totalLength(trails))
        #expect(options.map(\.meters) == [5_600, 11_200])
    }
}
