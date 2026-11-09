#if os(iOS)
import AppIntents
import SwiftUI

/// Things to try saying, picked for where the trip is, so the hint under
/// Hold to Talk teaches the command that's useful right now.
enum VoiceExamples {
    static func current(lifecycle: TripStatus, tracking: Bool, guiding: Bool, hasCheckIn: Bool, hasRoute: Bool) -> [String] {
        guard lifecycle == .inProgress else { return ["start my trip", "what's the weather", "where am I"] }
        var examples = ["mark waypoint", "where am I"]
        examples += tracking ? ["how far have I gone", "pause tracking"] : ["start tracking"]
        if guiding {
            examples += ["how far to go", "am I on route", "stop navigating"]
        } else if hasRoute {
            examples += ["take me back to the trailhead"]
        }
        if hasCheckIn { examples += ["when am I due back", "add an hour"] }
        return examples
    }
}

/// Everything PackRat understands, grouped the way a hike goes. Opened from
/// the hint under Hold to Talk, and from the Voice settings.
struct VoiceCommandsList: View {
    @AppStorage(VoiceCommandSettings.wakeWordKey) private var wakeWordOn = false

    private struct Group: Identifiable {
        let title: String
        let symbol: String
        let phrases: [String]
        var footer: String?
        var id: String { title }
    }

    private let groups = [
        Group(title: "Your Trip", symbol: "figure.hiking", phrases: ["Start my trip", "Where am I?", "What's the weather?", "When am I due back?"]),
        Group(title: "Tracking", symbol: "point.bottomleft.forward.to.point.topright.scurvepath", phrases: ["Start tracking", "Pause tracking", "Resume tracking", "Stop tracking", "How far have I gone?"]),
        Group(title: "Waypoints and Notes", symbol: "mappin.and.ellipse", phrases: ["Mark waypoint", "Mark waypoint water source", "Note: trail washed out past the bridge"]),
        Group(title: "Directions", symbol: "location.north.line", phrases: ["Navigate to water source", "Take me back to the trailhead", "How far to go?", "Am I on route?", "Stop navigating"]),
        Group(
            title: "Your Contacts", symbol: "person.2", phrases: ["Check in", "Add an hour", "I'll be back at 8", "I'm safe"],
            footer: "PackRat reads these back and waits for you to say yes before it tells anyone."
        ),
    ]

    var body: some View {
        List {
            ForEach(groups) { group in
                Section {
                    ForEach(group.phrases, id: \.self) { phrase in
                        Text("“\(phrase)”")
                    }
                } header: {
                    Label(group.title, systemImage: group.symbol)
                } footer: {
                    if let footer = group.footer { Text(footer) }
                }
            }
            Section {
                Toggle("“Hey PackRat”", isOn: $wakeWordOn)
                    .accessibilityIdentifier("voice_commands_wake_word_toggle")
                    .onChange(of: wakeWordOn) { _, on in
                        if on, VoiceListener.needsPermission {
                            Task { try? await VoiceListener.requestPermissions() }
                        }
                    }
            } header: {
                Text("Hands-Free")
            } footer: {
                Text("While your trip is underway, say “Hey PackRat” and a command, even with your phone locked.")
            }
            Section {
                ShortcutsLink()
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
            } header: {
                Text("Siri")
            } footer: {
                Text("Say “Hey Siri, ask PackRat where am I” from the lock screen or with AirPods.")
            }
        }
        .navigationTitle("What You Can Say")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// The list as a sheet, from the trip page.
struct VoiceCommandsSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VoiceCommandsList()
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { dismiss() }
                    }
                }
        }
    }
}
#endif
