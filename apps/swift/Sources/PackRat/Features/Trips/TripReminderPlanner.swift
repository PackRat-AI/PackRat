import Foundation

/// One pre-trip reminder: when it fires and what it says.
struct TripReminder: Equatable, Sendable {
    enum Moment: String, CaseIterable, Sendable {
        case weekBefore, threeDaysBefore, eveningBefore, morningOf
    }

    let tripId: String
    let moment: Moment
    let fireDate: Date
    let title: String
    let body: String

    var identifier: String { "\(TripReminderPlanner.identifierPrefix)\(tripId).\(moment.rawValue)" }
}

/// Decides which pre-trip reminders a trip gets and writes their copy from the
/// trip's current packing state. Pure, so the countdown and the wording are
/// testable without a notification center. Product behaviour:
/// docs/features/pre-trip-reminders.md.
enum TripReminderPlanner {
    static let flagKey = "enableTripReminders"
    static let identifierPrefix = "trip-reminder."

    /// Local hours each moment fires at. The 7- and 3-day reminders land
    /// mid-morning; the evening-before one leaves time to charge overnight.
    static let daytimeHour = 9
    static let eveningHour = 19
    static let morningHour = 7

    /// How many unpacked items a reminder names before summarising the rest.
    static let namedItemLimit = 3

    static func reminders(
        for trip: Trip,
        pack: Pack?,
        packedItemIds: Set<String>,
        now: Date,
        calendar: Calendar = .current
    ) -> [TripReminder] {
        guard !trip.deleted, let start = trip.startDate?.toDate() else { return [] }
        let startDay = calendar.startOfDay(for: start)
        let state = PackState(pack: pack, packedItemIds: packedItemIds)

        return TripReminder.Moment.allCases.compactMap { moment in
            guard let fireDate = fireDate(for: moment, startDay: startDay, calendar: calendar),
                  fireDate > now
            else { return nil }
            let (title, body) = copy(for: moment, tripName: trip.name, state: state)
            return TripReminder(tripId: trip.id, moment: moment, fireDate: fireDate, title: title, body: body)
        }
    }

    /// The readiness summary shows from the first reminder until the start day ends.
    static func isDepartureNear(_ trip: Trip, now: Date, calendar: Calendar = .current) -> Bool {
        guard !trip.deleted, let start = trip.startDate?.toDate() else { return false }
        let startDay = calendar.startOfDay(for: start)
        guard let opens = calendar.date(byAdding: .day, value: -7, to: startDay),
              let closes = calendar.date(byAdding: .day, value: 1, to: startDay)
        else { return false }
        return now >= opens && now < closes
    }

    /// Whole days from today to the trip's start day; 0 on the day itself.
    static func daysUntilStart(_ trip: Trip, now: Date, calendar: Calendar = .current) -> Int? {
        guard let start = trip.startDate?.toDate() else { return nil }
        return calendar.dateComponents(
            [.day], from: calendar.startOfDay(for: now), to: calendar.startOfDay(for: start)
        ).day
    }

    static func fireDate(for moment: TripReminder.Moment, startDay: Date, calendar: Calendar) -> Date? {
        let (dayOffset, hour): (Int, Int) = switch moment {
        case .weekBefore: (-7, daytimeHour)
        case .threeDaysBefore: (-3, daytimeHour)
        case .eveningBefore: (-1, eveningHour)
        case .morningOf: (0, morningHour)
        }
        guard let day = calendar.date(byAdding: .day, value: dayOffset, to: startDay) else { return nil }
        return calendar.date(bySettingHour: hour, minute: 0, second: 0, of: day)
    }

    // MARK: - Copy

    private static func copy(for moment: TripReminder.Moment, tripName: String, state: PackState) -> (String, String) {
        switch moment {
        case .weekBefore:
            let body: String = switch state.progress {
            case .noPack: "Link a pack to start getting ready."
            case .empty: "Your pack is empty — add what you're bringing."
            case .done: "You're all packed already. Nice."
            case .partial(let packed, let total): "Review your pack — \(packed) of \(total) items packed."
            }
            return ("\(tripName) is next week", body)

        case .threeDaysBefore:
            let body: String = switch state.progress {
            case .noPack: "Link a pack so you can start packing."
            case .empty: "Your pack is empty — add what you're bringing."
            case .done: "You're all packed."
            case .partial(0, let total): "Time to start packing — \(total) items to go."
            case .partial(let packed, let total):
                "You've packed \(packed * 100 / total)%. Still to pack: \(list(state.unpacked))."
            }
            return ("\(tripName) starts in 3 days", body)

        case .eveningBefore:
            var lines: [String] = []
            switch state.progress {
            case .noPack: lines.append("Link a pack to run a final check.")
            case .empty: lines.append("Your pack is empty.")
            case .done: lines.append("You're all packed.")
            case .partial: lines.append("Still unpacked: \(list(state.unpacked)).")
            }
            if !state.chargeable.isEmpty {
                lines.append("Charge tonight: \(list(state.chargeable)).")
            }
            return ("\(tripName) is tomorrow", lines.joined(separator: " "))

        case .morningOf:
            let body: String = if let first = state.unpacked.first {
                "Don't forget your \(first.lowercased())!"
            } else if let first = state.chargeable.first {
                "Grab your \(first.lowercased()) off the charger."
            } else {
                "\(tripName) starts today. Enjoy it."
            }
            return ("Have a great trip!", body)
        }
    }

    /// "a, b, c and 4 more" — names the first few, counts the rest.
    static func list(_ names: [String]) -> String {
        let named = names.prefix(namedItemLimit).map { $0.lowercased() }
        let rest = names.count - named.count
        if rest > 0 { return named.joined(separator: ", ") + " and \(rest) more" }
        guard named.count > 1 else { return named.first ?? "" }
        return named.dropLast().joined(separator: ", ") + " and " + named[named.count - 1]
    }
}

// MARK: - Pack state

extension TripReminderPlanner {
    struct PackState {
        enum Progress: Equatable {
            case noPack, empty, done
            case partial(packed: Int, total: Int)
        }

        let progress: Progress
        /// Unpacked item names, most important first.
        let unpacked: [String]
        /// Battery-powered gear in the pack, packed or not — it still needs a charge.
        let chargeable: [String]

        init(pack: Pack?, packedItemIds: Set<String>) {
            guard let pack else {
                progress = .noPack; unpacked = []; chargeable = []
                return
            }
            let items = pack.activeItems
            let remaining = items.filter { !packedItemIds.contains($0.id) }
            if items.isEmpty {
                progress = .empty
            } else if remaining.isEmpty {
                progress = .done
            } else {
                progress = .partial(packed: items.count - remaining.count, total: items.count)
            }
            unpacked = remaining
                .sorted { (priorityRank($0), -$0.weight) < (priorityRank($1), -$1.weight) }
                .map(\.name)
            chargeable = items.filter(isChargeable).map(\.name)
        }
    }

    /// Categories that end a trip if forgotten come first: shelter, sleep and
    /// water ahead of a spare bandana.
    private static let priorityCategories = [
        "shelter", "tent", "sleep", "water", "navigation", "first aid", "cook", "food", "cloth",
    ]

    static func priorityRank(_ item: PackItem) -> Int {
        let haystack = "\(item.category ?? "") \(item.name)".lowercased()
        return priorityCategories.firstIndex { haystack.contains($0) } ?? priorityCategories.count
    }

    private static let chargeableKeywords = [
        "phone", "headlamp", "flashlight", "lantern", "gps", "power bank", "powerbank",
        "battery", "camera", "inreach", "satellite", "communicator", "watch", "radio",
        "speaker", "e-reader", "kindle", "drone",
    ]

    static func isChargeable(_ item: PackItem) -> Bool {
        let name = item.name.lowercased()
        if item.category?.lowercased().contains("electronic") == true { return true }
        return chargeableKeywords.contains { name.contains($0) }
    }
}
