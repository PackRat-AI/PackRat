import Foundation
import Observation

/// The user's two pre-trip reminder controls: the app-wide Trip Reminders
/// switch, and the set of trips whose reminders they turned off.
///
/// Device-local, like the reminders themselves: they are local notifications
/// scheduled per device, and so is the packing state they're written from.
@Observable
@MainActor
final class TripReminderSettings {
    static let shared = TripReminderSettings()

    static let enabledKey = "tripRemindersEnabled"
    static let mutedTripsKey = "tripRemindersMutedTripIds"

    private let defaults: UserDefaults

    /// On by default: the feature flag is the gate, this is the user's say.
    var isEnabled: Bool {
        didSet { defaults.set(isEnabled, forKey: Self.enabledKey) }
    }

    private(set) var mutedTripIds: Set<String>

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        isEnabled = defaults.object(forKey: Self.enabledKey) as? Bool ?? true
        mutedTripIds = Set(defaults.stringArray(forKey: Self.mutedTripsKey) ?? [])
    }

    func isMuted(_ tripId: String) -> Bool {
        mutedTripIds.contains(tripId)
    }

    /// Whether this trip's reminders would be sent, ignoring the feature flag.
    func remindersOn(for tripId: String) -> Bool {
        isEnabled && !isMuted(tripId)
    }

    func setMuted(_ muted: Bool, tripId: String) {
        if muted { mutedTripIds.insert(tripId) } else { mutedTripIds.remove(tripId) }
        defaults.set(mutedTripIds.sorted(), forKey: Self.mutedTripsKey)
    }
}
