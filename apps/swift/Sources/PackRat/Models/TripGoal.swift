import Foundation

// MARK: - Goals

/// A trip stats goal. Mirrors `TripGoalSchema` in
/// `packages/schemas/src/tripStats.ts`. `target` is a count, or metres for
/// distance and elevation, whatever the user's display unit. Progress is never
/// stored: `TripGoalProgress` works it out from the trips.
///
/// Annual and custom goals count what falls inside their window. The list
/// goals (a long trail, a list of peaks, the National Parks) count every trip
/// ever, and may carry a finish date to pace against.
struct TripGoal: Codable, Identifiable, Equatable, Sendable {
    let id: String
    var kind: Kind
    var metric: Metric
    var target: Double
    /// Annual goals only.
    var year: Int?
    /// Custom goals, and an optional name for peak and park lists.
    var name: String?
    /// A calendar day sent as UTC midnight — see `TripGoal.dayString`. Custom
    /// goals need both; list goals start when made and may set a finish date.
    var startDate: String?
    var endDate: String?
    /// Long-trail goals only: a `LongTrail.code`.
    var trailCode: String?
    /// Peak-list goals only.
    var peaks: [TripSummit]?
    /// Park-list goals only; nil means every park.
    var parkCodes: [String]?
    var deleted: Bool = false
    var localCreatedAt: String?
    var localUpdatedAt: String?

    enum Kind: String, Codable, CaseIterable, Identifiable, Sendable {
        case annual, custom, longTrail, peakList, parkList
        var id: String { rawValue }

        /// Counts every trip ever rather than a window's worth.
        var isList: Bool { self == .longTrail || self == .peakList || self == .parkList }

        var label: String {
            switch self {
            case .annual: return "This Year"
            case .custom: return "Custom Dates"
            case .longTrail: return "Long Trail"
            case .peakList: return "Peak List"
            case .parkList: return "National Parks"
            }
        }

        var symbol: String {
            switch self {
            case .annual: return "calendar"
            case .custom: return "calendar.badge.clock"
            case .longTrail: return "signpost.right.and.left.fill"
            case .peakList: return "flag.2.crossed.fill"
            case .parkList: return "tree.fill"
            }
        }

        /// What a list goal measures; annual and custom goals choose.
        var fixedMetric: Metric? {
            switch self {
            case .annual, .custom: return nil
            case .longTrail: return .distance
            case .peakList: return .summits
            case .parkList: return .parks
            }
        }
    }

    enum Metric: String, Codable, CaseIterable, Identifiable, Sendable {
        case trips, nights, days, distance, elevation, summits, parks

        var id: String { rawValue }

        var label: String {
            switch self {
            case .trips: return "Trips"
            case .nights: return "Nights Out"
            case .days: return "Days Outdoors"
            case .distance: return "Distance"
            case .elevation: return "Elevation Gain"
            case .summits: return "Summits"
            case .parks: return "National Parks"
            }
        }

        var symbol: String {
            switch self {
            case .trips: return "map.fill"
            case .nights: return "moon.stars.fill"
            case .days: return "sun.max.fill"
            case .distance: return "point.topleft.down.to.point.bottomright.curvepath"
            case .elevation: return "mountain.2.fill"
            case .summits: return "flag.fill"
            case .parks: return "tree.fill"
            }
        }

        /// Distance and elevation are entered in the user's unit and stored in metres.
        var isMeasured: Bool { self == .distance || self == .elevation }
    }

    /// A goal's own name, else what it measures.
    var title: String {
        let named = name.flatMap { $0.trimmingCharacters(in: .whitespaces).isEmpty ? nil : $0 }
        switch kind {
        case .annual: return metric.label
        case .custom: return named ?? metric.label
        case .longTrail: return LongTrails.trail(code: trailCode)?.name ?? "Long Trail"
        case .peakList: return named ?? "Peak List"
        case .parkList: return named ?? (parkCodes == nil ? "Every National Park" : "National Parks")
        }
    }

    // MARK: Calendar days

    /// A goal window is calendar days, not instants: 1 March is 1 March in any
    /// time zone. Days go over the wire as that date at UTC midnight and come
    /// back to the same local day.
    static func dayString(from date: Date, calendar: Calendar = .current) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02dT00:00:00.000Z", parts.year ?? 1970, parts.month ?? 1, parts.day ?? 1)
    }

    static func day(from string: String?, calendar: Calendar = .current) -> Date? {
        guard let string, string.count >= 10 else { return nil }
        let parts = string.prefix(10).split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }
}

extension Array where Element == TripGoal {
    var activeGoals: [TripGoal] { filter { !$0.deleted } }
}

/// The body for both create and replace. The server checks the window: an
/// annual goal needs a year, a custom one a start on or before its end.
///
/// Always the whole goal, id included: the outbox folds a queued replace into
/// a queued create, so a replace payload has to be able to stand as a create.
/// The replace route ignores the id and creation time.
struct TripGoalRequest: Codable, Sendable {
    let id: String
    let kind: TripGoal.Kind
    let metric: TripGoal.Metric
    let target: Double
    let year: Int?
    let name: String?
    let startDate: String?
    let endDate: String?
    let trailCode: String?
    let peaks: [TripSummit]?
    let parkCodes: [String]?
    let localCreatedAt: String
    let localUpdatedAt: String

    init(goal: TripGoal, now: String = Date.iso8601Now()) {
        self.id = goal.id
        self.kind = goal.kind
        self.metric = goal.metric
        self.target = goal.target
        self.year = goal.kind == .annual ? goal.year : nil
        self.name = goal.kind == .custom || goal.kind == .peakList || goal.kind == .parkList ? goal.name : nil
        self.startDate = goal.kind == .annual ? nil : goal.startDate
        self.endDate = goal.kind == .annual ? nil : goal.endDate
        self.trailCode = goal.kind == .longTrail ? goal.trailCode : nil
        self.peaks = goal.kind == .peakList ? goal.peaks : nil
        self.parkCodes = goal.kind == .parkList ? goal.parkCodes : nil
        self.localCreatedAt = goal.localCreatedAt ?? now
        self.localUpdatedAt = now
    }
}

// MARK: - Settings

/// Why a user was away before a comeback. Shown on the comeback card only.
enum TripBreakReason: String, Codable, CaseIterable, Identifiable, Sendable {
    case injury, illness, life, season

    var id: String { rawValue }

    var label: String {
        switch self {
        case .injury: return "Injury"
        case .illness: return "Illness"
        case .life: return "Life"
        case .season: return "Season"
        }
    }

    /// The line the comeback card leads with.
    var cardLine: String {
        switch self {
        case .injury: return "Back from injury"
        case .illness: return "Back from illness"
        case .life: return "Back after a busy stretch"
        case .season: return "Back for the new season"
        }
    }
}

/// Mirrors `TripStatsSettingsSchema`. `enabled` is nil until the user answers
/// the opt-in, so entry points can still invite them in; false hides stats
/// and keeps every log. The break reason belongs to one comeback only — the
/// one that started with `breakReasonTripId`.
struct TripStatsSettings: Codable, Equatable, Sendable {
    var enabled: Bool?
    var breakReason: TripBreakReason?
    var breakReasonTripId: String?

    init(enabled: Bool? = nil, breakReason: TripBreakReason? = nil, breakReasonTripId: String? = nil) {
        self.enabled = enabled
        self.breakReason = breakReason
        self.breakReasonTripId = breakReasonTripId
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        enabled = try container.decodeIfPresent(Bool.self, forKey: .enabled)
        breakReason = try? container.decodeIfPresent(TripBreakReason.self, forKey: .breakReason)
        breakReasonTripId = try container.decodeIfPresent(String.self, forKey: .breakReasonTripId)
    }

    /// Nulls are sent, not omitted: the route is a full replace.
    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(enabled, forKey: .enabled)
        try container.encode(breakReason, forKey: .breakReason)
        try container.encode(breakReasonTripId, forKey: .breakReasonTripId)
    }

    enum CodingKeys: String, CodingKey { case enabled, breakReason, breakReasonTripId }

    func breakReason(forComebackTrip tripId: String) -> TripBreakReason? {
        breakReasonTripId == tripId ? breakReason : nil
    }
}
