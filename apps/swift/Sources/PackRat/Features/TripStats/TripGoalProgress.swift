import Foundation

/// Where a goal stands today: how much is done, how far through its window
/// the user is, and whether they're ahead of or behind an even pace. Worked
/// out from finished trips only, the same ones `TripStats` counts.
///
/// Pace follows Strava's goal cards: the target spread evenly over the window,
/// read as "ahead" or "behind" by how much. The wording stays neutral — a
/// slow start is a difference, not a failure.
struct TripGoalProgress: Sendable {
    enum Phase: Equatable, Sendable {
        /// The window hasn't opened yet.
        case upcoming
        case active
        /// The window has closed. Kept for the record; not shown as current.
        case ended
    }

    enum Pace: Equatable, Sendable {
        case onPace
        /// By how much, in the metric's base unit.
        case ahead(Double)
        case behind(Double)
    }

    let goal: TripGoal
    /// First and last day of the window, both counted. A list goal with no
    /// finish date has no end: it runs until it's met, and keeps showing after.
    let start: Date
    let end: Date?
    let phase: Phase
    /// In the metric's base unit: a count, or metres.
    let value: Double
    /// 0…1 of the window gone by, today included.
    let elapsed: Double
    let pace: Pace?

    var fraction: Double { goal.target > 0 ? value / goal.target : 0 }
    var isComplete: Bool { value >= goal.target }
    var remaining: Double { max(goal.target - value, 0) }

    /// Nil when the goal has no usable window (an annual goal missing its
    /// year, a custom goal missing a date, a long trail PackRat doesn't
    /// know), which the server refuses anyway. `parksAndPeaks` backs the
    /// summits and parks metrics, and `longTrails` the long-trail goals;
    /// without them those read zero.
    init?(
        goal: TripGoal,
        finished: [TripStats.FinishedTrip],
        parksAndPeaks: TripParksAndPeaks? = nil,
        longTrails: [LongTrailProgress] = [],
        now: Date = .now,
        calendar: Calendar = .current
    ) {
        guard let window = Self.window(of: goal, now: now, calendar: calendar) else { return nil }
        self.goal = goal
        self.start = window.start
        self.end = window.end

        let today = calendar.startOfDay(for: now)
        let value: Double
        switch goal.kind {
        case .longTrail:
            guard LongTrails.trail(code: goal.trailCode) != nil || longTrails.contains(where: { $0.trail.code == goal.trailCode })
            else { return nil }
            value = longTrails.first { $0.trail.code == goal.trailCode }?.meters ?? 0
        case .peakList:
            value = Double(Self.peaksClimbed(goal.peaks ?? [], record: parksAndPeaks).count)
        case .parkList:
            let listed = goal.parkCodes.map(Set.init)
            value = Double(parksAndPeaks?.visitedParks.filter { listed?.contains($0.park.code) ?? true }.count ?? 0)
        case .annual, .custom:
            let end = window.end ?? window.start
            let inWindow = TripStats.clip(finished, from: window.start, to: end, calendar: calendar)
            let totals = TripStats.totals(inWindow, calendar: calendar)
            switch goal.metric {
            case .trips: value = Double(totals.trips)
            case .nights: value = Double(totals.nights)
            case .days: value = Double(totals.days)
            case .distance: value = totals.distance ?? 0
            case .elevation: value = totals.elevationGain ?? 0
            case .summits: value = Double(parksAndPeaks?.peaksSummited(from: window.start, to: end) ?? 0)
            case .parks: value = Double(parksAndPeaks?.parksVisited(from: window.start, to: end) ?? 0)
            }
        }
        self.value = value

        if today < window.start {
            phase = .upcoming
            elapsed = 0
        } else if let end = window.end, today > end {
            phase = .ended
            elapsed = 1
        } else if let end = window.end {
            phase = .active
            let totalDays = Double((calendar.dateComponents([.day], from: window.start, to: end).day ?? 0) + 1)
            let gone = Double((calendar.dateComponents([.day], from: window.start, to: today).day ?? 0) + 1)
            elapsed = min(max(gone / max(totalDays, 1), 0), 1)
        } else {
            phase = .active
            elapsed = 0
        }

        // Pace only means something while a dated window is open and the goal isn't met.
        guard phase == .active, window.end != nil, value < goal.target else {
            pace = nil
            return
        }
        let expected = goal.target * elapsed
        let difference = value - expected
        // Counts round to whole units; measured goals call 1% of target even.
        let tolerance = goal.metric.isMeasured ? goal.target * 0.01 : 0.5
        if abs(difference) < tolerance {
            pace = .onPace
        } else if difference > 0 {
            pace = .ahead(goal.metric.isMeasured ? difference : difference.rounded())
        } else {
            pace = .behind(goal.metric.isMeasured ? -difference : (-difference).rounded())
        }
    }

    /// An annual goal runs 1 January to 31 December of its year; a custom
    /// goal runs its own days. A list goal runs from the day it was made
    /// (pace is measured from there) to its finish date, if it has one.
    static func window(of goal: TripGoal, now: Date = .now, calendar: Calendar = .current) -> (start: Date, end: Date?)? {
        switch goal.kind {
        case .annual:
            guard let year = goal.year,
                  let start = calendar.date(from: DateComponents(year: year, month: 1, day: 1)),
                  let end = calendar.date(from: DateComponents(year: year, month: 12, day: 31))
            else { return nil }
            return (start, end)
        case .custom:
            guard let start = TripGoal.day(from: goal.startDate, calendar: calendar),
                  let end = TripGoal.day(from: goal.endDate, calendar: calendar),
                  start <= end
            else { return nil }
            return (start, end)
        case .longTrail, .peakList, .parkList:
            let start = TripGoal.day(from: goal.startDate, calendar: calendar)
                ?? goal.localCreatedAt?.toDate().map { calendar.startOfDay(for: $0) }
                ?? calendar.startOfDay(for: now)
            let end = TripGoal.day(from: goal.endDate, calendar: calendar)
            if let end, end < start { return nil }
            return (start, end)
        }
    }

    /// The listed peaks a trip or a hand-added summit has reached. A peak
    /// matches by its OpenStreetMap node when both sides have one, else by name.
    static func peaksClimbed(_ peaks: [TripSummit], record: TripParksAndPeaks?) -> Set<String> {
        guard let record else { return [] }
        let osmIds = Set(record.ascents.compactMap(\.summit.osmId))
        let names = Set(record.ascents.map { TripGoal.normalizedPeakName($0.summit.name) })
        return Set(peaks.filter { peak in
            if let id = peak.osmId, osmIds.contains(id) { return true }
            return names.contains(TripGoal.normalizedPeakName(peak.name))
        }.map(\.peakKey))
    }
}

extension TripGoal {
    /// "Mt. Whitney" and "mount whitney" are the same peak.
    static func normalizedPeakName(_ name: String) -> String {
        var words = name.lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
        if words.first == "mt" { words[0] = "mount" }
        return words.joined(separator: " ")
    }
}

// MARK: - Formatting

extension TripGoal.Metric {
    /// A value in base units, in the user's display unit.
    func format(_ value: Double, unit: TripDistanceUnit) -> String {
        switch self {
        case .distance: return unit.formatDistance(value)
        case .elevation: return unit.formatElevation(value)
        case .trips: return Self.count(value, "trip", "trips")
        case .nights: return Self.count(value, "night", "nights")
        case .days: return Self.count(value, "day", "days")
        case .summits: return Self.count(value, "peak", "peaks")
        case .parks: return Self.count(value, "park", "parks")
        }
    }

    private static func count(_ value: Double, _ one: String, _ many: String) -> String {
        let whole = Int(value.rounded())
        return "\(whole.formatted()) \(whole == 1 ? one : many)"
    }
}
