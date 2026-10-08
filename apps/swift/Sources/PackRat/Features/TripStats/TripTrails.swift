import CoreLocation
import Foundation

/// The registry trails a user has walked, from the trails named in their
/// finished trips' logs. A trail logged on three trips is one trail walked
/// three times.
struct TripTrailsRecord: Sendable {
    struct Walk: Identifiable, Sendable {
        let tripId: String
        let tripName: String
        let date: Date
        var id: String { tripId }
    }

    struct WalkedTrail: Identifiable, Sendable {
        let trail: TripTrail
        /// Newest first.
        let walks: [Walk]
        var id: String { trail.id }
        var latest: Date { walks.first?.date ?? .distantPast }
    }

    /// Most recently walked first.
    let trails: [WalkedTrail]

    init(finished: [TripStats.FinishedTrip]) {
        var walks: [String: [Walk]] = [:]
        var named: [String: TripTrail] = [:]
        // Oldest first, so the newest log's name wins if the registry renamed a trail.
        for item in finished.sorted(by: { $0.start < $1.start }) {
            for trail in item.trip.log?.trails ?? [] {
                named[trail.id] = trail
                if walks[trail.id]?.contains(where: { $0.tripId == item.trip.id }) == true { continue }
                walks[trail.id, default: []].append(Walk(tripId: item.trip.id, tripName: item.trip.name, date: item.start))
            }
        }
        let walked: [WalkedTrail] = named.values.map { trail in
            let newestFirst = (walks[trail.id] ?? []).sorted { $0.date > $1.date }
            return WalkedTrail(trail: trail, walks: newestFirst)
        }
        trails = walked.sorted { lhs, rhs in
            if lhs.latest != rhs.latest { return lhs.latest > rhs.latest }
            return lhs.trail.name < rhs.trail.name
        }
    }

    var isEmpty: Bool { trails.isEmpty }

    /// Each trail's length counted once, however often it was walked.
    var totalLengthMeters: Double { trails.compactMap(\.trail.lengthMeters).reduce(0, +) }

    func trail(id: String) -> WalkedTrail? { trails.first { $0.trail.id == id } }
}

/// Joins a registry trail's parts into one route for a trip log, which holds
/// a single line. Parts are chained nearest end to nearest end, flipping any
/// that run the wrong way, so the line doesn't zigzag between them.
enum TrailRoute {
    static func join(_ parts: [[CLLocationCoordinate2D]]) -> [CLLocationCoordinate2D] {
        var remaining = parts.filter { $0.count >= 2 }
        guard !remaining.isEmpty else { return [] }
        // Start from the longest part: on a trail with a short spur, that's the main line.
        let first = remaining.indices.max { remaining[$0].count < remaining[$1].count } ?? 0
        var line = remaining.remove(at: first)
        while !remaining.isEmpty, let tail = line.last {
            var best = (index: 0, reversed: false, distance: Double.infinity)
            for (index, part) in remaining.enumerated() {
                guard let head = part.first, let end = part.last else { continue }
                let toHead = distance(tail, head)
                let toEnd = distance(tail, end)
                if toHead < best.distance { best = (index, false, toHead) }
                if toEnd < best.distance { best = (index, true, toEnd) }
            }
            let next = remaining.remove(at: best.index)
            line.append(contentsOf: best.reversed ? next.reversed() : next)
        }
        return line
    }

    /// The joined line as a trip-log route, simplified like an imported track.
    static func encoded(_ parts: [[CLLocationCoordinate2D]]) -> String? {
        let points = join(parts).map { TrackPoint(latitude: $0.latitude, longitude: $0.longitude, elevation: nil) }
        guard points.count >= 2 else { return nil }
        return Polyline.encode(TrackMath.simplify(points).map(\.coordinate))
    }

    private static func distance(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        CLLocation(latitude: a.latitude, longitude: a.longitude)
            .distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude))
    }
}
