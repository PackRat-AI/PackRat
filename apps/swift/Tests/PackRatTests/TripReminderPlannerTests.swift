import Foundation
import Testing
@testable import PackRat

@Suite("TripReminderPlanner")
struct TripReminderPlannerTests {
    private let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Denver")!
        return calendar
    }()

    /// Trip starts 2026-10-20 local; tests vary `now` against it.
    private var start: Date { date(2026, 10, 20, 8) }

    private func date(_ y: Int, _ m: Int, _ d: Int, _ h: Int) -> Date {
        calendar.date(from: DateComponents(year: y, month: m, day: d, hour: h))!
    }

    private func makeTrip(
        start: Date?, end: Date? = nil, packId: String? = "p1", deleted: Bool = false,
        checklist: [TripChecklistItem]? = nil
    ) -> Trip {
        Trip(id: "t1", name: "Enchantments", description: nil, notes: nil, location: nil,
             startDate: start?.iso8601String(), endDate: end?.iso8601String(), userId: nil, packId: packId,
             checklist: checklist, deleted: deleted, createdAt: nil, updatedAt: nil)
    }

    private func makeItem(_ id: String, _ name: String, category: String? = nil, weight: Double = 100) -> PackItem {
        PackItem(id: id, packId: "p1", name: name, description: nil, weight: weight, weightUnit: .g,
                 quantity: 1, category: category, consumable: false, worn: false, image: nil, notes: nil,
                 catalogItemId: nil, userId: nil, deleted: false, isAIGenerated: nil,
                 templateItemId: nil, createdAt: nil, updatedAt: nil)
    }

    private func makePack(_ items: [PackItem]) -> Pack {
        Pack(id: "p1", userId: nil, name: "Pack", description: nil, category: nil, isPublic: false,
             image: nil, tags: nil, templateId: nil, deleted: false, isAIGenerated: nil, items: items,
             totalWeight: nil, baseWeight: nil, wornWeight: nil, consumableWeight: nil,
             createdAt: nil, updatedAt: nil)
    }

    private func plan(now: Date, pack: Pack? = nil, packed: Set<String> = [], trip: Trip? = nil) -> [TripReminder] {
        TripReminderPlanner.reminders(for: trip ?? makeTrip(start: start), pack: pack,
                                      packedItemIds: packed, now: now, calendar: calendar)
    }

    @Test("schedules all four moments at their local times when the trip is far out")
    func fullCountdown() {
        let reminders = plan(now: date(2026, 10, 1, 12))
        #expect(reminders.map(\.moment) == [.weekBefore, .threeDaysBefore, .eveningBefore, .morningOf])
        #expect(reminders.map(\.fireDate) == [
            date(2026, 10, 13, 9), date(2026, 10, 17, 9), date(2026, 10, 19, 19), date(2026, 10, 20, 7),
        ])
    }

    @Test("a trip planned at short notice gets only the reminders still ahead")
    func shortNotice() {
        #expect(plan(now: date(2026, 10, 18, 12)).map(\.moment) == [.eveningBefore, .morningOf])
        #expect(plan(now: date(2026, 10, 20, 7)).isEmpty)
    }

    @Test("no start date, or a deleted trip, gets nothing")
    func noDateNoReminders() {
        let now = date(2026, 10, 1, 12)
        #expect(plan(now: now, trip: makeTrip(start: nil)).isEmpty)
        #expect(plan(now: now, trip: makeTrip(start: start, deleted: true)).isEmpty)
    }

    @Test("evening-before names unpacked gear most-important first, and what to charge")
    func eveningBeforeCopy() {
        let pack = makePack([
            makeItem("1", "Bandana", category: "Clothing"),
            makeItem("2", "Tent", category: "Shelter"),
            makeItem("3", "Headlamp", category: "Lighting"),
            makeItem("4", "Stove", category: "Cooking"),
        ])
        let evening = plan(now: date(2026, 10, 19, 12), pack: pack, packed: ["4"]).first { $0.moment == .eveningBefore }
        #expect(evening?.title == "Enchantments is tomorrow")
        #expect(evening?.body == "Still unpacked: tent, bandana and headlamp. Charge tonight: headlamp.")
    }

    @Test("a fully packed pack is told so instead of told to pack")
    func fullyPacked() {
        let pack = makePack([makeItem("1", "Tent")])
        let three = plan(now: date(2026, 10, 1, 12), pack: pack, packed: ["1"]).first { $0.moment == .threeDaysBefore }
        #expect(three?.body == "You're all packed.")
    }

    @Test("a trip with no linked pack is invited to link one")
    func noPack() {
        let week = plan(now: date(2026, 10, 1, 12)).first { $0.moment == .weekBefore }
        #expect(week?.body == "Link a pack to start getting ready.")
    }

    @Test("list names three and counts the rest")
    func listSummary() {
        #expect(TripReminderPlanner.list(["A"]) == "a")
        #expect(TripReminderPlanner.list(["A", "B"]) == "a and b")
        #expect(TripReminderPlanner.list(["A", "B", "C", "D", "E"]) == "a, b, c and 2 more")
    }

    @Test("the readiness summary shows from a week out until the start day ends")
    func departureWindow() {
        let trip = makeTrip(start: start)
        #expect(!TripReminderPlanner.isDepartureNear(trip, now: date(2026, 10, 12, 23), calendar: calendar))
        #expect(TripReminderPlanner.isDepartureNear(trip, now: date(2026, 10, 13, 0), calendar: calendar))
        #expect(TripReminderPlanner.isDepartureNear(trip, now: date(2026, 10, 20, 23), calendar: calendar))
        #expect(!TripReminderPlanner.isDepartureNear(trip, now: date(2026, 10, 21, 0), calendar: calendar))
        #expect(!TripReminderPlanner.isDepartureNear(makeTrip(start: nil), now: start, calendar: calendar))
    }

    @Test("days until start counts calendar days, not 24-hour spans")
    func daysUntilStart() {
        let trip = makeTrip(start: start)
        #expect(TripReminderPlanner.daysUntilStart(trip, now: date(2026, 10, 19, 23), calendar: calendar) == 1)
        #expect(TripReminderPlanner.daysUntilStart(trip, now: date(2026, 10, 20, 12), calendar: calendar) == 0)
        #expect(TripReminderPlanner.daysUntilStart(trip, now: date(2026, 10, 17, 9), calendar: calendar) == 3)
    }

    @Test("unticked Before-you-go tasks join the evening-before reminder and lead the morning-of one")
    func beforeYouGoCopy() {
        let trip = makeTrip(start: start, packId: nil, checklist: [
            TripChecklistItem(id: "a", title: "Permit", done: true),
            TripChecklistItem(id: "b", title: "Park pass", done: false),
            TripChecklistItem(id: "c", title: "Campsite reservation", done: false),
        ])
        let reminders = plan(now: date(2026, 10, 19, 12), trip: trip)
        let evening = reminders.first { $0.moment == .eveningBefore }
        let morning = reminders.first { $0.moment == .morningOf }
        #expect(evening?.body == "Link a pack to run a final check. Before you go: park pass and campsite reservation.")
        #expect(morning?.body == "Don't forget: park pass.")
    }

    @Test("a ticked-off Before-you-go list adds nothing to the reminders")
    func beforeYouGoAllDone() {
        let trip = makeTrip(start: start, packId: nil, checklist: [
            TripChecklistItem(id: "a", title: "Permit", done: true),
        ])
        let evening = plan(now: date(2026, 10, 19, 12), trip: trip).first { $0.moment == .eveningBefore }
        #expect(evening?.body == "Link a pack to run a final check.")
    }

    @Test("suggestions offer a campsite booking only for overnight trips and skip what's already listed")
    func checklistSuggestions() {
        let dayHike = makeTrip(start: start, end: start)
        #expect(TripReminderPlanner.checklistSuggestions(for: dayHike, calendar: calendar)
            == ["Permit", "Park pass", "Share your plans with someone"])

        let overnight = makeTrip(start: start, end: date(2026, 10, 22, 12), checklist: [
            TripChecklistItem(id: "a", title: "permit", done: false),
        ])
        #expect(TripReminderPlanner.checklistSuggestions(for: overnight, calendar: calendar)
            == ["Park pass", "Campsite reservation", "Share your plans with someone"])
    }
}
