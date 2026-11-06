import Foundation
import Testing
@testable import PackRat

@Suite("TripWeatherPlan")
struct TripWeatherPlanTests {
    private let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Denver")!
        return calendar
    }()

    private func date(_ y: Int, _ m: Int, _ d: Int, _ h: Int = 8) -> Date {
        calendar.date(from: DateComponents(year: y, month: m, day: d, hour: h))!
    }

    private func trip(start: Date?, end: Date?, located: Bool = true) -> Trip {
        Trip(id: "t1", name: "Enchantments", description: nil, notes: nil,
             location: located ? TripLocation(latitude: 47.5, longitude: -120.8, name: "Leavenworth") : nil,
             startDate: start?.iso8601String(), endDate: end?.iso8601String(), userId: nil, packId: nil,
             checklist: nil, deleted: false, createdAt: nil, updatedAt: nil)
    }

    /// Ten forecast days starting on `from`, as the API returns them.
    private func forecastDates(from start: Date) -> [String] {
        (0..<10).map { TripWeatherPlan.dayString(calendar.date(byAdding: .day, value: $0, to: start)!, calendar: calendar) }
    }

    @Test("a trip inside the forecast shows exactly its own days")
    func withinRange() {
        let now = date(2026, 11, 6)
        let plan = TripWeatherPlan.make(
            trip: trip(start: date(2026, 11, 8), end: date(2026, 11, 10)),
            forecastDates: forecastDates(from: now), now: now, calendar: calendar
        )
        #expect(plan == .days(dates: ["2026-11-08", "2026-11-09", "2026-11-10"], underWay: false, partial: false))
    }

    @Test("a trip running past the forecast shows the days in range and is partial")
    func partlyInRange() {
        let now = date(2026, 11, 6)
        let plan = TripWeatherPlan.make(
            trip: trip(start: date(2026, 11, 14), end: date(2026, 11, 18)),
            forecastDates: forecastDates(from: now), now: now, calendar: calendar
        )
        #expect(plan == .days(dates: ["2026-11-14", "2026-11-15"], underWay: false, partial: true))
    }

    @Test("a trip under way starts at today")
    func underWay() {
        let now = date(2026, 11, 6)
        let plan = TripWeatherPlan.make(
            trip: trip(start: date(2026, 11, 4), end: date(2026, 11, 7)),
            forecastDates: forecastDates(from: now), now: now, calendar: calendar
        )
        #expect(plan == .days(dates: ["2026-11-06", "2026-11-07"], underWay: true, partial: false))
    }

    @Test("a trip starting after the last forecast day is beyond range and fetches nothing")
    func beyondRange() {
        let now = date(2026, 11, 6)
        let far = trip(start: date(2026, 11, 16), end: date(2026, 11, 18))
        #expect(TripWeatherPlan.make(trip: far, forecastDates: [], now: now, calendar: calendar) == .beyondRange)
        #expect(!TripWeatherPlan.needsForecast(far, now: now, calendar: calendar))
    }

    @Test("a finished trip, an undated trip and a trip with no destination have no section")
    func hidden() {
        let now = date(2026, 11, 6)
        let finished = trip(start: date(2026, 11, 1), end: date(2026, 11, 5))
        #expect(TripWeatherPlan.make(trip: finished, forecastDates: forecastDates(from: now), now: now, calendar: calendar) == .hidden)
        #expect(TripWeatherPlan.make(trip: trip(start: nil, end: nil), forecastDates: [], now: now, calendar: calendar) == .hidden)
        let nowhere = trip(start: date(2026, 11, 8), end: nil, located: false)
        #expect(TripWeatherPlan.make(trip: nowhere, forecastDates: [], now: now, calendar: calendar) == .hidden)
        #expect(!TripWeatherPlan.needsForecast(finished, now: now, calendar: calendar))
    }

    @Test("a single-day trip uses its start date as its end")
    func singleDay() {
        let now = date(2026, 11, 6)
        let plan = TripWeatherPlan.make(
            trip: trip(start: date(2026, 11, 9), end: nil),
            forecastDates: forecastDates(from: now), now: now, calendar: calendar
        )
        #expect(plan == .days(dates: ["2026-11-09"], underWay: false, partial: false))
    }
}
