import Foundation
import Testing
@testable import PackRat

@Suite("TripReminderSettings")
@MainActor
struct TripReminderSettingsTests {
    private func makeDefaults() -> UserDefaults {
        let name = "TripReminderSettingsTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: name)!
        defaults.removePersistentDomain(forName: name)
        return defaults
    }

    @Test("reminders are on by default for every trip")
    func defaultsOn() {
        let settings = TripReminderSettings(defaults: makeDefaults())
        #expect(settings.isEnabled == true)
        #expect(settings.remindersOn(for: "t1") == true)
    }

    @Test("muting one trip leaves the others on, and survives a relaunch")
    func perTripMute() {
        let defaults = makeDefaults()
        TripReminderSettings(defaults: defaults).setMuted(true, tripId: "t1")

        let reloaded = TripReminderSettings(defaults: defaults)
        #expect(reloaded.remindersOn(for: "t1") == false)
        #expect(reloaded.remindersOn(for: "t2") == true)

        reloaded.setMuted(false, tripId: "t1")
        #expect(TripReminderSettings(defaults: defaults).mutedTripIds.isEmpty)
    }

    @Test("the global switch turns every trip off and persists")
    func globalSwitch() {
        let defaults = makeDefaults()
        TripReminderSettings(defaults: defaults).isEnabled = false
        let reloaded = TripReminderSettings(defaults: defaults)
        #expect(reloaded.isEnabled == false)
        #expect(reloaded.remindersOn(for: "t1") == false)
    }
}
