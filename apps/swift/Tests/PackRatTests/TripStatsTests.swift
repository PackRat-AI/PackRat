import Foundation
import Testing
@testable import PackRat

/// Covers #1859 slice (a): the record finished trips add up to, from dates,
/// locations and linked packs alone.
@Suite("Trip stats")
struct TripStatsTests {

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
        _ start: Date?,
        _ end: Date?,
        lat: Double? = nil,
        lng: Double = 0,
        packId: String? = nil,
        deleted: Bool = false
    ) -> Trip {
        Trip(
            id: id, name: "Trip \(id)", description: nil, notes: nil,
            location: lat.map { TripLocation(latitude: $0, longitude: lng, name: nil) },
            startDate: start?.iso8601String(), endDate: end?.iso8601String(),
            userId: nil, packId: packId, deleted: deleted, createdAt: nil, updatedAt: nil
        )
    }

    private func item(_ id: String, _ name: String, catalogId: Int? = nil) -> PackItem {
        PackItem(
            id: id, packId: nil, name: name, description: nil, weight: 100, weightUnit: .g,
            quantity: 1, category: nil, consumable: false, worn: false, image: nil, notes: nil,
            catalogItemId: catalogId, userId: nil, deleted: false, isAIGenerated: nil,
            templateItemId: nil, createdAt: nil, updatedAt: nil
        )
    }

    private func pack(_ id: String, items: [PackItem], baseWeight: Double? = nil) -> Pack {
        Pack(
            id: id, userId: nil, name: "Pack \(id)", description: nil, category: nil, isPublic: false,
            image: nil, tags: nil, templateId: nil, deleted: false, isAIGenerated: nil, items: items,
            totalWeight: nil, baseWeight: baseWeight, wornWeight: nil, consumableWeight: nil,
            createdAt: nil, updatedAt: nil
        )
    }

    private let now = Calendar(identifier: .gregorian).date(from: DateComponents(
        timeZone: TimeZone(identifier: "UTC"), year: 2026, month: 10, day: 5, hour: 12
    ))!

    private func stats(_ trips: [Trip], packs: [Pack] = []) -> TripStats {
        TripStats(trips: trips, packs: packs, now: now, calendar: calendar)
    }

    @Test("planned, undated and deleted trips count toward nothing")
    func onlyFinishedTripsCount() {
        let s = stats([
            trip("done", day(2026, 9, 1), day(2026, 9, 3)),
            trip("future", day(2026, 11, 1), day(2026, 11, 3)),
            trip("ongoing", day(2026, 10, 4), day(2026, 10, 6)),
            trip("undated", nil, nil),
            trip("gone", day(2026, 8, 1), day(2026, 8, 2), deleted: true),
        ])
        #expect(s.finished.map(\.id) == ["done"])
        #expect(!s.isEmpty)
        #expect(stats([trip("future", day(2026, 11, 1), day(2026, 11, 3))]).isEmpty)
    }

    @Test("nights are between start and end; a day trip adds a trip and no nights")
    func nights() {
        let s = stats([
            trip("a", day(2026, 9, 1), day(2026, 9, 4)),
            trip("b", day(2026, 9, 10), day(2026, 9, 10)),
        ])
        #expect(s.totals.trips == 2)
        #expect(s.totals.nights == 3)
        #expect(s.averageNights == 1.5)
        #expect(s.longestByNights?.id == "a")
    }

    @Test("overlapping trips count shared days once")
    func daysOutdoorsDeduplicates() {
        let s = stats([
            trip("a", day(2026, 9, 1), day(2026, 9, 3)),
            trip("b", day(2026, 9, 3), day(2026, 9, 5)),
        ])
        #expect(s.totals.days == 5)
    }

    @Test("the same spot twice is one place; a trip without a location is none")
    func places() {
        let s = stats([
            trip("a", day(2026, 9, 1), day(2026, 9, 2), lat: 37.7451, lng: -119.5936),
            trip("b", day(2026, 9, 5), day(2026, 9, 6), lat: 37.7449, lng: -119.5938),
            trip("c", day(2026, 9, 8), day(2026, 9, 9), lat: 36.1, lng: -112.1),
            trip("d", day(2026, 9, 10), day(2026, 9, 11)),
        ])
        #expect(s.totals.places == 2)
    }

    @Test("this year is compared with the same 1 January → today stretch of last year")
    func yearToDate() {
        let s = stats([
            trip("this", day(2026, 3, 1), day(2026, 3, 3)),
            trip("lastEarly", day(2025, 6, 1), day(2025, 6, 2)),
            // After 5 Oct last year: outside the comparison window.
            trip("lastLate", day(2025, 12, 1), day(2025, 12, 5)),
        ])
        #expect(s.thisYear == TripStats.Totals(trips: 1, nights: 2, days: 3, places: 0))
        #expect(s.lastYearToDate == TripStats.Totals(trips: 1, nights: 1, days: 2, places: 0))
    }

    @Test("a first-year user has no comparison")
    func firstYear() {
        let s = stats([trip("a", day(2026, 3, 1), day(2026, 3, 3))])
        #expect(s.lastYearToDate == nil)
    }

    @Test("twelve monthly buckets ending this month, empty ones included")
    func months() {
        let s = stats([
            trip("a", day(2026, 9, 1), day(2026, 9, 4)),
            trip("old", day(2025, 1, 1), day(2025, 1, 2)),
        ])
        #expect(s.months.count == 12)
        #expect(calendar.component(.month, from: s.months.last!.month) == 10)
        #expect(calendar.component(.month, from: s.months.first!.month) == 11)
        let september = s.months.first { calendar.component(.month, from: $0.month) == 9 }
        #expect(september?.nights == 3)
        #expect(s.months.reduce(0) { $0 + $1.trips } == 1)
    }

    @Test("busiest month and season, with seasons flipped south of the equator")
    func busiest() {
        let s = stats([
            trip("north", day(2025, 7, 1), day(2025, 7, 3), lat: 45),
            trip("patagonia", day(2025, 12, 1), day(2025, 12, 6), lat: -50),
        ])
        #expect(s.busiestMonth == 12)
        #expect(s.busiestSeason == .summer)
        #expect(TripStats.Season.of(month: 12, latitude: -50) == .summer)
        #expect(TripStats.Season.of(month: 12, latitude: 40) == .winter)
        #expect(TripStats.Season.of(month: 4, latitude: nil) == .spring)
    }

    @Test("gear counts once per trip, merges catalog items, and ranks by trips")
    func topGear() {
        let tent = item("1", "Tent", catalogId: 7)
        let tentCopy = item("2", "My tent", catalogId: 7)
        let stove = item("3", "Stove")
        let s = stats(
            [
                trip("a", day(2026, 9, 1), day(2026, 9, 2), packId: "p1"),
                trip("b", day(2026, 9, 5), day(2026, 9, 6), packId: "p2"),
                trip("c", day(2026, 9, 8), day(2026, 9, 9)),
            ],
            packs: [
                pack("p1", items: [tent, tentCopy, stove], baseWeight: 5_000),
                pack("p2", items: [item("4", "My tent", catalogId: 7)], baseWeight: 4_000),
            ]
        )
        #expect(s.topGear.map(\.trips) == [2, 1])
        #expect(s.topGear.first?.id == "catalog:7")
        #expect(s.topGear.last?.name == "Stove")
        #expect(s.packWeights.map(\.grams) == [5_000, 4_000])
    }

    // MARK: - Scope

    private func logged(_ trip: Trip, _ activities: [TripActivity]) -> Trip {
        var trip = trip
        trip.log = TripLog(activities: activities, distanceMeters: 1_000)
        return trip
    }

    private var scopeTrips: [Trip] {
        [
            logged(trip("a", day(2024, 7, 1), day(2024, 7, 3)), [.hiking]),
            logged(trip("b", day(2025, 3, 1), day(2025, 3, 2)), [.skiing]),
            logged(trip("c", day(2025, 8, 1), day(2025, 8, 4)), [.hiking, .camping]),
            trip("d", day(2026, 2, 1), day(2026, 2, 2)),
        ]
    }

    @Test("A year scope keeps that year's trips and charts its January to December")
    func yearScope() {
        let s = TripStats(trips: scopeTrips, packs: [], scope: .init(year: 2025), now: now, calendar: calendar)
        #expect(s.finished.map(\.id) == ["b", "c"])
        #expect(s.totals.nights == 1 + 3)
        #expect(s.months.count == 12)
        #expect(s.months.first?.month == calendar.date(from: DateComponents(year: 2025, month: 1, day: 1)))
        #expect(s.months.map(\.trips).reduce(0, +) == 2)
    }

    @Test("An activity scope keeps only trips logged with it, across years")
    func activityScope() {
        let s = TripStats(trips: scopeTrips, packs: [], scope: .init(activity: .hiking), now: now, calendar: calendar)
        #expect(s.finished.map(\.id) == ["a", "c"])
        let both = TripStats(trips: scopeTrips, packs: [], scope: .init(year: 2025, activity: .hiking), now: now, calendar: calendar)
        #expect(both.finished.map(\.id) == ["c"])
    }

    @Test("Menus list every year and logged activity whatever the scope")
    func scopeOptionsIgnoreScope() {
        let s = TripStats(trips: scopeTrips, packs: [], scope: .init(year: 2024), now: now, calendar: calendar)
        #expect(s.availableYears == [2026, 2025, 2024])
        #expect(s.availableActivities == [.hiking, .camping, .skiing])
        #expect(s.hasTrips)
    }

    @Test("A scope nothing matches is empty, but the record still has trips")
    func emptyScope() {
        let s = TripStats(trips: scopeTrips, packs: [], scope: .init(year: 2026, activity: .skiing), now: now, calendar: calendar)
        #expect(s.isEmpty)
        #expect(s.hasTrips)
    }

    @Test("Scope titles read naturally")
    func scopeTitles() {
        #expect(TripStatsScopeBar.title(.all) == "All Time")
        #expect(TripStatsScopeBar.title(.init(year: 2025)) == "2025")
        #expect(TripStatsScopeBar.title(.init(activity: .hiking)) == "Hiking")
        #expect(TripStatsScopeBar.title(.init(year: 2025, activity: .hiking)) == "Hiking in 2025")
    }
}
