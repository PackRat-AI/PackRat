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

    @Test("24-hour times are read aloud the way people say them")
    func speakable() {
        #expect(VoiceAnswers.speakable("Tell Imran you're due back Sunday at 19:00?") == "Tell Imran you're due back Sunday at 7 PM?")
        #expect(VoiceAnswers.speakable("Back at 07:30 or 00:15.") == "Back at 7:30 AM or 12:15 AM.")
        #expect(VoiceAnswers.speakable("Due back at 7 PM.") == "Due back at 7 PM.")
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

@Suite("Tracking and waypoint commands")
struct TrackingCommandTests {
    @Test("tracking in its natural phrasings", arguments: [
        ("Start tracking", VoiceCommand.startTracking),
        ("start recording", .startTracking),
        ("track my hike", .startTracking),
        ("Pause tracking", .pauseTracking),
        ("pause", .pauseTracking),
        ("resume tracking", .resumeTracking),
        ("continue recording", .resumeTracking),
        ("Stop tracking", .stopTracking),
        ("end recording", .stopTracking),
        ("How far have I gone?", .trackSoFar),
        ("how far have I hiked", .trackSoFar),
    ])
    func phrasings(_ transcript: String, _ expected: VoiceCommand) {
        #expect(VoiceCommandParser.parse(transcript) == expected)
    }

    @Test("how far have I gone is not how far to go")
    func soFarVersusToGo() {
        #expect(VoiceCommandParser.parse("how far have I gone") == .trackSoFar)
        #expect(VoiceCommandParser.parse("how far to go") == .howFarToGo)
    }

    @Test("waypoints take the name said after them", arguments: [
        ("Mark waypoint", String?.none),
        ("mark a waypoint here", nil),
        ("Mark waypoint water source", "Water source"),
        ("drop a pin called camp", "Camp"),
        ("add a waypoint named the bridge", "The bridge"),
    ])
    func waypoint(_ transcript: String, _ name: String?) {
        #expect(VoiceCommandParser.parse(transcript) == .markWaypoint(name: name))
    }

    @Test("notes keep the user's own words, even ones that sound like commands")
    func notes() {
        #expect(VoiceCommandParser.parse("Note: trail washed out past the bridge") == .note(text: "Trail washed out past the bridge"))
        #expect(VoiceCommandParser.parse("take a note I'm safe at the lake") == .note(text: "I'm safe at the lake"))
        #expect(VoiceCommandParser.parse("note") == .note(text: ""))
        #expect(VoiceCommandParser.parse("notebook") == nil)
    }

    @Test("none of them send anything, so none need a yes")
    func noConfirmation() {
        for command in [VoiceCommand.startTracking, .stopTracking, .markWaypoint(name: nil), .note(text: "x")] {
            #expect(!command.needsConfirmation)
        }
    }
}

@Suite("RecordedTrack")
struct RecordedTrackTests {
    private let start = Date(timeIntervalSince1970: 1_800_000_000)

    /// Walking north at 1.1 m/s (about 0.0001° latitude every 10 s).
    private func sample(_ step: Int, altitude: Double? = nil, offset: TimeInterval = 0) -> RecordedTrack.Sample {
        .init(latitude: 47.0 + Double(step) * 0.0001, longitude: -120.0, altitude: altitude, time: start.addingTimeInterval(Double(step) * 10 + offset))
    }

    @Test("distance and time moving add up as the user walks")
    func walking() {
        var track = RecordedTrack(tripId: "t", tripName: "Trip", startedAt: start)
        for step in 0...10 { track.append(sample(step)) }
        #expect(abs(track.distanceMeters - 111.2) < 1)
        #expect(track.movingSeconds == 100)
    }

    @Test("standing still isn't time moving, and a long gap isn't either")
    func notMoving() {
        var track = RecordedTrack(tripId: "t", tripName: "Trip", startedAt: start)
        track.append(sample(0))
        track.append(sample(0, offset: 60))
        track.append(sample(1, offset: 600))
        #expect(track.movingSeconds == 0)
    }

    @Test("a pause leaves the ride back out of the distance")
    func pause() {
        var track = RecordedTrack(tripId: "t", tripName: "Trip", startedAt: start)
        track.append(sample(0))
        track.append(sample(1))
        track.pause()
        track.append(sample(50))
        #expect(track.samples.count == 2)
        track.resume()
        track.append(sample(500))
        track.append(sample(501))
        #expect(track.stretches.count == 2)
        #expect(abs(track.distanceMeters - 2 * 11.12) < 0.5)
    }

    @Test("climbing ignores a few metres of GPS jitter")
    func climbing() {
        var track = RecordedTrack(tripId: "t", tripName: "Trip", startedAt: start)
        for (step, altitude) in [100.0, 102, 99, 101, 110, 108, 120].enumerated() {
            track.append(sample(step, altitude: altitude))
        }
        #expect(track.elevationGainMeters == 23)
    }

    @Test("stopping fills the trip log and keeps everything else in it")
    func appliedToLog() {
        var track = RecordedTrack(tripId: "t", tripName: "Trip", startedAt: start)
        for step in 0...5 { track.append(sample(step, altitude: Double(step) * 5)) }
        let waypoint = TripWaypoint.named("Camp", latitude: 47, longitude: -120, elevation: nil)
        let log = track.applied(to: TripLog(activities: [.hiking], distanceMeters: 1, waypoints: [waypoint]))
        #expect(log.source == .track)
        #expect(log.route != nil)
        #expect(log.distanceMeters == track.distanceMeters)
        #expect(log.elevationGainMeters == 25)
        #expect(log.activities == [.hiking])
        #expect(log.waypoints == [waypoint])
    }

    @Test("a single point is too little to save")
    func tooShort() {
        var track = RecordedTrack(tripId: "t", tripName: "Trip", startedAt: start)
        track.append(sample(0))
        #expect(track.logRoute == nil)
        #expect(track.applied(to: nil).route == nil)
    }

    @Test("stopping reads the totals the way a watch does")
    func stoppedAnswer() {
        #expect(VoiceAnswers.movingTime(4 * 3_600 + 600) == "4 hours 10")
        #expect(VoiceAnswers.movingTime(3_600) == "1 hour")
        #expect(VoiceAnswers.movingTime(45 * 60) == "45 minutes")
    }
}

@Suite("Trip log waypoints")
struct TripLogWaypointTests {
    @Test("waypoints survive a round trip, and an old log without them still reads")
    func decoding() throws {
        let waypoint = TripWaypoint.named(nil, note: "Spring is dry", latitude: 47.5, longitude: -120.8, elevation: 1_700)
        let log = TripLog(waypoints: [waypoint])
        let decoded = try JSONDecoder().decode(TripLog.self, from: JSONEncoder().encode(log))
        #expect(decoded.waypoints == [waypoint])
        #expect(!decoded.isEmpty)
        let old = try JSONDecoder().decode(TripLog.self, from: Data(#"{"activities":["hiking"]}"#.utf8))
        #expect(old.waypoints.isEmpty)
    }
}

@Suite("Turn-by-turn guidance")
struct GuidanceTests {
    // North for about 1.1 km, then a right turn east for about 1.1 km.
    private let route = [
        TripRoutePoint(latitude: 47.0, longitude: -120.0),
        TripRoutePoint(latitude: 47.01, longitude: -120.0),
        TripRoutePoint(latitude: 47.01, longitude: -119.985),
    ]
    private let start = Date(timeIntervalSince1970: 1_800_000_000)

    private func waypoint(_ name: String, _ latitude: Double, _ longitude: Double, note: String? = nil) -> TripWaypoint {
        TripWaypoint(id: name, name: name, note: note, latitude: latitude, longitude: longitude, createdAt: "2026-11-06T12:00:00Z")
    }

    @Test("navigation in its natural phrasings", arguments: [
        ("Navigate to camp", VoiceCommand.navigate(to: "camp")),
        ("take me back to the car", .navigate(to: "the car")),
        ("guide me to the end of the route", .navigate(to: "the end of the route")),
        ("Stop navigating", .stopNavigating),
        ("cancel navigation", .stopNavigating),
        ("how far to go to camp", .howFarToGo),
    ])
    func phrasings(_ transcript: String, _ expected: VoiceCommand) {
        #expect(VoiceCommandParser.parse(transcript) == expected)
    }

    @Test("a destination is a marked waypoint first, then an end of the route")
    func resolve() throws {
        let waypoints = [waypoint("Camp", 47.01, -119.99), waypoint("Water source", 47.005, -120.0)]
        #expect(GuidanceDestination.resolve("camp", waypoints: waypoints, route: route)?.name == "Camp")
        #expect(GuidanceDestination.resolve("the water", waypoints: waypoints, route: route)?.name == "Water source")
        let car = try #require(GuidanceDestination.resolve("the car", waypoints: waypoints, route: route))
        #expect(car.name == GuidanceDestination.startName && car.point == route[0])
        #expect(GuidanceDestination.resolve("end of the route", waypoints: [], route: route)?.point == route[2])
        #expect(GuidanceDestination.resolve("the bridge", waypoints: waypoints, route: route) == nil)
        #expect(GuidanceDestination.resolve("the trailhead", waypoints: [], route: nil) == nil)
        #expect(GuidanceDestination.options(waypoints: waypoints, route: route) == ["Water source", "Camp", "the trailhead", "the end of your route"])
    }

    @Test("a destination on the route is reached along it, with its one real turn")
    func plan() throws {
        let plan = GuidancePlan(from: route[0], to: .init(name: "the end of your route", point: route[2]), route: route)
        let path = try #require(plan.path)
        #expect(path.first == route[0] && path.last == route[2])
        #expect(abs(plan.lengthMeters - 2_250) < 20)
        let turn = try #require(plan.turns.first)
        #expect(plan.turns.count == 1)
        #expect(abs(turn.degrees - 90) < 5)
        #expect(turn.maneuver == "turn right")
        #expect(Geo.compassName(turn.headingAfter) == "east")
    }

    @Test("heading back to the trailhead runs the route backwards")
    func backwards() throws {
        let here = TripRoutePoint(latitude: 47.01, longitude: -119.99)
        let plan = GuidancePlan(from: here, to: .init(name: GuidanceDestination.startName, point: route[0]), route: route)
        let path = try #require(plan.path)
        #expect(Geo.distance(path[0], here) < 5)
        #expect(path.last == route[0])
        #expect(plan.turns.first?.maneuver == "turn left")
    }

    @Test("a destination off the route is pointed to straight")
    func straight() {
        let plan = GuidancePlan(from: route[0], to: .init(name: "the lake", point: .init(latitude: 47.0, longitude: -119.97)), route: route)
        #expect(plan.path == nil && plan.turns.isEmpty)
        #expect(VoiceAnswers.navigating(plan, from: route[0], metric: false) == "The lake is 1.4 miles east of you. I'll tell you when you're there.")
    }

    @Test("switchbacks on a climb aren't each called out")
    func switchbacks() {
        var zigzag: [TripRoutePoint] = []
        for index in 0...8 {
            zigzag.append(.init(latitude: 47.0 + Double(index) * 0.0008, longitude: index.isMultiple(of: 2) ? -120.0 : -119.999))
        }
        #expect(GuidancePlan.turns(along: zigzag).isEmpty)
    }

    @Test("the turn is said once, a little before it")
    func turnPrompt() {
        var guide = RouteGuide(plan: GuidancePlan(from: route[0], to: .init(name: "camp", point: route[2]), route: route))
        #expect(guide.update(position: .init(latitude: 47.005, longitude: -120.0), at: start, metric: false).isEmpty)
        let prompts = guide.update(position: .init(latitude: 47.009, longitude: -120.0), at: start + 60, metric: false)
        #expect(prompts == [GuidancePrompt(kind: .turn, text: "In 350 feet, turn right, heading east.")])
        #expect(guide.update(position: .init(latitude: 47.0095, longitude: -120.0), at: start + 90, metric: false).isEmpty)
    }

    @Test("halfway, then arrival")
    func milestones() {
        var guide = RouteGuide(plan: GuidancePlan(from: route[0], to: .init(name: "camp", point: route[2]), route: route))
        _ = guide.update(position: .init(latitude: 47.009, longitude: -120.0), at: start, metric: false)
        let halfway = guide.update(position: .init(latitude: 47.01, longitude: -119.9995), at: start + 60, metric: false)
        #expect(halfway.map(\.kind) == [.milestone])
        #expect(halfway.first?.text == "Halfway to camp. Three quarters of a mile to go.")
        let arrived = guide.update(position: .init(latitude: 47.01, longitude: -119.9852), at: start + 900, metric: false)
        #expect(arrived == [GuidancePrompt(kind: .arrived, text: "You've reached camp.")])
        #expect(guide.hasArrived)
    }

    @Test("off route is said after a while, once, then again only further away")
    func offRoute() {
        var guide = RouteGuide(plan: GuidancePlan(from: route[0], to: .init(name: "camp", point: route[2]), route: route))
        let east = TripRoutePoint(latitude: 47.005, longitude: -119.996)
        #expect(guide.update(position: east, at: start, metric: false).isEmpty)
        #expect(guide.update(position: east, at: start + 25, metric: false)
            == [GuidancePrompt(kind: .offRoute, text: "You're off route. Head west about 1,000 feet to rejoin it.")])
        #expect(guide.update(position: east, at: start + 60, metric: false).isEmpty)
        #expect(guide.update(position: .init(latitude: 47.005, longitude: -119.992), at: start + 90, metric: false).map(\.kind) == [.offRoute])
        #expect(guide.update(position: .init(latitude: 47.005, longitude: -120.0), at: start + 120, metric: false).first?.text == "You're back on route.")
    }
}

@Suite("Hey PackRat")
struct WakePhraseTests {
    @Test("the phrase in the ways the recogniser writes it, with what followed", arguments: [
        ("Hey PackRat", ""),
        ("hey pack rat mark waypoint", "mark waypoint"),
        ("Hey, PackRat, how far to go?", "how far to go"),
        ("okay packrat navigate to camp", "navigate to camp"),
        ("we stopped for lunch hey packrat start tracking", "start tracking"),
        ("Hey PackRat check in hey packrat I'm safe", "im safe"),
    ])
    func heard(_ transcript: String, _ command: String) {
        #expect(WakePhrase.command(after: transcript) == command)
    }

    @Test("talk without the phrase wakes nothing", arguments: ["the pack is heavy", "hey there", "packrat is a good app", "check in"])
    func notHeard(_ transcript: String) {
        #expect(WakePhrase.command(after: transcript) == nil)
    }
}

#if os(iOS)
@Suite("Spoken safety alerts")
struct SafetyAlertTests {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)

    private func checkIn(overdueIn minutes: Double) -> LocalSafetyCheckIn {
        LocalSafetyCheckIn(
            id: "c1", tripId: "t1", tripName: "Rae Lakes", contactNames: ["Sam"],
            expectedReturnAt: now.addingTimeInterval(minutes * 60 - 30 * 60), graceMinutes: 30,
            trackingEnabled: false, startedAt: now.addingTimeInterval(-3_600)
        )
    }

    @Test("an hour before contacts are told, and not before")
    func overdue() {
        let soon = TripSafetyAnnouncer.due(checkIn: checkIn(overdueIn: 45), battery: nil, weather: [], tracking: false, now: now)
        #expect(soon.map(\.kind) == [.overdue])
        #expect(soon.first?.text == "Heads up. Sam will be told you're overdue in 45 minutes. Say I'm safe, or add an hour.")
        #expect(TripSafetyAnnouncer.due(checkIn: checkIn(overdueIn: 90), battery: nil, weather: [], tracking: false, now: now).isEmpty)
        #expect(TripSafetyAnnouncer.due(checkIn: checkIn(overdueIn: -5), battery: nil, weather: [], tracking: false, now: now).isEmpty)
    }

    @Test("battery at 20 and 10 percent, never while charging")
    func battery() {
        let twenty = TripSafetyAnnouncer.due(checkIn: nil, battery: (0.19, false), weather: [], tracking: true, now: now)
        #expect(twenty.map(\.key) == [TripSafetyAnnouncer.batteryKey(20)])
        #expect(twenty.first?.text == "Your battery is at 19 percent. Tracking will stop if it runs out.")
        let ten = TripSafetyAnnouncer.due(checkIn: nil, battery: (0.08, false), weather: [], tracking: false, now: now)
        #expect(ten.map(\.key) == [TripSafetyAnnouncer.batteryKey(10)])
        #expect(TripSafetyAnnouncer.due(checkIn: nil, battery: (0.08, true), weather: [], tracking: true, now: now).isEmpty)
        #expect(TripSafetyAnnouncer.due(checkIn: nil, battery: (0.5, false), weather: [], tracking: true, now: now).isEmpty)
    }

    @Test("only severe and extreme weather is said")
    func weather() {
        let warnings = [
            TripSafetyAnnouncer.WeatherWarning(id: "a", event: "severe thunderstorm warning", headline: "Large hail expected until 6 PM.", severity: "Severe"),
            TripSafetyAnnouncer.WeatherWarning(id: "b", event: "Frost Advisory", headline: nil, severity: "Minor"),
        ]
        let alerts = TripSafetyAnnouncer.due(checkIn: nil, battery: nil, weather: warnings, tracking: false, now: now)
        #expect(alerts.map(\.key) == ["weather-a"])
        #expect(alerts.first?.text == "Weather alert. Severe thunderstorm warning in effect for your area. Large hail expected until 6 PM.")
    }
}

@Suite("Siri trip")
struct SiriTripTests {
    private func trip(_ id: String, _ status: TripStatus, started: String? = nil, start: String? = nil) -> Trip {
        Trip(id: id, name: id, description: nil, notes: nil, location: nil, startDate: start, endDate: nil, userId: nil,
             packId: nil, deleted: false, createdAt: nil, updatedAt: nil, status: status, startedAt: started)
    }

    @Test("the tracked trip first, then the latest one in progress")
    func picksTrip() {
        let trips = [
            trip("old", .inProgress, started: "2026-11-01T08:00:00Z"),
            trip("new", .inProgress, started: "2026-11-06T08:00:00Z"),
            trip("done", .complete),
        ]
        #expect(VoiceCommandHost.activeTrip(in: trips, preferring: [], now: Date())?.id == "new")
        #expect(VoiceCommandHost.activeTrip(in: trips, preferring: ["old"], now: Date())?.id == "old")
        #expect(VoiceCommandHost.activeTrip(in: [trip("done", .complete)], preferring: ["done"], now: Date()) == nil)
    }
}
#endif
