import Foundation
import Testing
@testable import PackRat

@Suite("TripConditions")
struct TripConditionsTests {
    private let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Denver")!
        return calendar
    }()

    private func date(_ y: Int, _ m: Int, _ d: Int, _ h: Int = 8) -> Date {
        calendar.date(from: DateComponents(year: y, month: m, day: d, hour: h))!
    }

    private func trip(start: Date, end: Date?) -> Trip {
        Trip(id: "t1", name: "Enchantments", description: nil, notes: nil,
             location: TripLocation(latitude: 47.5, longitude: -120.8, name: "Leavenworth"),
             startDate: start.iso8601String(), endDate: end?.iso8601String(), userId: nil, packId: nil,
             checklist: nil, deleted: false, createdAt: nil, updatedAt: nil)
    }

    /// Decodes a WeatherAPI-shaped forecast the way the API client does.
    private func forecast(days: [(String, Double, Double, Int, Int)], alerts: [String] = []) throws -> WeatherForecastResponse {
        let dayJSON = days.map { date, low, high, rain, snow in
            """
            {"date": "\(date)", "day": {"mintemp_f": \(low), "maxtemp_f": \(high),
             "mintemp_c": \((low - 32) * 5 / 9), "maxtemp_c": \((high - 32) * 5 / 9),
             "daily_chance_of_rain": \(rain), "daily_chance_of_snow": \(snow),
             "condition": {"text": "Partly cloudy"}}}
            """
        }
        let alertJSON = alerts.map { #"{"event": "\#($0)", "effective": "2026-10-19", "severity": "Severe"}"# }
        let json = #"{"forecast": {"forecastday": [\#(dayJSON.joined(separator: ","))]}, "alerts": {"alert": [\#(alertJSON.joined(separator: ","))]}}"#
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(WeatherForecastResponse.self, from: Data(json.utf8))
    }

    @Test("summarises only the trip's own days and advises for cold and rain")
    func summarisesTripDays() throws {
        let response = try forecast(days: [
            ("2026-10-19", 50, 70, 0, 0),   // day before — ignored
            ("2026-10-20", 30, 55, 60, 0),
            ("2026-10-21", 36, 62, 10, 0),
        ])
        let summary = try #require(TripConditions.make(
            trip: trip(start: date(2026, 10, 20), end: date(2026, 10, 22)),
            forecast: response, now: date(2026, 10, 15), calendar: calendar
        ))
        #expect(summary.lowF == 30)
        #expect(summary.highF == 62)
        #expect(summary.coveredDays == 2)
        #expect(summary.tripDays == 3)
        #expect(summary.temperatureSummary(celsius: false) == "Highs 62°, lows 30°")
        #expect(summary.packAdvice(celsius: false) == [
            "Lows below freezing — pack your warm layers.",
            "Rain likely — pack your rain gear.",
        ])
        #expect(summary.reminderLine(celsius: false) == "Lows below freezing — pack your warm layers.")
    }

    @Test("an alert outranks pack advice and repeats per zone collapse to one")
    func alertsLead() throws {
        let response = try forecast(days: [("2026-10-20", 45, 95, 0, 0)],
                                    alerts: ["Red Flag Warning", "Red Flag Warning"])
        let summary = try #require(TripConditions.make(
            trip: trip(start: date(2026, 10, 20), end: nil),
            forecast: response, now: date(2026, 10, 15), calendar: calendar
        ))
        #expect(summary.alerts.map(\.event) == ["Red Flag Warning"])
        #expect(summary.reminderLine(celsius: false) == "Weather alert at the destination: Red Flag Warning.")
        #expect(summary.packAdvice(celsius: false) == ["Highs near 95° — bring extra water and sun cover."])
    }

    @Test("no forecast day inside the trip yet means no summary")
    func outsideHorizon() throws {
        let response = try forecast(days: [("2026-10-10", 40, 60, 0, 0)])
        #expect(TripConditions.make(
            trip: trip(start: date(2026, 10, 20), end: nil),
            forecast: response, now: date(2026, 10, 9), calendar: calendar
        ) == nil)
    }

    @Test("mild, dry weather asks nothing of the pack")
    func mildWeather() throws {
        let response = try forecast(days: [("2026-10-20", 48, 70, 10, 0)])
        let summary = try #require(TripConditions.make(
            trip: trip(start: date(2026, 10, 20), end: nil),
            forecast: response, now: date(2026, 10, 15), calendar: calendar
        ))
        #expect(summary.packAdvice(celsius: false).isEmpty)
        #expect(summary.reminderLine(celsius: false) == nil)
    }

    @Test("the forecast joins the countdown reminders except the morning-of")
    func reminderCopy() {
        let reminders = TripReminderPlanner.reminders(
            for: trip(start: date(2026, 10, 20), end: nil), pack: nil, packedItemIds: [],
            now: date(2026, 10, 1, 12), calendar: calendar,
            conditionsLine: "Rain likely — pack your rain gear."
        )
        let withLine = reminders.filter { $0.body.hasSuffix("Rain likely — pack your rain gear.") }.map(\.moment)
        #expect(withLine == [.weekBefore, .threeDaysBefore, .eveningBefore])
    }
}
