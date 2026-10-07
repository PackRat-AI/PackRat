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
    /// First and last day of the window, both counted.
    let start: Date
    let end: Date
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
    /// year, a custom goal missing a date), which the server refuses anyway.
    /// `parksAndPeaks` backs the summits and parks metrics; without it they read zero.
    init?(
        goal: TripGoal,
        finished: [TripStats.FinishedTrip],
        parksAndPeaks: TripParksAndPeaks? = nil,
        now: Date = .now,
        calendar: Calendar = .current
    ) {
        guard let window = Self.window(of: goal, calendar: calendar) else { return nil }
        self.goal = goal
        self.start = window.start
        self.end = window.end

        let today = calendar.startOfDay(for: now)
        let inWindow = TripStats.clip(finished, from: window.start, to: window.end, calendar: calendar)
        let totals = TripStats.totals(inWindow, calendar: calendar)
        let value: Double
        switch goal.metric {
        case .trips: value = Double(totals.trips)
        case .nights: value = Double(totals.nights)
        case .days: value = Double(totals.days)
        case .distance: value = totals.distance ?? 0
        case .elevation: value = totals.elevationGain ?? 0
        case .summits: value = Double(parksAndPeaks?.peaksSummited(from: window.start, to: window.end) ?? 0)
        case .parks: value = Double(parksAndPeaks?.parksVisited(from: window.start, to: window.end) ?? 0)
        }
        self.value = value

        let totalDays = Double((calendar.dateComponents([.day], from: window.start, to: window.end).day ?? 0) + 1)
        if today < window.start {
            phase = .upcoming
            elapsed = 0
        } else if today > window.end {
            phase = .ended
            elapsed = 1
        } else {
            phase = .active
            let gone = Double((calendar.dateComponents([.day], from: window.start, to: today).day ?? 0) + 1)
            elapsed = min(max(gone / max(totalDays, 1), 0), 1)
        }

        // Pace only means something while the window is open and the goal isn't met.
        guard phase == .active, value < goal.target else {
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
    /// goal runs its own days.
    static func window(of goal: TripGoal, calendar: Calendar = .current) -> (start: Date, end: Date)? {
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
        }
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
