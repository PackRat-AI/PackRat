import Foundation

/// Pure mapping helpers shared by the phone (which builds snapshots) and the
/// watch (which renders and mutates them).
///
/// These deliberately take plain values rather than app models or `WCSession`,
/// so the two behaviours issues #2694/#2718/#2719 turn on — packed state and
/// the temperature unit — are testable without a paired device.
enum WatchSnapshotBuilder {
    /// How many checklist rows a watch snapshot carries. The watch screen is a
    /// glanceable summary, not the full pack, so the list is capped.
    ///
    /// The cap applies to the *rows sent*, never to the counts: `packedItemCount`
    /// and `totalItemCount` describe the whole pack. Counting only the first
    /// `checklistLimit` items is what made the watch disagree with the phone in
    /// #2718 for any pack larger than the window.
    static let checklistLimit = 8

    /// One pack item, reduced to what the checklist mapping needs.
    struct Item: Equatable, Sendable {
        var id: String
        var name: String
        var category: String?

        init(id: String, name: String, category: String?) {
            self.id = id
            self.name = name
            self.category = category
        }
    }

    /// Maps pack items to checklist rows, reading real packed state from
    /// `isPacked` rather than assuming everything is packed (#2694 defect 1).
    static func makeChecklist(
        from items: [Item],
        isPacked: (String) -> Bool
    ) -> [WatchChecklistItemSnapshot] {
        items.prefix(checklistLimit).map { item in
            WatchChecklistItemSnapshot(
                id: item.id,
                title: item.name,
                symbolName: symbol(for: item.category),
                isPacked: isPacked(item.id)
            )
        }
    }

    /// Packed count across *every* item in the pack, not just the rows that fit
    /// on the watch — this is the number the phone shows.
    static func packedCount(in items: [Item], isPacked: (String) -> Bool) -> Int {
        items.reduce(into: 0) { count, item in
            if isPacked(item.id) { count += 1 }
        }
    }

    /// Builds the pack half of a snapshot with counts and checklist in step.
    static func makePackSnapshot(
        packId: String?,
        name: String,
        baseWeightText: String,
        items: [Item],
        isPacked: (String) -> Bool
    ) -> WatchPackSnapshot {
        WatchPackSnapshot(
            packId: packId,
            name: name,
            baseWeightText: baseWeightText,
            packedItemCount: packedCount(in: items, isPacked: isPacked),
            totalItemCount: items.count,
            checklist: makeChecklist(from: items, isPacked: isPacked)
        )
    }

    static func symbol(for category: String?) -> String {
        switch category?.lowercased() {
        case "shelter": return "tent"
        case "sleep": return "bed.double"
        case "water": return "drop"
        case "food": return "fork.knife"
        case "clothing": return "jacket"
        case "safety": return "cross.case"
        case "kitchen": return "flame"
        case "pack": return "backpack"
        default: return "checkmark.circle"
        }
    }
}

/// The temperature unit a snapshot's `temperatureText` was rendered in.
///
/// The watch renders whatever string the phone sends, so honouring the phone's
/// unit preference (#2719) is a phone-side formatting concern. This mirrors
/// `AppPreferences.TemperatureUnit` in a target both apps can see; the raw
/// values match so the phone's `@AppStorage("temperatureUnit")` string maps
/// straight across.
enum WatchTemperatureUnit: String, CaseIterable, Codable, Sendable {
    case fahrenheit = "°F"
    case celsius = "°C"

    /// Reads the phone's stored preference, falling back to the same default
    /// the phone uses when nothing has been chosen.
    static func fromDefaults(
        _ defaults: UserDefaults = .standard,
        key: String = "temperatureUnit"
    ) -> WatchTemperatureUnit {
        guard let raw = defaults.string(forKey: key),
              let unit = WatchTemperatureUnit(rawValue: raw)
        else { return .fahrenheit }
        return unit
    }

    /// Formats a temperature in the requested unit, converting when the API only
    /// supplied the other scale. Returns `"--"` when neither is available.
    ///
    /// Matches the phone's `formattedTemperature` in ForecastRow.swift, so the
    /// two surfaces round identically instead of drifting by a degree.
    func format(celsius: Double?, fahrenheit: Double?) -> String {
        let value: Double?
        switch self {
        case .celsius:
            value = celsius ?? fahrenheit.map { ($0 - 32) * 5 / 9 }
        case .fahrenheit:
            value = fahrenheit ?? celsius.map { ($0 * 9 / 5) + 32 }
        }
        guard let value else { return "--" }
        return "\(Int(value.rounded()))°"
    }
}
