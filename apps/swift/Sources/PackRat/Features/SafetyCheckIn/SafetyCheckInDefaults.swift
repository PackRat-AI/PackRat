import Foundation

/// Pre-fills for the start-trip sheet, so starting a check-in takes seconds.
enum SafetyCheckInDefaults {
    /// Evening of the trip's last day: 7 PM on the end date, or the start date
    /// for a one-day trip. Falls back to eight hours from now when that's
    /// already past or the trip has no dates.
    static func expectedReturn(for trip: Trip, now: Date = Date(), calendar: Calendar = .current) -> Date {
        let lastDay = trip.endDate?.toDate() ?? trip.startDate?.toDate()
        if let lastDay,
           let evening = calendar.date(bySettingHour: 19, minute: 0, second: 0, of: lastDay),
           evening > now.addingTimeInterval(60 * 60) {
            return evening
        }
        let fallback = now.addingTimeInterval(8 * 60 * 60)
        // Round up to the next quarter hour so the picker shows a tidy time.
        let minute = calendar.component(.minute, from: fallback)
        let roundUp = (15 - minute % 15) % 15
        return calendar.date(byAdding: .minute, value: roundUp, to: fallback)
            .flatMap { calendar.date(bySetting: .second, value: 0, of: $0) } ?? fallback
    }

    private static let identifyingKinds: [(keywords: [String], rank: Int)] = [
        (["tent", "shelter", "tarp", "bivy", "hammock"], 0),
        (["jacket", "shell", "parka", "hoodie", "anorak", "rain"], 1),
        (["backpack", "rucksack"], 2),
        (["hat", "cap", "beanie"], 3),
    ]

    /// Gear someone could spot from a distance — shelter, outer layer, pack —
    /// picked from the trip's pack by name and category. At most four.
    static func identifyingGear(from items: [PackItem]) -> [IdentifyingGearItem] {
        let ranked = items.compactMap { item -> (PackItem, Int)? in
            let haystack = "\(item.name) \(item.category ?? "")".lowercased()
            guard let kind = identifyingKinds.first(where: { kind in
                kind.keywords.contains { haystack.contains($0) }
            }) else { return nil }
            return (item, kind.rank)
        }
        var seenRanks = Set<Int>()
        return ranked
            .sorted { $0.1 < $1.1 }
            .filter { seenRanks.insert($0.1).inserted }
            .prefix(4)
            .map { IdentifyingGearItem(name: $0.0.name, note: nil) }
    }

    /// The text the contacts will receive, shown before sending.
    static func previewMessage(
        userName: String, tripName: String, expectedReturn: Date, gear: [IdentifyingGearItem]
    ) -> String {
        let carrying = gear
            .map { item -> String in
                let name = item.name.trimmingCharacters(in: .whitespaces)
                let note = item.note?.trimmingCharacters(in: .whitespaces) ?? ""
                return note.isEmpty ? name : "\(note) \(name)"
            }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
        let when = expectedReturn.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated).hour().minute())
        var text = "\(userName) has started their trip: \(tripName). Expected return: \(when)."
        if !carrying.isEmpty { text += " They are carrying: \(carrying)." }
        return text + " Track live progress: [link]"
    }
}
