import Foundation
import Testing
@testable import PackRat

@Suite("VoiceCommandParser")
struct VoiceCommandParserTests {
    @Test("trip commands in their natural phrasings", arguments: [
        ("Check in", VoiceCommand.checkIn),
        ("send a check-in", .checkIn),
        ("Let them know I'm OK", .checkIn),
        ("I'm safe", .imSafe),
        ("I’m back", .imSafe),
        ("end my trip", .imSafe),
        ("Start my trip", .startTrip),
        ("Where am I?", .whereAmI),
        ("How far to go", .howFarToGo),
        ("how much further", .howFarToGo),
        ("Am I on route?", .amIOnRoute),
        ("am I off track", .amIOnRoute),
        ("When am I due back", .whenAmIDue),
        ("What's the weather", .weather),
        ("is it going to rain", .weather),
    ])
    func phrasings(_ transcript: String, _ expected: VoiceCommand) {
        #expect(VoiceCommandParser.parse(transcript) == expected)
    }

    @Test("adding time", arguments: [
        ("Add an hour", 60),
        ("add two hours", 120),
        ("Add 30 minutes", 30),
        ("extend by an hour and a half", 90),
        ("give me half an hour", 30),
        ("I'm running late", 60),
    ])
    func extendBy(_ transcript: String, _ minutes: Int) {
        #expect(VoiceCommandParser.parse(transcript) == .extendBy(minutes: minutes))
    }

    @Test("a return time of day reads as this evening unless said otherwise")
    func extendUntil() {
        #expect(VoiceCommandParser.parse("I'll be back at eight") == .extendUntil(hour: 20, minute: 0))
        #expect(VoiceCommandParser.parse("back by 7:30") == .extendUntil(hour: 19, minute: 30))
        #expect(VoiceCommandParser.parse("I'll be back at seven forty five") == .extendUntil(hour: 19, minute: 45))
        #expect(VoiceCommandParser.parse("back at 9 am") == .extendUntil(hour: 9, minute: 0))
        #expect(VoiceCommandParser.parse("back by 21:15") == .extendUntil(hour: 21, minute: 15))
    }

    @Test("anything unclear is not a command, so nothing is ever sent on a guess")
    func unrecognised() {
        #expect(VoiceCommandParser.parse("") == nil)
        #expect(VoiceCommandParser.parse("what a view") == nil)
        #expect(VoiceCommandParser.parse("chicken") == nil)
        #expect(VoiceCommandParser.parse("my address") == nil)
    }

    @Test("sending commands need a spoken yes; questions don't")
    func confirmation() {
        #expect(VoiceCommand.checkIn.needsConfirmation)
        #expect(VoiceCommand.imSafe.needsConfirmation)
        #expect(VoiceCommand.extendBy(minutes: 60).needsConfirmation)
        #expect(!VoiceCommand.whereAmI.needsConfirmation)
        #expect(!VoiceCommand.weather.needsConfirmation)
    }

    @Test("yes and no answers, with no winning over yes")
    func yesNo() {
        #expect(VoiceCommandParser.parseConfirmation("Yes") == .yes)
        #expect(VoiceCommandParser.parseConfirmation("yeah send it") == .yes)
        #expect(VoiceCommandParser.parseConfirmation("confirm") == .yes)
        #expect(VoiceCommandParser.parseConfirmation("No") == .no)
        #expect(VoiceCommandParser.parseConfirmation("don't send it") == .no)
        #expect(VoiceCommandParser.parseConfirmation("cancel") == .no)
        #expect(VoiceCommandParser.parseConfirmation("") == nil)
        #expect(VoiceCommandParser.parseConfirmation("hmm") == nil)
    }
}

@Suite("RouteProgress")
struct RouteProgressTests {
    // A straight route running north for about 2.2 km.
    private let route = [
        TripRoutePoint(latitude: 47.0, longitude: -120.0),
        TripRoutePoint(latitude: 47.01, longitude: -120.0),
        TripRoutePoint(latitude: 47.02, longitude: -120.0),
    ]

    @Test("on the line, partway along")
    func onRoute() throws {
        let progress = try #require(RouteProgress(position: .init(latitude: 47.005, longitude: -120.0), route: route))
        #expect(progress.isOnRoute)
        #expect(abs(progress.alongMeters - 556) < 5)
        #expect(abs(progress.remainingMeters - 1_668) < 5)
    }

    @Test("east of the line, it says head west")
    func offRoute() throws {
        // ~300 m east of the route.
        let progress = try #require(RouteProgress(position: .init(latitude: 47.01, longitude: -119.996), route: route))
        #expect(!progress.isOnRoute)
        #expect(abs(progress.offRouteMeters - 303) < 5)
        #expect(Geo.compassName(progress.bearingToRoute) == "west")
        #expect(VoiceAnswers.onRoute(progress, metric: false) == "You're about 1,000 feet east of your route. Head west to rejoin it.")
    }

    @Test("a route needs two points")
    func tooShort() {
        #expect(RouteProgress(position: route[0], route: [route[0]]) == nil)
    }

    @Test("compass names", arguments: [(0.0, "north"), (44.0, "north-east"), (90.0, "east"), (200.0, "south"), (350.0, "north")])
    func compass(_ bearing: Double, _ name: String) {
        #expect(Geo.compassName(bearing) == name)
    }
}

@Suite("VoiceAnswers")
struct VoiceAnswersTests {
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        calendar.locale = Locale(identifier: "en_US")
        return calendar
    }

    private func date(_ hour: Int, _ minute: Int = 0, day: Int = 14) -> Date {
        calendar.date(from: DateComponents(year: 2026, month: 9, day: day, hour: hour, minute: minute))!
    }

    @Test("distances are said the way a hiker would say them")
    func distances() {
        #expect(VoiceAnswers.distance(800, metric: false) == "half a mile")
        #expect(VoiceAnswers.distance(5_150, metric: false) == "3.2 miles")
        #expect(VoiceAnswers.distance(1_609, metric: false) == "1 mile")
        #expect(VoiceAnswers.distance(91, metric: false) == "300 feet")
        #expect(VoiceAnswers.distance(800, metric: true) == "800 metres")
        #expect(VoiceAnswers.distance(1_400, metric: true) == "1.4 kilometres")
        #expect(VoiceAnswers.height(1_707, metric: false) == "5,600 feet")
    }

    @Test("due back counts down to the return, then to the alert")
    func dueBack() {
        #expect(VoiceAnswers.dueBack(expectedReturn: date(19), graceMinutes: 120, now: date(15), calendar: calendar)
            == "You're due back at 7 PM. That's 4 hours from now.")
        #expect(VoiceAnswers.dueBack(expectedReturn: date(19), graceMinutes: 120, now: date(19, 30), calendar: calendar)
            == "You were due back at 7 PM. Your contacts get an overdue alert in 1 hour 30 minutes.")
        #expect(VoiceAnswers.dueBack(expectedReturn: date(19), graceMinutes: 120, now: date(22), calendar: calendar)
            == "You were due back at 7 PM. Your contacts have been sent an overdue alert.")
    }

    @Test("times follow the phone's 12- or 24-hour clock")
    func spokenTimeClock() {
        var twentyFour = calendar
        twentyFour.locale = Locale(identifier: "en_GB")
        #expect(VoiceAnswers.spokenTime(date(19), now: date(15), calendar: calendar) == "at 7 PM")
        #expect(VoiceAnswers.spokenTime(date(19), now: date(15), calendar: twentyFour) == "at 19:00")
        #expect(VoiceAnswers.spokenTime(date(19, 30), now: date(15), calendar: twentyFour) == "at 19:30")
    }

    @Test("check-in read-back names the contacts and the place")
    func confirmCheckIn() {
        #expect(VoiceAnswers.confirmCheckIn(contacts: "Sam and Jo", placeName: "Colchuck Lake")
            == "Checking in with Sam and Jo near Colchuck Lake. Send it?")
        #expect(VoiceAnswers.confirmCheckIn(contacts: "Sam", placeName: nil) == "Checking in with Sam. Send it?")
    }

    @Test("where am I falls back to the route, then to coordinates")
    func whereAmI() {
        #expect(VoiceAnswers.whereAmI(placeName: "Colchuck Lake", progress: nil, latitude: 47.5, longitude: -120.8, altitudeMeters: 1_707, metric: false)
            == "You're near Colchuck Lake, at 5,600 feet.")
        #expect(VoiceAnswers.whereAmI(placeName: nil, progress: nil, latitude: 47.5, longitude: -120.8, altitudeMeters: nil, metric: false)
            == "You're at 47.500 degrees north, 120.800 degrees west.")
    }

    #if os(iOS)
    @Test("a spoken time already past today means tomorrow")
    @MainActor
    func newReturn() {
        let now = date(21)
        let current = date(19)
        #expect(VoiceCommandController.newReturn(for: .extendBy(minutes: 60), current: current, now: now, calendar: calendar) == date(22))
        #expect(VoiceCommandController.newReturn(for: .extendUntil(hour: 22, minute: 30), current: current, now: now, calendar: calendar) == date(22, 30))
        #expect(VoiceCommandController.newReturn(for: .extendUntil(hour: 8, minute: 0), current: current, now: now, calendar: calendar) == date(8, day: 15))
    }
    #endif
}
