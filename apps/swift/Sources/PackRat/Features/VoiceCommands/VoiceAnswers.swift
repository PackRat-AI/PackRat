import Foundation

/// The sentences PackRat says back. Kept apart from the controller so every
/// answer can be checked without a microphone or a location fix.
enum VoiceAnswers {
    static let notHeard = "Sorry, I didn't catch that. You can say start tracking, mark waypoint, note, how far have I gone, navigate to, check in, where am I, how far to go, am I on route, when am I due back, add an hour, weather, or I'm safe."
    static let noTrip = "There's no trip in progress."
    static let noRoute = "This trip doesn't have a planned route."
    static let noCheckIn = "This trip doesn't have a return time. Notify your contacts from the trip page to set one."
    static let noFix = "I couldn't get your location. Try again with a clear view of the sky."
    static let locationDenied = "PackRat needs your location for that. Allow it in Settings, under PackRat, then Location."
    static let cancelled = "OK, I won't send it."
    static let queued = "Saved. It'll send when you have signal."
    static let noForecast = "There's no forecast saved for this trip."
    static let alreadyStarted = "Your trip has already started."
    static let waypointLimit = "This trip has 500 waypoints already. Delete one on the trip page to mark another."
    static let busy = "PackRat is in the middle of another command. Try again in a moment."
    static let comingSoon = "Voice commands are coming soon to PackRat."
    static let voiceOff = "Voice commands are off. Turn them on in PackRat's Settings, under Voice."
    static let openingPackRat = "Opening PackRat to find your trip."

    // MARK: - Safety alerts

    /// Said once when the overdue alert is an hour or less away.
    static func overdueSoon(contacts: String, overdueAt: Date, now: Date) -> String {
        let left = overdueAt.timeIntervalSince(now)
        return "Heads up. \(contacts.capitalizedFirst) will be told you're overdue in \(duration(left)). Say I'm safe, or add an hour."
    }

    /// Said at 20 and again at 10 percent while the phone isn't charging.
    static func lowBattery(percent: Int, tracking: Bool) -> String {
        let base = "Your battery is at \(percent) percent."
        return tracking ? base + " Tracking will stop if it runs out." : base + " Your phone may turn off before you're back."
    }

    /// A severe or extreme weather alert for where the user is.
    static func weatherAlert(event: String, headline: String?) -> String {
        var sentence = "Weather alert. \(event.capitalizedFirst) in effect for your area."
        if let headline, !headline.isEmpty, headline.lowercased() != event.lowercased() {
            sentence += " \(headline.trimmingCharacters(in: .whitespaces).trimmingCharacters(in: CharacterSet(charactersIn: ".")))."
        }
        return sentence
    }

    // MARK: - Distances

    /// "half a mile", "3.2 miles", "300 feet", "800 metres", "1.4 kilometres".
    static func distance(_ meters: Double, metric: Bool) -> String {
        if metric {
            if meters < 950 {
                let rounded = max(10, (meters / 10).rounded() * 10)
                return "\(Int(rounded)) metres"
            }
            return "\(oneDecimal(meters / 1_000)) kilometres"
        }
        let miles = meters / 1_609.344
        if miles < 0.2 {
            let feet = max(50, (meters * 3.28084 / 50).rounded() * 50)
            return "\(Int(feet).formatted()) feet"
        }
        if miles < 0.35 { return "a quarter of a mile" }
        if miles < 0.65 { return "half a mile" }
        if miles < 0.9 { return "three quarters of a mile" }
        let value = oneDecimal(miles)
        return value == "1" ? "1 mile" : "\(value) miles"
    }

    static func height(_ meters: Double, metric: Bool) -> String {
        if metric { return "\(Int((meters / 10).rounded() * 10).formatted()) metres" }
        return "\(Int((meters * 3.28084 / 10).rounded() * 10).formatted()) feet"
    }

    private static func oneDecimal(_ value: Double) -> String {
        let rounded = (value * 10).rounded() / 10
        return rounded == rounded.rounded() ? "\(Int(rounded))" : String(format: "%.1f", rounded)
    }

    // MARK: - Answers

    /// A place name when the phone can look one up, otherwise progress along
    /// the route, otherwise the coordinates, which are what a rescuer needs.
    static func whereAmI(placeName: String?, progress: RouteProgress?, latitude: Double, longitude: Double, altitudeMeters: Double?, metric: Bool) -> String {
        var sentence: String
        if let placeName {
            sentence = "You're near \(placeName)"
        } else if let progress, progress.isOnRoute {
            sentence = "You're \(distance(progress.alongMeters, metric: metric)) along your route, with \(distance(progress.remainingMeters, metric: metric)) to go"
        } else {
            sentence = "You're at \(coordinate(latitude, positive: "north", negative: "south")), \(coordinate(longitude, positive: "east", negative: "west"))"
        }
        if let altitudeMeters { sentence += ", at \(height(altitudeMeters, metric: metric))" }
        return sentence + "."
    }

    private static func coordinate(_ value: Double, positive: String, negative: String) -> String {
        "\(String(format: "%.3f", abs(value))) degrees \(value >= 0 ? positive : negative)"
    }

    static func remaining(_ progress: RouteProgress, metric: Bool) -> String {
        if progress.remainingMeters < 50 { return "You're at the end of your route." }
        var sentence = "\(distance(progress.remainingMeters, metric: metric).capitalizedFirst) to go to the end of your route."
        if !progress.isOnRoute {
            sentence += " You're \(distance(progress.offRouteMeters, metric: metric)) off it."
        }
        return sentence
    }

    static func onRoute(_ progress: RouteProgress, metric: Bool) -> String {
        if progress.isOnRoute { return "Yes, you're on your route." }
        let toward = Geo.compassName(progress.bearingToRoute)
        let away = Geo.compassName((progress.bearingToRoute + 180).truncatingRemainder(dividingBy: 360))
        return "You're about \(distance(progress.offRouteMeters, metric: metric)) \(away) of your route. Head \(toward) to rejoin it."
    }

    static func dueBack(expectedReturn: Date, graceMinutes: Int, now: Date, calendar: Calendar = .current) -> String {
        let alertAt = expectedReturn.addingTimeInterval(TimeInterval(graceMinutes * 60))
        let when = spokenTime(expectedReturn, now: now, calendar: calendar)
        if alertAt <= now { return "You were due back \(when). Your contacts have been sent an overdue alert." }
        if expectedReturn <= now {
            return "You were due back \(when). Your contacts get an overdue alert in \(duration(alertAt.timeIntervalSince(now)))."
        }
        return "You're due back \(when). That's \(duration(expectedReturn.timeIntervalSince(now))) from now."
    }

    // MARK: - Confirmations

    static func confirmCheckIn(contacts: String, placeName: String?) -> String {
        let place = placeName.map { " near \($0)" } ?? ""
        return "Checking in with \(contacts)\(place). Send it?"
    }

    static func confirmSafe(tripName: String) -> String {
        "Mark yourself safe and end \(tripName)?"
    }

    static func confirmExtend(to date: Date, contacts: String, now: Date, calendar: Calendar = .current) -> String {
        "Change your return to \(spokenTime(date, now: now, calendar: calendar)) and tell \(contacts)?"
    }

    static func checkedIn(online: Bool) -> String { online ? "Checked in." : queued }
    static func markedSafe(online: Bool) -> String { online ? "Welcome back. Your contacts have been told you're safe." : "You're marked safe. Your contacts will be told when you have signal." }
    static func extended(to date: Date, online: Bool, now: Date, calendar: Calendar = .current) -> String {
        let base = "Your return is now \(spokenTime(date, now: now, calendar: calendar))."
        return online ? base : base + " " + queued
    }

    static let tripStarted = "Trip started. Have a good one."

    static func confirmNotify(contact: String, expectedReturn: Date, now: Date, calendar: Calendar = .current) -> String {
        "Trip started. Tell \(contact) you're due back \(spokenTime(expectedReturn, now: now, calendar: calendar))?"
    }

    static func notified(contact: String, online: Bool) -> String {
        online ? "\(contact.capitalizedFirst) has your plan." : queued
    }

    static let noContactsTold = "No one's been told about this trip yet. Notify your contacts from the trip page first."

    static func confirmFinish(tripName: String) -> String { "End \(tripName)?" }
    static let finished = "Trip ended. Welcome back."

    static func weather(_ conditions: TripConditions, metric: Bool, now: Date) -> String {
        let low = Int((metric ? conditions.lowC : conditions.lowF).rounded())
        let high = Int((metric ? conditions.highC : conditions.highF).rounded())
        var sentence = conditions.conditionText.map { "\($0.capitalizedFirst). " } ?? ""
        sentence += "Between \(low) and \(high) degrees."
        if conditions.maxChanceOfSnow >= TripConditions.snowChance {
            sentence += " \(conditions.maxChanceOfSnow) percent chance of snow."
        } else if conditions.maxChanceOfRain >= 20 {
            sentence += " \(conditions.maxChanceOfRain) percent chance of rain."
        }
        if let alert = conditions.alerts.first { sentence += " Alert: \(alert.event)." }
        let age = now.timeIntervalSince(conditions.fetchedAt)
        if age > 3 * 3_600 { sentence += " This forecast is from \(duration(age)) ago." }
        return sentence
    }

    // MARK: - Tracking

    static let trackingStarted = "Tracking started. I'll keep recording with the screen off."
    static let tripStartedTracking = "Trip started, and tracking. I'll keep recording with the screen off."
    static let alreadyTracking = "You're already tracking."
    static let notTracking = "You're not tracking. Say start tracking to begin."
    static let trackingPaused = "Tracking paused. Say resume tracking when you set off again."
    static let alreadyPaused = "Tracking is already paused."
    static let trackingResumed = "Tracking resumed."
    static let notPaused = "Tracking isn't paused."
    static let tripEnded = "This trip has ended."

    static func trackingOtherTrip(_ name: String) -> String {
        "You're tracking \(name). Stop that first."
    }

    /// "Stopped. 8.4 miles, 2,900 feet of climbing, 4 hours 10 moving."
    static func trackingStopped(_ track: RecordedTrack, metric: Bool) -> String {
        guard track.logRoute != nil else { return "Stopped. Too little was recorded to save a route." }
        return "Stopped. " + totals(track, metric: metric) + " Saved to your trip log."
    }

    /// "3.2 miles, 1,400 feet of climbing, 1 hour 20 moving."
    static func trackSoFar(_ track: RecordedTrack, metric: Bool) -> String {
        guard track.distanceMeters >= 10 else { return "You've only just started." }
        let base = "You've gone " + totals(track, metric: metric)
        return track.isPaused ? base + " Tracking is paused." : base
    }

    private static func totals(_ track: RecordedTrack, metric: Bool) -> String {
        var parts = [distance(track.distanceMeters, metric: metric)]
        if track.elevationGainMeters >= 10 { parts.append("\(height(track.elevationGainMeters, metric: metric)) of climbing") }
        if track.movingSeconds >= 60 { parts.append("\(movingTime(track.movingSeconds)) moving") }
        return parts.joined(separator: ", ") + "."
    }

    /// "4 hours 10", "1 hour", "45 minutes": the way a watch reads it out.
    static func movingTime(_ seconds: TimeInterval) -> String {
        let total = max(1, Int((seconds / 60).rounded()))
        let hours = total / 60, minutes = total % 60
        if hours == 0 { return minutes == 1 ? "1 minute" : "\(minutes) minutes" }
        let h = hours == 1 ? "1 hour" : "\(hours) hours"
        return minutes == 0 ? h : "\(h) \(minutes)"
    }

    // MARK: - Waypoints

    static let noteEmpty = "Say note, then what you want to save."

    static func waypointMarked(_ name: String) -> String { "Marked \(name)." }
    static let noteSaved = "Note saved here."

    // MARK: - Guidance

    static let noDestinations = "There's nowhere to navigate to yet. Mark a waypoint or add a planned route first."
    static let notNavigating = "You're not navigating anywhere."
    static let backOnRoute = "You're back on route."

    static func navigationStopped(tracking: Bool) -> String {
        tracking ? "Navigation stopped. Tracking carries on." : "Navigation stopped."
    }

    static func navigatingOtherTrip(_ name: String) -> String {
        "You're navigating on \(name). Stop that first."
    }

    /// "I couldn't find the bridge. You can navigate to Camp, Water source, the trailhead or the end of your route."
    static func unknownDestination(_ spoken: String, options: [String]) -> String {
        let heard = spoken.isEmpty ? "that place" : spoken
        guard !options.isEmpty else { return "I couldn't find \(heard). \(noDestinations)" }
        return "I couldn't find \(heard). You can navigate to \(list(options))."
    }

    static func alreadyThere(_ name: String) -> String { "You're already at \(name)." }

    /// Said when guidance starts.
    static func navigating(_ plan: GuidancePlan, from position: TripRoutePoint, metric: Bool) -> String {
        let name = plan.destination.name
        let length = distance(plan.lengthMeters, metric: metric)
        if plan.path != nil { return "Navigating to \(name) along your route. \(length.capitalizedFirst) to go." }
        let toward = Geo.compassName(Geo.bearing(from: position, to: plan.destination.point))
        return "\(name.capitalizedFirst) is \(length) \(toward) of you. I'll tell you when you're there."
    }

    /// "How far to go" while navigating.
    static func guidanceRemaining(_ guide: RouteGuide, toward bearing: Double?, metric: Bool) -> String {
        var sentence = "\(distance(guide.remainingMeters, metric: metric).capitalizedFirst) to \(guide.plan.destination.name)"
        if guide.plan.path == nil, let bearing { sentence += ", \(Geo.compassName(bearing))" }
        sentence += "."
        if let progress = guide.progress, !progress.isOnRoute {
            sentence += " You're \(distance(progress.offRouteMeters, metric: metric)) off your route."
        }
        return sentence
    }

    /// "In 400 feet, bear left, heading north-east."
    static func turnAhead(_ turn: GuidanceTurn, inMeters ahead: Double, metric: Bool) -> String {
        let heading = Geo.compassName(turn.headingAfter)
        if ahead < 30 { return "\(turn.maneuver.capitalizedFirst) now, heading \(heading)." }
        return "In \(distance(ahead, metric: metric)), \(turn.maneuver), heading \(heading)."
    }

    /// "You're off route. Head east about 300 feet to rejoin it."
    static func offRoute(_ progress: RouteProgress, metric: Bool) -> String {
        "You're off route. Head \(Geo.compassName(progress.bearingToRoute)) about \(distance(progress.offRouteMeters, metric: metric)) to rejoin it."
    }

    static func halfway(to name: String, remaining: Double, metric: Bool, toward bearing: Double?) -> String {
        let direction = bearing.map { ", \(Geo.compassName($0))" } ?? ""
        return "Halfway to \(name). \(distance(remaining, metric: metric).capitalizedFirst) to go\(direction)."
    }

    static func lastLeg(to name: String, metric: Bool, toward bearing: Double?) -> String {
        let direction = bearing.map { ", \(Geo.compassName($0))" } ?? ""
        return "\(metric ? "1 kilometre" : "1 mile") to \(name)\(direction)."
    }

    static func arrived(_ name: String) -> String { "You've reached \(name)." }

    /// "A, B or C".
    private static func list(_ items: [String]) -> String {
        guard items.count > 1, let last = items.last else { return items.first ?? "" }
        return items.dropLast().joined(separator: ", ") + " or " + last
    }

    // MARK: - Time

    /// "at 7 PM", "at 7:30 PM", "tomorrow at 9 AM".
    static func spokenTime(_ date: Date, now: Date, calendar: Calendar = .current) -> String {
        let minute = calendar.component(.minute, from: date)
        var style = Date.FormatStyle(date: .omitted, time: .omitted).hour(.defaultDigits(amPM: .abbreviated))
        // "7 PM" works on a 12-hour clock; a 24-hour clock needs "19:00".
        let locale = calendar.locale ?? .current
        let twelveHour = DateFormatter.dateFormat(fromTemplate: "j", options: 0, locale: locale)?.contains("a") ?? true
        if minute != 0 || !twelveHour { style = style.minute(.twoDigits) }
        style.locale = locale
        style.timeZone = calendar.timeZone
        // ICU puts a narrow no-break space before AM/PM; a plain space reads the same aloud.
        let time = date.formatted(style).replacingOccurrences(of: "\u{202F}", with: " ")
        if calendar.isDate(date, inSameDayAs: now) { return "at \(time)" }
        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: now), calendar.isDate(date, inSameDayAs: tomorrow) {
            return "tomorrow at \(time)"
        }
        var weekday = Date.FormatStyle(date: .omitted, time: .omitted).weekday(.wide)
        weekday.timeZone = calendar.timeZone
        let day = date.formatted(weekday)
        return "\(day) at \(time)"
    }

    /// The banner shows times on the phone's own clock, but the voice reads
    /// "19:00" as "nineteen hundred hours", so spoken text says "7 PM".
    static func speakable(_ text: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: #"\b([01]?\d|2[0-3]):([0-5]\d)\b"#) else { return text }
        var result = text
        for match in regex.matches(in: text, range: NSRange(text.startIndex..., in: text)).reversed() {
            guard let whole = Range(match.range, in: text),
                  let h = Range(match.range(at: 1), in: text).flatMap({ Int(text[$0]) }),
                  let m = Range(match.range(at: 2), in: text).flatMap({ Int(text[$0]) })
            else { continue }
            let hour = h % 12 == 0 ? 12 : h % 12
            let spoken = (m == 0 ? "\(hour)" : String(format: "%d:%02d", hour, m)) + (h < 12 ? " AM" : " PM")
            result.replaceSubrange(whole, with: spoken)
        }
        return result
    }

    /// "2 hours", "1 hour 20 minutes", "45 minutes".
    static func duration(_ seconds: TimeInterval) -> String {
        let total = max(1, Int((seconds / 60).rounded()))
        let hours = total / 60, minutes = total % 60
        let h = hours == 1 ? "1 hour" : "\(hours) hours"
        let m = minutes == 1 ? "1 minute" : "\(minutes) minutes"
        if hours == 0 { return m }
        if minutes == 0 || hours >= 5 { return h }
        return "\(h) \(m)"
    }
}

private extension String {
    var capitalizedFirst: String { prefix(1).uppercased() + dropFirst() }
}
