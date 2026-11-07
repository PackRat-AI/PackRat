#if os(iOS)
import AppIntents
import Foundation

/// The trip commands Siri can run by name: "Hey Siri, ask PackRat where am I",
/// or "ask PackRat to start my trip".
enum TripVoiceAction: String, AppEnum {
    case startTrip
    case whereAmI
    case howFarToGo
    case amIOnRoute
    case howFarHaveIGone
    case whenAmIDue
    case weather
    case markWaypoint
    case startTracking
    case pauseTracking
    case resumeTracking
    case stopTracking
    case stopNavigating
    case checkIn
    case imSafe

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Trip Command"

    static let caseDisplayRepresentations: [TripVoiceAction: DisplayRepresentation] = [
        .startTrip: DisplayRepresentation(title: "Start my trip", synonyms: ["start the trip", "start trip", "begin my trip"]),
        .whereAmI: DisplayRepresentation(title: "Where am I", synonyms: ["where I am", "my location"]),
        .howFarToGo: DisplayRepresentation(title: "How far to go", synonyms: ["how much further", "how far is left"]),
        .amIOnRoute: DisplayRepresentation(title: "Am I on route", synonyms: ["am I on track", "am I off route"]),
        .howFarHaveIGone: DisplayRepresentation(title: "How far have I gone", synonyms: ["how far I've gone", "distance so far"]),
        .whenAmIDue: DisplayRepresentation(title: "When am I due back", synonyms: ["when I'm due back", "my return time"]),
        .weather: DisplayRepresentation(title: "Weather", synonyms: ["the weather", "the forecast"]),
        .markWaypoint: DisplayRepresentation(title: "Mark waypoint", synonyms: ["mark a waypoint", "drop a waypoint"]),
        .startTracking: DisplayRepresentation(title: "Start tracking", synonyms: ["start recording", "track my hike"]),
        .pauseTracking: DisplayRepresentation(title: "Pause tracking", synonyms: ["pause recording"]),
        .resumeTracking: DisplayRepresentation(title: "Resume tracking", synonyms: ["resume recording"]),
        .stopTracking: DisplayRepresentation(title: "Stop tracking", synonyms: ["stop recording"]),
        .stopNavigating: DisplayRepresentation(title: "Stop navigating", synonyms: ["stop navigation", "stop guidance"]),
        .checkIn: DisplayRepresentation(title: "Check in", synonyms: ["send a check-in"]),
        .imSafe: DisplayRepresentation(title: "I'm safe", synonyms: ["I'm back", "end my trip"]),
    ]

    var command: VoiceCommand {
        switch self {
        case .startTrip: .startTrip
        case .whereAmI: .whereAmI
        case .howFarToGo: .howFarToGo
        case .amIOnRoute: .amIOnRoute
        case .howFarHaveIGone: .trackSoFar
        case .whenAmIDue: .whenAmIDue
        case .weather: .weather
        case .markWaypoint: .markWaypoint(name: nil)
        case .startTracking: .startTracking
        case .pauseTracking: .pauseTracking
        case .resumeTracking: .resumeTracking
        case .stopTracking: .stopTracking
        case .stopNavigating: .stopNavigating
        case .checkIn: .checkIn
        case .imSafe: .imSafe
        }
    }
}

/// "Hey Siri, ask PackRat where am I", from the lock screen or a headset.
struct TripCommandIntent: AppIntent, ForegroundContinuableIntent {
    static let title: LocalizedStringResource = "Trip Command"
    static let description = IntentDescription("Runs a command on the trip you're on, such as where am I or mark waypoint.")

    @Parameter(title: "Command")
    var action: TripVoiceAction

    init() {}

    init(action: TripVoiceAction) {
        self.action = action
    }

    static var parameterSummary: some ParameterSummary {
        Summary("Ask PackRat \(\.$action)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let answer = try await SiriTripCommand.run(.command(action.command), intent: self)
        return .result(dialog: IntentDialog(stringLiteral: answer))
    }
}

/// "Hey Siri, ask PackRat", then any command in the user's own words.
struct AskPackRatIntent: AppIntent, ForegroundContinuableIntent {
    static let title: LocalizedStringResource = "Ask PackRat"
    static let description = IntentDescription("Say a command for the trip you're on, in your own words.")

    @Parameter(title: "Request", requestValueDialog: "What should PackRat do?")
    var request: String

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let answer = try await SiriTripCommand.run(.spoken(request), intent: self)
        return .result(dialog: IntentDialog(stringLiteral: answer))
    }
}

/// Shared by both intents: find the trip, run the command, and ask Siri's
/// own yes-or-no question for anything that tells other people something.
@MainActor
enum SiriTripCommand {
    static func run<Intent: ForegroundContinuableIntent>(_ request: VoiceCommandController.SiriRequest, intent: Intent) async throws -> String {
        guard FeatureFlagStore.shared.isEnabled(VoiceCommandSettings.flagKey) else { return VoiceAnswers.noTrip }
        // Siri can wake PackRat with nothing on screen; the trips load with the app.
        if !VoiceCommandHost.shared.isAttached {
            try await intent.requestToContinueInForeground(IntentDialog(stringLiteral: VoiceAnswers.openingPackRat))
            for _ in 0..<20 where !VoiceCommandHost.shared.isAttached || VoiceCommandHost.shared.trips.isEmpty {
                try await Task.sleep(for: .milliseconds(250))
            }
        }
        guard let context = VoiceCommandHost.shared.context() else { return VoiceAnswers.noTrip }
        return await VoiceCommandController.shared.runForSiri(request, context) { question in
            await confirm(question, intent: intent)
        }
    }

    private static func confirm<Intent: AppIntent>(_ question: String, intent: Intent) async -> Bool {
        do {
            if #available(iOS 18.0, *) {
                try await intent.requestConfirmation(actionName: .send, dialog: IntentDialog(stringLiteral: question))
            } else {
                try await intent.requestConfirmation(
                    result: .result(dialog: IntentDialog(stringLiteral: question)),
                    confirmationActionName: .send
                )
            }
            return true
        } catch {
            return false
        }
    }
}

struct PackRatShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: TripCommandIntent(),
            phrases: [
                "Ask \(.applicationName) \(\.$action)",
                "Ask \(.applicationName) to \(\.$action)",
                "Tell \(.applicationName) to \(\.$action)",
                "Tell \(.applicationName) \(\.$action)",
                "\(.applicationName) \(\.$action)",
            ],
            shortTitle: "Trip Command",
            systemImageName: "figure.hiking"
        )
        AppShortcut(
            intent: AskPackRatIntent(),
            phrases: [
                "Ask \(.applicationName)",
                "Talk to \(.applicationName)",
            ],
            shortTitle: "Ask PackRat",
            systemImageName: "waveform"
        )
    }

    static let shortcutTileColor: ShortcutTileColor = .lime
}
#endif
