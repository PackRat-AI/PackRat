import Foundation

/// The sentences PackRat says back. Kept apart from the controller so every
/// answer can be checked without a microphone or a location fix.
enum VoiceAnswers {
    static let notHeard = "Sorry, I didn't catch that. You can say check in, where am I, how far to go, am I on route, when am I due back, add an hour, weather, or I'm safe."
    static let noTrip = "There's no trip in progress."
    static let noRoute = "This trip doesn't have a planned route."
    static let noCheckIn = "This trip doesn't have a return time. Notify your contacts from the trip page to set one."
    static let noFix = "I couldn't get your location. Try again with a clear view of the sky."
    static let locationDenied = "PackRat needs your location for that. Allow it in Settings, under PackRat, then Location."
    static let cancelled = "OK, I won't send it."
    static let queued = "Saved. It'll send when you have signal."
    static let noForecast = "There's no forecast saved for this trip."
    static let alreadyStarted = "Your trip has already started."

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

    // MARK: - Time

    /// "at 7 PM", "at 7:30 PM", "tomorrow at 9 AM".
    static func spokenTime(_ date: Date, now: Date, calendar: Calendar = .current) -> String {
        let minute = calendar.component(.minute, from: date)
        var style = Date.FormatStyle(date: .omitted, time: .omitted).hour(.defaultDigits(amPM: .abbreviated))
        if minute != 0 { style = style.minute(.twoDigits) }
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
