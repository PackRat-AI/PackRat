import CoreLocation
import Foundation
import Testing
@testable import PackRat

/// Covers #1859 Landscapes: the bundled grid, the log signals that sharpen
/// it, the user's override, and the breakdown.
@Suite("Trip landscapes")
struct TripLandscapesTests {

    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }

    private func day(_ y: Int, _ m: Int, _ d: Int) -> Date {
        calendar.date(from: DateComponents(year: y, month: m, day: d, hour: 12))!
    }

    private func trip(_ id: String, at point: (Double, Double)?, log: TripLog? = nil, start: Date? = nil) -> Trip {
        let start = start ?? day(2026, 6, 1)
        return Trip(
            id: id, name: "Trip \(id)", description: nil, notes: nil,
            location: point.map { TripLocation(latitude: $0.0, longitude: $0.1, name: nil) },
            startDate: start.iso8601String(), endDate: start.iso8601String(),
            userId: nil, packId: nil, deleted: false, createdAt: nil, updatedAt: nil,
            log: log
        )
    }

    private func at(_ lat: Double, _ lon: Double) -> TripLandscape? {
        LandscapeGrid.shared.landscape(at: CLLocationCoordinate2D(latitude: lat, longitude: lon))
    }

    @Test func bundledGridReadsKnownPlaces() {
        #expect(!LandscapeGrid.shared.isEmpty)
        #expect(at(46.85, -121.76) == .mountain)   // Mount Rainier
        #expect(at(33.87, -115.9) == .desert)      // Joshua Tree
        #expect(at(36.27, -121.8) == .coastal)     // Big Sur
        #expect(at(39.1, -120.03) == .water)       // Lake Tahoe
        #expect(at(38.5, -99) == .grassland)       // Kansas, Great Plains
        #expect(at(35.6, -83.5) == .mountain)      // Great Smoky Mountains
        #expect(at(64.8, -18.5) == .polar)         // Iceland's interior
        #expect(at(63.07, -151.0) == .mountain)    // Denali
        #expect(at(38.57, -109.55) == .desert)     // Moab
    }

    @Test func openSeaIsNothingButJustOffshoreIsCoastal() {
        #expect(at(30, -140) == nil)               // mid-Pacific
        #expect(at(47.905, -124.66) == .coastal)   // off La Push
    }

    @Test func gridWrapsAcrossTheDateLine() {
        let grid = LandscapeGrid.shared
        #expect(grid.code(row: 100, column: -1) == grid.code(row: 100, column: LandscapeGrid.width - 1))
        #expect(grid.code(row: -5, column: 0) == 0)
    }

    @Test func truncatedFileReadsAsEmpty() {
        #expect(LandscapeGrid.decode(Data([1, 0])).isEmpty)
    }

    @Test func summitsAndSteepClimbingMakeOpenCountryMountain() {
        // Hoh-side lowland forest near Forks, WA.
        let base = (47.95, -124.38)
        #expect(TripLandscapes.landscape(of: trip("a", at: base)) == at(base.0, base.1))
        let summit = TripSummit(name: "Peak", elevationMeters: 1_500, latitude: base.0, longitude: base.1, osmId: nil)
        if at(base.0, base.1) == .forest {
            #expect(TripLandscapes.landscape(of: trip("b", at: base, log: TripLog(summits: [summit]))) == .mountain)
        }
        #expect(TripLandscapes.isMountainous(TripLog(distanceMeters: 10_000, elevationGainMeters: 800)))
        #expect(!TripLandscapes.isMountainous(TripLog(distanceMeters: 40_000, elevationGainMeters: 800)))
        #expect(!TripLandscapes.isMountainous(TripLog(distanceMeters: 5_000, elevationGainMeters: 300)))
        #expect(TripLandscapes.isMountainous(TripLog(activities: [.skiing])))
    }

    @Test func paddlingInlandIsLakesAndRiversButNotOnTheCoast() {
        let kansas = (38.5, -99.0)
        #expect(TripLandscapes.landscape(of: trip("a", at: kansas, log: TripLog(activities: [.paddling]))) == .water)
        let bigSur = (36.27, -121.8)
        #expect(TripLandscapes.landscape(of: trip("b", at: bigSur, log: TripLog(activities: [.paddling]))) == .coastal)
    }

    @Test func theUsersChoiceWins() {
        let log = TripLog(summits: [], landscape: .forest)
        #expect(TripLandscapes.landscape(of: trip("a", at: (33.87, -115.9), log: log)) == .forest)
        #expect(TripLandscapes.landscape(of: trip("b", at: nil, log: log)) == .forest)
        #expect(!log.isEmpty)
    }

    @Test func aTripWithoutLocationUsesItsRouteMiddle() {
        let route = [(33.8, -116.0), (33.87, -115.9), (33.9, -115.8)]
            .map { CLLocationCoordinate2D(latitude: $0.0, longitude: $0.1) }
        let log = TripLog(route: Polyline.encode(route))
        #expect(TripLandscapes.landscape(of: trip("a", at: nil, log: log)) == .desert)
        #expect(TripLandscapes.landscape(of: trip("b", at: nil)) == nil)
    }

    @Test func breakdownCountsMostFirstThenSpecOrder() {
        let trips = [
            trip("a", at: (33.87, -115.9), start: day(2026, 3, 1)),
            trip("b", at: (36.5, -117.0), start: day(2026, 5, 1)),
            trip("c", at: (46.85, -121.76)),
            trip("d", at: (36.27, -121.8)),
            trip("e", at: nil),
        ]
        let finished = TripStats(trips: trips, packs: [], now: day(2026, 10, 1), calendar: calendar).finished
        let landscapes = TripLandscapes(finished: finished)
        #expect(landscapes.buckets.map(\.landscape) == [.desert, .mountain, .coastal])
        #expect(landscapes.buckets.first?.trips.map(\.id) == ["b", "a"])
    }

    @Test func landscapeRoundTripsThroughTheLog() throws {
        let data = try JSONEncoder().encode(TripLog(landscape: .polar))
        #expect(try JSONDecoder().decode(TripLog.self, from: data).landscape == .polar)
        let unknown = Data(#"{"activities":[],"landscape":"swamp"}"#.utf8)
        #expect(try JSONDecoder().decode(TripLog.self, from: unknown).landscape == nil)
    }
}
