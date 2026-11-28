import Foundation

/// A place PackRat can guide the user to.
struct GuidanceDestination: Codable, Equatable, Sendable {
    /// As it's said aloud: "camp", "the end of your route".
    let name: String
    let point: TripRoutePoint

    static let endName = "the end of your route"
    static let startName = "the trailhead"

    /// What "navigate to …" names: a waypoint the user marked, then the ends
    /// of the planned route. Nil when nothing matches.
    static func resolve(_ spoken: String, waypoints: [TripWaypoint], route: [TripRoutePoint]?) -> GuidanceDestination? {
        let target = strippedArticles(VoiceCommandParser.normalize(spoken))
        guard !target.isEmpty else { return nil }

        // Newest first, so a second "camp" means tonight's.
        let marked = waypoints.reversed().map { (key: strippedArticles(VoiceCommandParser.normalize($0.name)), waypoint: $0) }
        let paddedTarget = " \(target) "
        func overlaps(_ key: String) -> Bool {
            guard !key.isEmpty else { return false }
            return " \(key) ".contains(paddedTarget) || paddedTarget.contains(" \(key) ")
        }
        let match = marked.first { $0.key == target } ?? marked.first { overlaps($0.key) }
        if let waypoint = match?.waypoint {
            return GuidanceDestination(name: waypoint.name, point: TripRoutePoint(latitude: waypoint.latitude, longitude: waypoint.longitude))
        }

        guard let route, route.count >= 2, let first = route.first, let last = route.last else { return nil }
        if endPhrases.contains(target) { return GuidanceDestination(name: endName, point: last) }
        if startPhrases.contains(target) { return GuidanceDestination(name: startName, point: first) }
        return nil
    }

    /// What there is to navigate to, newest waypoints first, for "I couldn't find that".
    static func options(waypoints: [TripWaypoint], route: [TripRoutePoint]?, limit: Int = 3) -> [String] {
        var names: [String] = []
        for waypoint in waypoints.reversed() where waypoint.note == nil && !names.contains(waypoint.name) && names.count < limit {
            names.append(waypoint.name)
        }
        if let route, route.count >= 2 { names += [startName, endName] }
        return names
    }

    private static let endPhrases: Set<String> = [
        "end", "end of route", "end of my route", "end of the route", "end of your route", "route end", "finish", "destination",
    ]
    private static let startPhrases: Set<String> = [
        "trailhead", "trail head", "start", "start of route", "start of my route", "start of the route", "beginning", "car", "parking", "parking lot",
    ]

    private static func strippedArticles(_ text: String) -> String {
        var words = text.split(separator: " ").map(String.init)
        while let first = words.first, ["the", "my", "a", "our"].contains(first) { words.removeFirst() }
        return words.joined(separator: " ")
    }
}

/// A turn worth saying out loud along a guided path.
struct GuidanceTurn: Codable, Equatable, Sendable {
    /// Metres along the path.
    let alongMeters: Double
    /// Change of heading, negative to the left.
    let degrees: Double
    /// Compass bearing after the turn.
    let headingAfter: Double

    /// "bear left", "turn right", "make a sharp left".
    var maneuver: String {
        let side = degrees < 0 ? "left" : "right"
        switch abs(degrees) {
        case ..<80: return "bear \(side)"
        case ..<135: return "turn \(side)"
        default: return "make a sharp \(side)"
        }
    }

    /// SF Symbol for the guidance card.
    var symbol: String {
        let left = degrees < 0
        switch abs(degrees) {
        case ..<80: return left ? "arrow.up.left" : "arrow.up.right"
        case ..<135: return left ? "arrow.turn.up.left" : "arrow.turn.up.right"
        default: return left ? "arrow.uturn.left" : "arrow.uturn.right"
        }
    }
}

/// The way to a destination: along the planned route when the destination is
/// on it, otherwise straight there.
struct GuidancePlan: Codable, Equatable, Sendable {
    let destination: GuidanceDestination
    /// From where guidance started to the destination. Nil means straight there.
    let path: [TripRoutePoint]?
    let turns: [GuidanceTurn]
    /// Metres from start to destination, along the path or in a straight line.
    let lengthMeters: Double

    /// A destination further than this from the planned route is reached
    /// straight, not along it.
    static let onRouteDestination = 150.0

    init(from position: TripRoutePoint, to destination: GuidanceDestination, route: [TripRoutePoint]?) {
        self.destination = destination
        if let route, route.count >= 2,
           let here = RouteProgress(position: position, route: route),
           let there = RouteProgress(position: destination.point, route: route),
           there.offRouteMeters <= Self.onRouteDestination,
           abs(there.alongMeters - here.alongMeters) >= 50 {
            var path = Geo.slice(route, from: here.alongMeters, to: there.alongMeters)
            if Geo.distance(path.last ?? destination.point, destination.point) > 10 { path.append(destination.point) }
            self.path = path
            self.turns = Self.turns(along: path)
            self.lengthMeters = Geo.length(path)
        } else {
            self.path = nil
            self.turns = []
            self.lengthMeters = Geo.distance(position, destination.point)
        }
    }

    /// Bends of 50° or more, measured 30 m either side so GPS wiggle in the
    /// track doesn't count. Switchbacks are left out: a prompt at every one
    /// on a climb is noise, and the trail itself shows the way.
    static func turns(along path: [TripRoutePoint]) -> [GuidanceTurn] {
        guard path.count >= 3 else { return [] }
        let cumulative = Geo.cumulative(path)
        let total = cumulative.last ?? 0
        var candidates: [GuidanceTurn] = []
        for index in 1..<(path.count - 1) {
            let along = cumulative[index]
            guard along >= 30, total - along >= 30 else { continue }
            let before = Geo.point(along: along - 30, on: path, cumulative: cumulative)
            let after = Geo.point(along: along + 30, on: path, cumulative: cumulative)
            let inbound = Geo.bearing(from: before, to: path[index])
            let outbound = Geo.bearing(from: path[index], to: after)
            let degrees = Geo.signedDifference(from: inbound, to: outbound)
            guard abs(degrees) >= 50 else { continue }
            let turn = GuidanceTurn(alongMeters: along, degrees: degrees, headingAfter: outbound)
            // One bend drawn with several points is one turn: keep its sharpest.
            if let last = candidates.last, along - last.alongMeters < 40, (last.degrees < 0) == (degrees < 0) {
                if abs(degrees) > abs(last.degrees) { candidates[candidates.count - 1] = turn }
            } else {
                candidates.append(turn)
            }
        }
        return candidates.enumerated().filter { index, turn in
            let neighbours = [index > 0 ? candidates[index - 1] : nil, index + 1 < candidates.count ? candidates[index + 1] : nil]
            return !neighbours.contains { other in
                guard let other else { return false }
                return abs(other.alongMeters - turn.alongMeters) < 200 && (other.degrees < 0) != (turn.degrees < 0)
            }
        }.map(\.element)
    }
}

/// Something guidance says without being asked.
struct GuidancePrompt: Equatable, Sendable {
    enum Kind: Equatable, Sendable {
        case turn
        case milestone
        case offRoute
        case arrived
    }

    let kind: Kind
    let text: String
}

/// Follows the user along a plan and decides what to say as they go. Pure, so
/// every prompt can be checked without GPS.
struct RouteGuide: Codable, Equatable, Sendable {
    let plan: GuidancePlan
    private(set) var announcedTurns: Set<Int> = []
    private(set) var announcedMilestones: Set<String> = []
    private(set) var offRouteSince: Date?
    private(set) var announcedOffRouteMeters: Double?
    private(set) var hasArrived = false
    /// Latest figures, for the card and "how far to go".
    private(set) var remainingMeters: Double
    private(set) var progress: RouteProgress?

    /// Said this far ahead of a turn.
    static let turnWarning = 120.0
    /// Within this of the destination is there.
    static let arrivalRadius = 30.0
    /// Off the path for this long before it's said, so a detour round a
    /// fallen tree or a bad fix under trees doesn't trigger it.
    static let offRouteDelay: TimeInterval = 20

    init(plan: GuidancePlan) {
        self.plan = plan
        remainingMeters = plan.lengthMeters
    }

    /// The next turn ahead, for the card.
    var nextTurn: GuidanceTurn? {
        guard let along = progress?.alongMeters else { return nil }
        return plan.turns.first { $0.alongMeters > along }
    }

    var isOffRoute: Bool { announcedOffRouteMeters != nil }

    mutating func update(position: TripRoutePoint, at time: Date, metric: Bool) -> [GuidancePrompt] {
        guard !hasArrived else { return [] }
        let direct = Geo.distance(position, plan.destination.point)

        guard let path = plan.path, let progress = RouteProgress(position: position, route: path) else {
            remainingMeters = direct
            if direct <= Self.arrivalRadius { return [arrive()] }
            return milestones(remaining: direct, metric: metric, toward: Geo.bearing(from: position, to: plan.destination.point))
        }

        self.progress = progress
        remainingMeters = progress.remainingMeters
        if direct <= Self.arrivalRadius || (progress.isOnRoute && progress.remainingMeters <= Self.arrivalRadius) {
            return [arrive()]
        }

        var prompts: [GuidancePrompt] = []
        if progress.isOnRoute {
            offRouteSince = nil
            if announcedOffRouteMeters != nil {
                announcedOffRouteMeters = nil
                prompts.append(.init(kind: .offRoute, text: VoiceAnswers.backOnRoute))
            }
            for (index, turn) in plan.turns.enumerated() where !announcedTurns.contains(index) {
                let ahead = turn.alongMeters - progress.alongMeters
                if ahead < 0 {
                    announcedTurns.insert(index)
                } else if ahead <= Self.turnWarning {
                    announcedTurns.insert(index)
                    prompts.append(.init(kind: .turn, text: VoiceAnswers.turnAhead(turn, inMeters: ahead, metric: metric)))
                    break
                }
            }
            prompts += milestones(remaining: progress.remainingMeters, metric: metric, toward: nil)
        } else {
            let since = offRouteSince ?? time
            offRouteSince = since
            // Said once, then again only when they've strayed a good deal further.
            let further = announcedOffRouteMeters.map { progress.offRouteMeters >= $0 + max(50, $0 * 0.5) } ?? true
            if time.timeIntervalSince(since) >= Self.offRouteDelay, further {
                announcedOffRouteMeters = progress.offRouteMeters
                prompts.append(.init(kind: .offRoute, text: VoiceAnswers.offRoute(progress, metric: metric)))
            }
        }
        return prompts
    }

    private mutating func arrive() -> GuidancePrompt {
        hasArrived = true
        remainingMeters = 0
        return .init(kind: .arrived, text: VoiceAnswers.arrived(plan.destination.name))
    }

    /// Halfway, then a mile (or kilometre) out, on guidance long enough for
    /// each to mean something.
    private mutating func milestones(remaining: Double, metric: Bool, toward bearing: Double?) -> [GuidancePrompt] {
        let length = plan.lengthMeters
        let name = plan.destination.name
        let lastLeg = metric ? 1_000.0 : 1_609.344
        if length >= 800, remaining <= length / 2, announcedMilestones.insert("half").inserted {
            return [.init(kind: .milestone, text: VoiceAnswers.halfway(to: name, remaining: remaining, metric: metric, toward: bearing))]
        }
        if length >= lastLeg * 2, remaining <= lastLeg, announcedMilestones.insert("last").inserted {
            announcedMilestones.insert("half")
            return [.init(kind: .milestone, text: VoiceAnswers.lastLeg(to: name, metric: metric, toward: bearing))]
        }
        return []
    }
}

extension Geo {
    /// Distance from the start of `path` to each of its points.
    static func cumulative(_ path: [TripRoutePoint]) -> [Double] {
        var total = 0.0
        var result = [0.0]
        for (a, b) in zip(path, path.dropFirst()) {
            total += distance(a, b)
            result.append(total)
        }
        return result
    }

    static func length(_ path: [TripRoutePoint]) -> Double { cumulative(path).last ?? 0 }

    /// The point `along` metres down the path, clamped to its ends.
    static func point(along: Double, on path: [TripRoutePoint], cumulative: [Double]) -> TripRoutePoint {
        guard let first = path.first, let last = path.last else { return TripRoutePoint(latitude: 0, longitude: 0) }
        if along <= 0 { return first }
        guard let index = cumulative.firstIndex(where: { $0 >= along }), index > 0 else { return last }
        let a = path[index - 1], b = path[index]
        let span = cumulative[index] - cumulative[index - 1]
        let t = span > 0 ? (along - cumulative[index - 1]) / span : 0
        return TripRoutePoint(latitude: a.latitude + t * (b.latitude - a.latitude), longitude: a.longitude + t * (b.longitude - a.longitude))
    }

    /// The stretch of a route between two distances along it, in the order
    /// asked for, so heading back to the trailhead runs the route backwards.
    static func slice(_ route: [TripRoutePoint], from start: Double, to end: Double) -> [TripRoutePoint] {
        let cumulative = cumulative(route)
        let low = min(start, end), high = max(start, end)
        var points = [point(along: low, on: route, cumulative: cumulative)]
        for (index, along) in cumulative.enumerated() where along > low && along < high {
            points.append(route[index])
        }
        points.append(point(along: high, on: route, cumulative: cumulative))
        return start <= end ? points : points.reversed()
    }

    /// From one bearing to another, -180…180, negative to the left.
    static func signedDifference(from a: Double, to b: Double) -> Double {
        var difference = (b - a).truncatingRemainder(dividingBy: 360)
        if difference > 180 { difference -= 360 }
        if difference <= -180 { difference += 360 }
        return difference
    }
}
