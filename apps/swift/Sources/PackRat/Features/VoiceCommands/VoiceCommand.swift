import Foundation

/// One thing the user can say to PackRat during a trip.
enum VoiceCommand: Equatable, Sendable {
    case startTrip
    case checkIn
    case imSafe
    /// Push the expected return back by an amount ("add two hours").
    case extendBy(minutes: Int)
    /// Move the expected return to a time of day ("I'll be back at eight").
    case extendUntil(hour: Int, minute: Int)
    case whereAmI
    case howFarToGo
    case amIOnRoute
    case whenAmIDue
    case weather
    case startTracking
    case pauseTracking
    case resumeTracking
    case stopTracking
    /// "How far have I gone": the recording's totals so far.
    case trackSoFar
    /// "Mark waypoint", or "mark waypoint water source" with a name.
    case markWaypoint(name: String?)
    /// "Note: trail washed out past the bridge", in the user's own words.
    case note(text: String)
    /// "Navigate to camp": the place as said, matched against the trip later.
    case navigate(to: String)
    case stopNavigating

    /// Commands that tell other people something, so they're read back and
    /// need a spoken yes before they run.
    var needsConfirmation: Bool {
        switch self {
        case .checkIn, .imSafe, .extendBy, .extendUntil: true
        default: false
        }
    }
}

extension VoiceCommand {
    /// The command's name for logs, never the user's own words.
    var logName: String {
        switch self {
        case .note: "note"
        case .markWaypoint: "markWaypoint"
        case .navigate: "navigate"
        case .extendBy: "extendBy"
        case .extendUntil: "extendUntil"
        default: String(describing: self)
        }
    }
}

/// A spoken answer to a "Send it?" question.
enum VoiceConfirmation: Equatable, Sendable {
    case yes
    case no
}

/// Turns what the recogniser heard into a command.
///
/// Matching is phrase-based rather than fuzzy: a command that sends something
/// must never be guessed at, so anything not clearly one of these is nil.
enum VoiceCommandParser {
    static func parse(_ transcript: String) -> VoiceCommand? {
        let text = normalize(transcript)
        guard !text.isEmpty else { return nil }

        // A note is the user's own words, so it's caught before anything in
        // them ("note: I'm safe at camp") can read as a command.
        if let note = parseNote(transcript) { return .note(text: note) }
        if let navigation = parseNavigation(text) { return navigation }
        if let waypoint = parseWaypoint(text) { return waypoint }
        if let tracking = parseTracking(text) { return tracking }

        // Return-time changes first: "I'll be back at eight" must not read as
        // a check-in, and "add an hour" must not fall through to nothing.
        if let extend = parseExtend(text) { return extend }

        if containsAny(text, ["im safe", "i am safe", "im back", "i am back", "im home", "i am home", "end my trip", "end the trip", "finish my trip", "finish the trip"]) {
            return .imSafe
        }
        if containsAny(text, ["check in", "checkin", "checking in", "send a check", "let them know im ok", "let them know i am ok", "tell them im ok", "tell them i am ok"]) {
            return .checkIn
        }
        if containsAny(text, ["start my trip", "start the trip", "start trip", "begin my trip", "begin the trip"]) {
            return .startTrip
        }
        if containsAny(text, ["on route", "on the route", "on my route", "on track", "off route", "off the route", "off track", "am i lost"]) {
            return .amIOnRoute
        }
        if containsAny(text, ["how far", "how much further", "how much farther", "distance to", "distance left", "miles left", "kilometers left", "km left", "to go"]) {
            return .howFarToGo
        }
        if containsAny(text, ["where am i", "my location", "where are we", "current location"]) {
            return .whereAmI
        }
        if containsAny(text, ["due back", "when am i due", "return time", "when do i need to be back", "overdue"]) {
            return .whenAmIDue
        }
        if containsAny(text, ["weather", "forecast", "going to rain", "going to snow", "temperature"]) {
            return .weather
        }
        return nil
    }

    static func parseConfirmation(_ transcript: String) -> VoiceConfirmation? {
        let text = normalize(transcript)
        let words = Set(text.split(separator: " ").map(String.init))
        // Any hesitation is a no: "I'm not sure" must never send an alert.
        if containsAny(text, ["dont", "do not", "cancel", "stop", "never mind", "nevermind", "hold on"]) || !words.isDisjoint(with: ["no", "nope", "nah", "not", "wait"]) {
            return .no
        }
        if containsAny(text, ["send it", "go ahead", "do it", "confirm"]) || !words.isDisjoint(with: ["yes", "yeah", "yep", "yup", "sure", "ok", "okay", "correct", "send"]) {
            return .yes
        }
        return nil
    }

    // MARK: - Tracking and waypoints

    private static func parseTracking(_ text: String) -> VoiceCommand? {
        let subject = ["tracking", "recording", "my track", "the track", "my hike", "the hike"]
        func verb(_ verbs: [String]) -> Bool {
            verbs.contains { verb in subject.contains { containsAny(text, ["\(verb) \($0)"]) } }
        }
        if verb(["start", "begin", "record", "track"]) || containsAny(text, ["track me", "record my route"]) { return .startTracking }
        if verb(["pause"]) || text == "pause" { return .pauseTracking }
        if verb(["resume", "continue", "restart", "unpause"]) || text == "resume" { return .resumeTracking }
        if verb(["stop", "end", "finish"]) { return .stopTracking }
        if containsAny(text, ["how far have i gone", "how far have i come", "how far have i walked", "how far have i hiked", "how far did i", "distance so far", "so far today"]) {
            return .trackSoFar
        }
        return nil
    }

    private static let navigatePhrases = [
        "navigate to", "navigate back to", "take me to", "take me back to", "guide me to", "guide me back to",
        "directions to", "lead me to", "get me to", "get me back to", "head to", "head back to", "go to", "go back to",
        "way to", "way back to",
    ]

    /// "Navigate to camp", "take me back to the car". Stopping comes first so
    /// "stop navigating to camp" stops rather than starts.
    private static func parseNavigation(_ text: String) -> VoiceCommand? {
        if containsAny(text, ["stop navigating", "stop navigation", "end navigation", "cancel navigation", "stop guidance", "end guidance", "stop directions", "cancel directions", "stop guiding"]) {
            return .stopNavigating
        }
        // "How far to go to camp" is a question, not a request to go there.
        guard !text.hasPrefix("how ") else { return nil }
        let padded = " \(text) "
        guard let phrase = navigatePhrases.first(where: { padded.contains(" \($0) ") }),
              let range = padded.range(of: " \(phrase) ")
        else { return nil }
        return .navigate(to: padded[range.upperBound...].trimmingCharacters(in: .whitespaces))
    }

    private static let waypointPhrases = [
        "mark waypoint", "mark a waypoint", "add waypoint", "add a waypoint", "drop waypoint", "drop a waypoint",
        "save waypoint", "save a waypoint", "new waypoint", "drop a pin", "drop pin", "mark this spot",
        "mark this place", "save this spot", "save this place", "mark the spot",
    ]

    /// The name is whatever follows the phrase: "mark waypoint water source"
    /// is "Water source"; a bare "mark waypoint" has none.
    private static func parseWaypoint(_ text: String) -> VoiceCommand? {
        let padded = " \(text) "
        guard let phrase = waypointPhrases.first(where: { padded.contains(" \($0) ") }),
              let range = padded.range(of: " \(phrase) ")
        else { return nil }
        var words = padded[range.upperBound...].split(separator: " ").map(String.init)
        if ["called", "named", "as"].contains(words.first ?? "") { words.removeFirst() }
        if words == ["here"] { words = [] }
        let name = words.joined(separator: " ")
        return .markWaypoint(name: name.isEmpty ? nil : name.prefix(1).uppercased() + name.dropFirst())
    }

    /// "Note: trail washed out", "take a note the spring is dry". Keeps the
    /// user's own casing and punctuation, only dropping the lead-in. Nil when
    /// it isn't a note; an empty string when it's a note with nothing in it.
    private static func parseNote(_ transcript: String) -> String? {
        let pattern = #"^\s*(?:(?:add|take|make|save|leave)\s+(?:a\s+)?)?note\b[\s:,.\-–—]*"#
        guard let range = transcript.range(of: pattern, options: [.regularExpression, .caseInsensitive]) else { return nil }
        let rest = transcript[range.upperBound...].trimmingCharacters(in: .whitespacesAndNewlines)
        return rest.prefix(1).uppercased() + rest.dropFirst()
    }

    // MARK: - Return time

    private static func parseExtend(_ text: String) -> VoiceCommand? {
        // "back at eight", "back by 7 30", "back at 8 pm"
        if let range = text.range(of: #"back (at|by) (.+)"#, options: .regularExpression) {
            let tail = text[range].split(separator: " ").dropFirst(2).map(String.init)
            if let time = timeOfDay(tail) { return .extendUntil(hour: time.hour, minute: time.minute) }
        }
        // "add an hour", "add two hours", "add 30 minutes", "extend by an hour and a half",
        // "push it back two hours", "give me another hour"
        guard containsAny(text, ["add", "extend", "push", "another", "more time", "running late", "give me"]) else { return nil }
        let words = text.split(separator: " ").map(String.init)
        var minutes = 0
        for (index, word) in words.enumerated() {
            let unit: Int
            if word.hasPrefix("hour") || word == "hr" || word == "hrs" {
                unit = 60
            } else if word.hasPrefix("minute") || word == "min" || word == "mins" {
                unit = 1
            } else {
                continue
            }
            let previous = index > 0 ? words[index - 1] : nil
            // "half an hour", "half hour"
            if unit == 60, previous == "half" || (previous == "an" && index > 1 && words[index - 2] == "half") {
                minutes += 30
                continue
            }
            minutes += (previous.flatMap(number) ?? 1) * unit
            if unit == 60, words.dropFirst(index + 1).starts(with: ["and", "a", "half"]) { minutes += 30 }
        }
        if minutes == 0, containsAny(text, ["running late", "more time"]) { minutes = 60 }
        guard minutes > 0 else { return nil }
        return .extendBy(minutes: min(minutes, 24 * 60))
    }

    /// "eight", "8", "7 30", "8 pm", "seven thirty" → a 24h time. Bare hours
    /// from 1 to 11 are read as afternoon or evening: on the trail, "back at
    /// eight" means tonight.
    private static func timeOfDay(_ words: [String]) -> (hour: Int, minute: Int)? {
        let filtered = words.filter { !["oclock", "o", "clock", "tonight", "this", "evening", "afternoon"].contains($0) }
        guard let first = filtered.first, var hour = number(first), (0...23).contains(hour) else { return nil }
        var minute = 0
        var rest = Array(filtered.dropFirst())
        if let next = rest.first, let value = number(next), (0...59).contains(value) {
            minute = value
            rest.removeFirst()
            // "seven forty five"
            if let unit = rest.first, let ones = number(unit), (1...9).contains(ones), minute % 10 == 0, minute >= 20 {
                minute += ones
                rest.removeFirst()
            }
        }
        let meridiem = rest.first
        if meridiem == "am" || meridiem == "morning" {
            if hour == 12 { hour = 0 }
        } else if meridiem == "pm" || (hour >= 1 && hour <= 11) {
            if hour < 12 { hour += 12 }
        }
        return (hour, minute)
    }

    private static let numberWords: [String: Int] = [
        "a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
        "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "fifteen": 15, "twenty": 20,
        "thirty": 30, "forty": 40, "fortyfive": 45, "fifty": 50, "another": 1, "couple": 2,
    ]

    private static func number(_ word: String) -> Int? {
        Int(word) ?? numberWords[word]
    }

    // MARK: - Text

    /// Lowercase, no punctuation or apostrophes, single spaces, and times like
    /// "7:30" split into "7 30".
    static func normalize(_ transcript: String) -> String {
        let lowered = transcript.lowercased()
            .replacingOccurrences(of: "’", with: "")
            .replacingOccurrences(of: "'", with: "")
            .replacingOccurrences(of: ":", with: " ")
            .replacingOccurrences(of: "-", with: " ")
            .replacingOccurrences(of: "p.m.", with: "pm")
            .replacingOccurrences(of: "a.m.", with: "am")
        let cleaned = lowered.unicodeScalars.map { CharacterSet.alphanumerics.contains($0) ? Character($0) : " " }
        return String(cleaned).split(separator: " ").joined(separator: " ")
    }

    private static func containsAny(_ text: String, _ phrases: [String]) -> Bool {
        // Whole words only, so "add" never matches inside "address".
        let padded = " \(text) "
        return phrases.contains { padded.contains(" \($0) ") }
    }
}

/// Feature flag and the user's switches for voice commands.
@MainActor
enum VoiceCommandSettings {
    static let flagKey = "enableVoiceCommands"
    static let enabledKey = "voiceCommandsEnabled"
    static let spokenAnswersKey = "voiceSpokenAnswers"
    static let turnPromptsKey = "voiceGuidanceTurns"
    static let milestonesKey = "voiceGuidanceMilestones"
    static let offRouteKey = "voiceGuidanceOffRoute"
    static let vibrateOnlyKey = "voiceGuidanceVibrateOnly"
    static let wakeWordKey = "voiceWakeWord"
    static let safetyAlertsSpokenKey = "voiceSafetyAlertsSpoken"
    static let wakeWordOfferedKey = "voiceWakeWordOffered"
    static let siriTipVisibleKey = "voiceSiriTipVisible"

    static var isAvailable: Bool {
        FeatureFlagStore.shared.isEnabled(flagKey)
            && (UserDefaults.standard.object(forKey: enabledKey) as? Bool ?? true)
    }

    /// Spoken distances follow the units the trip page shows, which come
    /// from the speed unit: mph means miles and feet.
    static var metric: Bool {
        let unit = UserDefaults.standard.string(forKey: "speedUnit").flatMap(SpeedUnit.init(rawValue:)) ?? .mph
        return TripDistanceUnit(speedUnit: unit) == .metric
    }

    static var speaksAnswers: Bool {
        UserDefaults.standard.object(forKey: spokenAnswersKey) as? Bool ?? true
    }

    /// Whether guidance says this kind of prompt at all.
    static func allows(_ kind: GuidancePrompt.Kind) -> Bool {
        let key: String
        switch kind {
        case .turn: key = turnPromptsKey
        case .milestone: key = milestonesKey
        case .offRoute: key = offRouteKey
        case .arrived: return true
        }
        return UserDefaults.standard.object(forKey: key) as? Bool ?? true
    }

    /// "Hey PackRat" is off until the user turns it on.
    static var wakeWordEnabled: Bool {
        isAvailable && UserDefaults.standard.bool(forKey: wakeWordKey)
    }

    /// Safety alerts are spoken unless switched to a notification only.
    static var safetyAlertsSpoken: Bool {
        UserDefaults.standard.object(forKey: safetyAlertsSpokenKey) as? Bool ?? true
    }

    static var guidanceVibratesOnly: Bool {
        UserDefaults.standard.bool(forKey: vibrateOnlyKey)
    }
}

/// Finds "Hey PackRat" in what the hands-free listener heard. The recogniser
/// writes the name several ways, so each is accepted.
enum WakePhrase {
    private static let greetings = ["hey", "hay", "hi", "okay", "ok"]
    private static let names = ["packrat", "packrats", "pack rat", "pack rats", "pac rat", "pakrat", "packed rat", "back rat"]

    /// What was said after the last "Hey PackRat", trimmed; an empty string
    /// when nothing followed it yet, nil when it wasn't said.
    static func command(after transcript: String) -> String? {
        let padded = " \(VoiceCommandParser.normalize(transcript)) "
        var latest: Range<String.Index>?
        for greeting in greetings {
            for name in names {
                if let range = padded.range(of: " \(greeting) \(name) ", options: .backwards),
                   latest.map({ range.lowerBound > $0.lowerBound }) ?? true {
                    latest = range
                }
            }
        }
        guard let latest else { return nil }
        return padded[latest.upperBound...].trimmingCharacters(in: .whitespaces)
    }
}
