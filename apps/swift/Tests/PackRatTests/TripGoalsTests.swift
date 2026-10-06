import Foundation
import Testing
@testable import PackRat

/// Covers #1859 slice (c): goal progress and pace, the comeback card, and the
/// wire shapes for goals and settings.
@Suite("Trip goals and comeback")
struct TripGoalsTests {

    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }

    private func day(_ y: Int, _ m: Int, _ d: Int) -> Date {
        calendar.date(from: DateComponents(year: y, month: m, day: d, hour: 12))!
    }

    /// 5 October 2026: day 278 of 365.
    private var now: Date { day(2026, 10, 5) }

    private func trip(_ id: String, _ start: Date, _ end: Date, km: Double? = nil) -> Trip {
        Trip(
            id: id, name: "Trip \(id)", description: nil, notes: nil, location: nil,
            startDate: start.iso8601String(), endDate: end.iso8601String(),
            userId: nil, packId: nil, deleted: false, createdAt: nil, updatedAt: nil,
            log: km.map { TripLog(activities: [.hiking], distanceMeters: $0 * 1_000) }
        )
    }

    private func finished(_ trips: [Trip]) -> [TripStats.FinishedTrip] {
        TripStats(trips: trips, packs: [], now: now, calendar: calendar).finished
    }

    private func annual(_ metric: TripGoal.Metric, _ target: Double, year: Int = 2026) -> TripGoal {
        TripGoal(id: "g", kind: .annual, metric: metric, target: target, year: year)
    }

    private func progress(_ goal: TripGoal, _ trips: [Trip]) -> TripGoalProgress? {
        TripGoalProgress(goal: goal, finished: finished(trips), now: now, calendar: calendar)
    }

    private var yearOfTrips: [Trip] {
        [
            // Starts last year: counts toward last year's goals, not this one.
            trip("a", day(2025, 12, 30), day(2026, 1, 2), km: 30),
            trip("b", day(2026, 2, 1), day(2026, 2, 5), km: 40),
            trip("c", day(2026, 7, 1), day(2026, 7, 4)),
        ]
    }

    // MARK: - Progress and pace

    @Test("An annual goal counts only trips that start in its year")
    func annualGoalCountsItsYear() throws {
        let result = try #require(progress(annual(.nights, 20), yearOfTrips))
        #expect(result.value == 7)
        #expect(result.phase == .active)
        #expect(abs(result.elapsed - 278.0 / 365.0) < 0.0001)
    }

    @Test("Behind an even pace by the rounded shortfall")
    func behindPace() throws {
        // 20 × 278/365 = 15.2 expected, 7 done.
        let result = try #require(progress(annual(.nights, 20), yearOfTrips))
        #expect(result.pace == .behind(8))
        #expect(result.remaining == 13)
        #expect(!result.isComplete)
    }

    @Test("Ahead of an even pace")
    func aheadOfPace() throws {
        // 8 × 278/365 = 6.1 expected, 7 done.
        let result = try #require(progress(annual(.nights, 8), yearOfTrips))
        #expect(result.pace == .ahead(1))
    }

    @Test("Within half a unit reads as on pace")
    func onPace() throws {
        // 9 × 278/365 = 6.85 expected, 7 done.
        let result = try #require(progress(annual(.nights, 9), yearOfTrips))
        #expect(result.pace == .onPace)
    }

    @Test("A met goal is complete and has no pace")
    func completeGoal() throws {
        let result = try #require(progress(annual(.trips, 2), yearOfTrips))
        #expect(result.isComplete)
        #expect(result.pace == nil)
        #expect(result.fraction == 1)
    }

    @Test("A distance goal sums logged distance in metres")
    func distanceGoal() throws {
        let result = try #require(progress(annual(.distance, 100_000), yearOfTrips))
        #expect(result.value == 40_000)
        // 100 km × 278/365 = 76.2 km expected.
        guard case .behind(let by) = result.pace else {
            Issue.record("expected behind, got \(String(describing: result.pace))")
            return
        }
        #expect(abs(by - (100_000 * 278.0 / 365.0 - 40_000)) < 0.01)
    }

    @Test("Last year's annual goal has ended")
    func pastYear() throws {
        let result = try #require(progress(annual(.nights, 2, year: 2025), yearOfTrips))
        #expect(result.phase == .ended)
        // Dec 30 → Dec 31, clipped at the window's last day.
        #expect(result.value == 1)
        #expect(result.isComplete == false)
        #expect(result.pace == nil)
    }

    @Test("A custom goal runs its own days and clips trips at its end")
    func customWindow() throws {
        let goal = TripGoal(
            id: "c", kind: .custom, metric: .nights, target: 10, name: "Before the baby",
            startDate: "2026-02-03T00:00:00.000Z", endDate: "2026-07-02T00:00:00.000Z"
        )
        let result = try #require(progress(goal, yearOfTrips))
        // b starts before the window; c starts inside and is clipped to 1 night.
        #expect(result.value == 1)
        #expect(result.phase == .ended)
        #expect(goal.title == "Before the baby")
    }

    @Test("A custom goal that hasn't opened is upcoming")
    func upcomingGoal() throws {
        let goal = TripGoal(
            id: "u", kind: .custom, metric: .trips, target: 2,
            startDate: "2026-11-01T00:00:00.000Z", endDate: "2026-12-01T00:00:00.000Z"
        )
        let result = try #require(progress(goal, yearOfTrips))
        #expect(result.phase == .upcoming)
        #expect(result.elapsed == 0)
        #expect(result.pace == nil)
        #expect(goal.title == "Trips")
    }

    @Test("A goal with no usable window has no progress")
    func invalidWindow() {
        let backwards = TripGoal(
            id: "x", kind: .custom, metric: .trips, target: 2,
            startDate: "2026-12-01T00:00:00.000Z", endDate: "2026-11-01T00:00:00.000Z"
        )
        let noYear = TripGoal(id: "y", kind: .annual, metric: .trips, target: 2)
        #expect(progress(backwards, yearOfTrips) == nil)
        #expect(progress(noYear, yearOfTrips) == nil)
    }

    @Test("A goal day survives a change of time zone")
    func dayRoundTrip() throws {
        var tokyo = Calendar(identifier: .gregorian)
        tokyo.timeZone = TimeZone(identifier: "Asia/Tokyo")!
        var losAngeles = Calendar(identifier: .gregorian)
        losAngeles.timeZone = TimeZone(identifier: "America/Los_Angeles")!

        let firstOfMarch = try #require(tokyo.date(from: DateComponents(year: 2026, month: 3, day: 1, hour: 1)))
        let wire = TripGoal.dayString(from: firstOfMarch, calendar: tokyo)
        #expect(wire == "2026-03-01T00:00:00.000Z")
        let back = try #require(TripGoal.day(from: wire, calendar: losAngeles))
        let parts = losAngeles.dateComponents([.year, .month, .day], from: back)
        #expect(parts.year == 2026 && parts.month == 3 && parts.day == 1)
    }

    @Test("Counts and measures format in the user's unit")
    func formatting() {
        #expect(TripGoal.Metric.nights.format(1, unit: .metric) == "1 night")
        #expect(TripGoal.Metric.trips.format(12, unit: .metric) == "12 trips")
        #expect(TripGoal.Metric.distance.format(16_093.44, unit: .imperial) == "10.0 mi")
    }

    // MARK: - Comeback

    private var breakHistory: [Trip] {
        [
            trip("old1", day(2025, 1, 10), day(2025, 1, 12), km: 20),
            trip("old2", day(2025, 3, 1), day(2025, 3, 4), km: 30),
            trip("old3", day(2025, 6, 1), day(2025, 6, 3)),
        ]
    }

    @Test("A trip after three months or more without one is a comeback")
    func comebackFound() throws {
        let trips = breakHistory + [trip("back", day(2026, 9, 20), day(2026, 9, 22), km: 12)]
        let comeback = try #require(TripStats(trips: trips, packs: [], now: now, calendar: calendar).comeback)
        #expect(comeback.trip.id == "back")
        #expect(comeback.monthsAway == 15)
        #expect(comeback.daysBack == 15)
        // A fortnight back divides by a whole month.
        #expect(comeback.now.trips == 1)
        #expect(comeback.now.nights == 2)
        #expect(comeback.now.distance == 12_000)
        // Three trips and seven nights in the year before the break.
        #expect(comeback.before.trips == 3.0 / 12.0)
        #expect(comeback.before.nights == 7.0 / 12.0)
        #expect(comeback.before.distance == 50_000.0 / 12.0)
    }

    @Test("A break under three months isn't a comeback")
    func shortBreak() {
        let trips = [
            trip("a", day(2026, 6, 1), day(2026, 6, 3)),
            trip("b", day(2026, 8, 20), day(2026, 8, 22)),
        ]
        #expect(TripStats(trips: trips, packs: [], now: now, calendar: calendar).comeback == nil)
    }

    @Test("Overlapping trips start the break at the latest end")
    func overlappingTrips() {
        let trips = [
            trip("long", day(2026, 1, 1), day(2026, 5, 1)),
            trip("inside", day(2026, 2, 1), day(2026, 2, 3)),
            // Three months after "inside", but under one after "long".
            trip("next", day(2026, 5, 20), day(2026, 5, 21)),
        ]
        #expect(TripStats(trips: trips, packs: [], now: day(2026, 6, 1), calendar: calendar).comeback == nil)
    }

    @Test("The comeback card retires after six months")
    func comebackRetires() {
        let trips = breakHistory + [trip("back", day(2026, 3, 1), day(2026, 3, 2))]
        #expect(TripStats(trips: trips, packs: [], now: now, calendar: calendar).comeback == nil)
    }

    @Test("Back to the old pace after a month retires the card")
    func backToPace() {
        let trips = breakHistory + [
            trip("back", day(2026, 8, 1), day(2026, 8, 3)),
            trip("again", day(2026, 9, 1), day(2026, 9, 4)),
        ]
        #expect(TripStats(trips: trips, packs: [], now: now, calendar: calendar).comeback == nil)
    }

    @Test("Within the first month the card stays whatever the pace")
    func firstMonthStays() {
        let trips = breakHistory + [
            trip("back", day(2026, 9, 10), day(2026, 9, 14)),
            trip("again", day(2026, 9, 20), day(2026, 9, 24)),
        ]
        let comeback = TripStats(trips: trips, packs: [], now: now, calendar: calendar).comeback
        #expect(comeback?.trip.id == "back")
        #expect(comeback?.isBackToPace == false)
    }

    @Test("A first trip ever is not a comeback")
    func firstTrip() {
        let trips = [trip("only", day(2026, 9, 1), day(2026, 9, 2))]
        #expect(TripStats(trips: trips, packs: [], now: now, calendar: calendar).comeback == nil)
    }

    // MARK: - Wire shapes

    @Test("A break reason belongs to one comeback only")
    func breakReasonScoped() {
        let settings = TripStatsSettings(enabled: true, breakReason: .injury, breakReasonTripId: "back")
        #expect(settings.breakReason(forComebackTrip: "back") == .injury)
        #expect(settings.breakReason(forComebackTrip: "other") == nil)
    }

    @Test("Settings send nulls so the full replace clears them")
    func settingsEncodeNulls() throws {
        let data = try JSONEncoder().encode(TripStatsSettings(enabled: false))
        let json = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        #expect(json["enabled"] as? Bool == false)
        #expect(json.keys.contains("breakReason"))
        #expect(json["breakReason"] is NSNull)
        #expect(json["breakReasonTripId"] is NSNull)
    }

    @Test("Undecided settings and unknown reasons decode")
    func settingsDecode() throws {
        let json = #"{"enabled":null,"breakReason":"boredom","breakReasonTripId":null}"#
        let settings = try JSONDecoder().decode(TripStatsSettings.self, from: Data(json.utf8))
        #expect(settings.enabled == nil)
        #expect(settings.breakReason == nil)
    }

    @Test("A goal request carries only the fields its kind uses")
    func requestShape() {
        let goal = TripGoal(
            id: "g", kind: .annual, metric: .trips, target: 5, year: 2026, name: "Stale",
            startDate: "2026-01-01T00:00:00.000Z", endDate: "2026-02-01T00:00:00.000Z"
        )
        let request = TripGoalRequest(goal: goal, now: "2026-10-05T12:00:00.000Z")
        #expect(request.id == "g")
        #expect(request.year == 2026)
        #expect(request.name == nil)
        #expect(request.startDate == nil)
        #expect(request.endDate == nil)
        #expect(request.localCreatedAt == "2026-10-05T12:00:00.000Z")
    }

    @Test("A list with one goal this build can't read keeps the rest")
    func lenientList() throws {
        let json = #"""
        [{"id":"a","kind":"annual","metric":"nights","target":10,"year":2026,"deleted":false},
         {"id":"b","kind":"annual","metric":"longTrails","target":3,"year":2026,"deleted":false}]
        """#
        let rows = try JSONDecoder().decode([Lenient<TripGoal>].self, from: Data(json.utf8))
        #expect(rows.compactMap(\.value).map(\.id) == ["a"])
    }
}
