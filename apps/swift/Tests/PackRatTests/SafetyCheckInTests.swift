import Foundation
import Testing
@testable import PackRat

#if os(iOS)
@Suite("Emergency contact email")
struct EmergencyContactEmailTests {
    @Test("plausible addresses pass")
    func valid() {
        #expect(EmergencyContactForm.looksLikeEmail("mom@example.com"))
        #expect(EmergencyContactForm.looksLikeEmail("sam.rivera+trips@mail.co.uk"))
    }

    @Test("obvious typos are caught before saving")
    func invalid() {
        #expect(!EmergencyContactForm.looksLikeEmail("mom@example"))
        #expect(!EmergencyContactForm.looksLikeEmail("mom example.com"))
        #expect(!EmergencyContactForm.looksLikeEmail("@example.com"))
        #expect(!EmergencyContactForm.looksLikeEmail("mom@@example.com"))
        #expect(!EmergencyContactForm.looksLikeEmail("mom@example."))
    }

    @Test("only contacts with an email can be notified")
    func notifiable() {
        let phoneOnly = EmergencyContact(id: "1", name: "Mom", phone: "+14155550123", email: nil, isDefault: true)
        let withEmail = EmergencyContact(id: "2", name: "Sam", phone: nil, email: "sam@example.com", isDefault: false)
        #expect(!phoneOnly.canBeNotified)
        #expect(phoneOnly.reachableAt == "No email address")
        #expect(withEmail.canBeNotified)
        #expect(withEmail.reachableAt == "sam@example.com")
    }
}
#endif

@Suite("GPXRouteParser")
struct GPXRouteParserTests {
    private func gpx(_ body: String) -> Data {
        Data("""
        <?xml version="1.0"?>
        <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">\(body)</gpx>
        """.utf8)
    }

    @Test("reads track points in order")
    func track() throws {
        let route = try GPXRouteParser.parse(gpx("""
        <trk><trkseg>
          <trkpt lat="47.528" lon="-120.82"/><trkpt lat="47.51" lon="-120.81"/><trkpt lat="47.50" lon="-120.80"/>
        </trkseg></trk>
        """))
        #expect(route == [
            TripRoutePoint(latitude: 47.528, longitude: -120.82),
            TripRoutePoint(latitude: 47.51, longitude: -120.81),
            TripRoutePoint(latitude: 47.50, longitude: -120.80),
        ])
    }

    @Test("prefers a track over a route over waypoints")
    func precedence() throws {
        let route = try GPXRouteParser.parse(gpx("""
        <wpt lat="1" lon="1"/><wpt lat="2" lon="2"/>
        <rte><rtept lat="3" lon="3"/><rtept lat="4" lon="4"/></rte>
        """))
        #expect(route.first == TripRoutePoint(latitude: 3, longitude: 3))
    }

    @Test("a file with no usable points is an error the user can act on")
    func empty() {
        #expect(throws: GPXRouteParser.ParseError.self) {
            try GPXRouteParser.parse(gpx("<trk><trkseg><trkpt lat=\"1\" lon=\"1\"/></trkseg></trk>"))
        }
    }

    @Test("long tracks are thinned to the limit, keeping both ends")
    func thinning() {
        let points = (0..<10_001).map { TripRoutePoint(latitude: Double($0) / 1000, longitude: 0) }
        let thinned = GPXRouteParser.thin(points, to: 100)
        #expect(thinned.count == 100)
        #expect(thinned.first == points.first)
        #expect(thinned.last == points.last)
    }

    @Test("length sums the legs")
    func length() {
        // One degree of latitude is ~111.2 km.
        let meters = GPXRouteParser.lengthMeters([
            TripRoutePoint(latitude: 0, longitude: 0),
            TripRoutePoint(latitude: 1, longitude: 0),
        ])
        #expect(abs(meters - 111_195) < 100)
    }
}

@Suite("SafetyCheckInDefaults")
struct SafetyCheckInDefaultsTests {
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        return calendar
    }

    private func date(_ string: String) -> Date { string.toDate()! }

    private func trip(start: String?, end: String?) -> Trip {
        Trip(id: "t1", name: "Enchantments", description: nil, notes: nil, location: nil,
             startDate: start, endDate: end, userId: nil, packId: nil, checklist: nil,
             deleted: false, createdAt: nil, updatedAt: nil)
    }

    private func item(_ name: String, category: String? = nil) -> PackItem {
        PackItem(id: UUID().uuidString, packId: "p1", name: name, description: nil, weight: 100, weightUnit: .g,
                 quantity: 1, category: category, consumable: false, worn: false, image: nil, notes: nil,
                 catalogItemId: nil, userId: nil, deleted: false, isAIGenerated: nil,
                 templateItemId: nil, createdAt: nil, updatedAt: nil)
    }

    @Test("expected return defaults to 7 PM on the trip's last day")
    func eveningOfEndDate() {
        let now = date("2026-09-12T15:00:00Z")
        let result = SafetyCheckInDefaults.expectedReturn(
            for: trip(start: "2026-09-12T16:00:00Z", end: "2026-09-14T16:00:00Z"), now: now, calendar: calendar
        )
        #expect(calendar.component(.hour, from: result) == 19)
        #expect(calendar.component(.day, from: result) == 14)
    }

    @Test("an undated or already-ended trip gets eight hours from now, on a quarter hour")
    func fallback() {
        let now = date("2026-09-12T15:07:00Z")
        let result = SafetyCheckInDefaults.expectedReturn(for: trip(start: nil, end: nil), now: now, calendar: calendar)
        #expect(result.timeIntervalSince(now) >= 8 * 3600)
        #expect(result.timeIntervalSince(now) < 8 * 3600 + 15 * 60)
        #expect(calendar.component(.minute, from: result) % 15 == 0)
    }

    @Test("identifying gear picks shelter, outer layer and pack, one of each, in that order")
    func gear() {
        let gear = SafetyCheckInDefaults.identifyingGear(from: [
            item("Stove"),
            item("Osprey Exos 58 Backpack"),
            item("Patagonia Torrentshell", category: "Rain Jacket"),
            item("Big Agnes Copper Spur", category: "Tent"),
            item("Second tent"),
        ])
        #expect(gear.map(\.name) == ["Big Agnes Copper Spur", "Patagonia Torrentshell", "Osprey Exos 58 Backpack"])
    }

    @Test("the preview matches what contacts receive, colour first")
    func preview() {
        let text = SafetyCheckInDefaults.previewMessage(
            userName: "Alex", tripName: "Enchantments", expectedReturn: Date(),
            gear: [IdentifyingGearItem(name: "Big Agnes tent", note: "orange"), IdentifyingGearItem(name: " ", note: nil)]
        )
        #expect(text.hasPrefix("Alex has started their trip: Enchantments. Expected return: "))
        #expect(text.contains("They are carrying: orange Big Agnes tent."))
        #expect(text.hasSuffix("Track live progress: [link]"))
    }
}

@Suite("Safety check-in state")
struct SafetyCheckInStateTests {
    private func checkIn(contacts: [String] = ["Mom"], expected: Date, grace: Int = 120) -> LocalSafetyCheckIn {
        LocalSafetyCheckIn(
            id: "c1", tripId: "t1", tripName: "Enchantments", contactNames: contacts,
            expectedReturnAt: expected, graceMinutes: grace, trackingEnabled: false, startedAt: Date()
        )
    }

    @Test("the overdue alert time is the expected return plus grace")
    func overdueAt() {
        let expected = Date(timeIntervalSince1970: 1_000_000)
        #expect(checkIn(expected: expected, grace: 90).overdueAt == expected.addingTimeInterval(90 * 60))
    }

    @Test("contacts are named the way the card reads them")
    func contactSummary() {
        let now = Date()
        #expect(checkIn(contacts: ["Mom"], expected: now).contactSummary == "Mom")
        #expect(checkIn(contacts: ["Mom", "Sam"], expected: now).contactSummary == "Mom and Sam")
        #expect(checkIn(contacts: ["Mom", "Sam", "Jo"], expected: now).contactSummary == "Mom and 2 others")
    }

    @Test("local notifications: reminder an hour before return, then the overdue notice; past ones dropped")
    func notificationPlan() {
        let now = Date(timeIntervalSince1970: 1_000_000)
        let soon = checkIn(expected: now.addingTimeInterval(3 * 3600))
        let plan = SafetyCheckInNotifications.plan(for: soon, now: now)
        #expect(plan.map(\.fireAt) == [now.addingTimeInterval(2 * 3600), now.addingTimeInterval(5 * 3600)])
        #expect(plan[1].body.hasPrefix("Mom has been told you're overdue on Enchantments."))

        #if os(iOS)
        // A tap opens the trip through the same route trip reminders use.
        #expect(SafetyCheckInNotifications.tripIdKey == TripReminderScheduler.tripIdKey)
        #endif

        let late = checkIn(expected: now.addingTimeInterval(30 * 60))
        #expect(SafetyCheckInNotifications.plan(for: late, now: now).map(\.id) == ["safety-overdue-c1"])
    }

    #if os(iOS)
    @Test("countdown reads in days, hours or minutes")
    func countdown() {
        let now = Date(timeIntervalSince1970: 0)
        #expect(SafetyCheckInCard.countdown(to: now.addingTimeInterval(30), from: now) == "Under a minute")
        #expect(SafetyCheckInCard.countdown(to: now.addingTimeInterval(48 * 60), from: now) == "48m")
        #expect(SafetyCheckInCard.countdown(to: now.addingTimeInterval(5 * 3600 + 12 * 60), from: now) == "5h 12m")
        #expect(SafetyCheckInCard.countdown(to: now.addingTimeInterval(26 * 3600), from: now) == "1d 2h")
    }
    #endif

    @Test("only signal problems are retried; refusals are dropped so the queue moves")
    func retryable() {
        #expect(SafetyCheckInStore.isRetryable(URLError(.notConnectedToInternet)))
        #expect(SafetyCheckInStore.isRetryable(PackRatError.httpError(statusCode: 503, message: nil)))
        #expect(SafetyCheckInStore.isRetryable(PackRatError.httpError(statusCode: 429, message: nil)))
        #expect(SafetyCheckInStore.isRetryable(PackRatError.unauthorized))
        #expect(!SafetyCheckInStore.isRetryable(PackRatError.httpError(statusCode: 400, message: "bad")))
        #expect(!SafetyCheckInStore.isRetryable(PackRatError.notFound))
    }

    @Test("queued operations survive a relaunch")
    func queueCodable() throws {
        let ops: [PendingSafetyOperation] = [
            .extend(checkInId: "c1", expectedReturnAt: Date(timeIntervalSince1970: 1_000)),
            .end(checkInId: "c1", outcome: .safe, at: Date(timeIntervalSince1970: 2_000)),
            .locations(checkInId: "c1", [SafetyLocationInput(
                id: "l1", kind: .checkIn, latitude: 1, longitude: 2, accuracyMeters: 5,
                placeName: "Colchuck Lake", note: "All good", recordedAt: "2026-09-12T15:00:00Z"
            )]),
        ]
        let decoded = try JSONDecoder().decode([PendingSafetyOperation].self, from: JSONEncoder().encode(ops))
        #expect(decoded == ops)
        #expect(decoded.map(\.checkInId) == ["c1", "c1", "c1"])
    }

    @Test("a lifecycle update carries status and route so a collapsed queue can't lose them")
    func payloadCarriesLifecycle() {
        var trip = Trip(id: "t1", name: "Enchantments", description: nil, notes: nil, location: nil,
                        startDate: nil, endDate: nil, userId: nil, packId: nil, checklist: nil,
                        deleted: false, createdAt: nil, updatedAt: nil)
        trip.status = .inProgress
        trip.startedAt = "2026-09-12T15:00:00Z"
        trip.plannedRoute = [TripRoutePoint(latitude: 1, longitude: 2)]
        var payload = TripMutationPayload(name: trip.name, checklist: nil)
        payload.carryLifecycle(of: trip)
        #expect(payload.status == .inProgress)
        #expect(payload.startedAt == "2026-09-12T15:00:00Z")
        #expect(payload.plannedRoute?.count == 1)
    }
}
