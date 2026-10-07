import CoreLocation
import Foundation

/// A long-distance trail a user can follow, from the bundled `LongTrails.json`
/// (built by `apps/swift/scripts/generate-long-trails.ts` from each trail's
/// official centerline). Lines are simplified to about 150 m.
///
/// The line is cut into stations about every 400 m. A station is walked when
/// a trip's route passes within `LongTrailProgress.matchMeters` of it, so a
/// section walked twice counts once and a trip off the trail moves nothing.
struct LongTrail: Identifiable, Sendable {
    struct Station: Sendable {
        let line: Int
        let coordinate: CLLocationCoordinate2D
        /// The length of trail this station stands for: the stretch since the previous one.
        let meters: Double
    }

    /// e.g. "PCT". Stable, and what a long-trail goal stores.
    let code: String
    let name: String
    /// The length the trail's stewards publish, which is what the user sees.
    let officialMiles: Double
    let states: [String]
    let lines: [[CLLocationCoordinate2D]]
    let stations: [Station]
    /// The bundled line's own length, shorter than the official one for the
    /// simplification. Progress is a share of this, shown as a share of the official length.
    let lineMeters: Double
    let minLatitude: Double
    let maxLatitude: Double
    let minLongitude: Double
    let maxLongitude: Double

    var id: String { code }
    var officialMeters: Double { officialMiles * 1_609.344 }

    static let stationSpacing: Double = 400

    init(code: String, name: String, officialMiles: Double, states: [String], lines: [[CLLocationCoordinate2D]]) {
        self.code = code
        self.name = name
        self.officialMiles = officialMiles
        self.states = states
        self.lines = lines
        var stations: [Station] = []
        for (index, line) in lines.enumerated() {
            stations += Self.stations(along: line, line: index)
        }
        self.stations = stations
        lineMeters = stations.reduce(0) { $0 + $1.meters }
        let points = lines.flatMap { $0 }
        minLatitude = points.map(\.latitude).min() ?? 0
        maxLatitude = points.map(\.latitude).max() ?? 0
        minLongitude = points.map(\.longitude).min() ?? 0
        maxLongitude = points.map(\.longitude).max() ?? 0
    }

    /// A station every `stationSpacing` metres along the line, plus one at
    /// its end for the remainder, so the stations add up to the line's length.
    private static func stations(along line: [CLLocationCoordinate2D], line index: Int) -> [Station] {
        guard line.count >= 2 else { return [] }
        var stations: [Station] = []
        var sinceLast = 0.0
        for i in 1..<line.count {
            let a = line[i - 1], b = line[i]
            let length = LocalProjection.distance(a, b)
            guard length > 0 else { continue }
            var along = 0.0
            while sinceLast + (length - along) >= stationSpacing {
                along += stationSpacing - sinceLast
                let t = along / length
                stations.append(Station(
                    line: index,
                    coordinate: CLLocationCoordinate2D(
                        latitude: a.latitude + (b.latitude - a.latitude) * t,
                        longitude: a.longitude + (b.longitude - a.longitude) * t
                    ),
                    meters: stationSpacing
                ))
                sinceLast = 0
            }
            sinceLast += length - along
        }
        if sinceLast > 1, let last = line.last {
            stations.append(Station(line: index, coordinate: last, meters: sinceLast))
        }
        return stations
    }

    func mayTouch(south: Double, west: Double, north: Double, east: Double) -> Bool {
        north >= minLatitude && south <= maxLatitude && east >= minLongitude && west <= maxLongitude
    }
}

enum LongTrails {
    /// Every trail, longest-known first. Empty only if the bundled file is missing.
    static let all: [LongTrail] = load(from: .main)

    static func trail(code: String?) -> LongTrail? {
        guard let code else { return nil }
        return all.first { $0.code == code }
    }

    static func load(from bundle: Bundle) -> [LongTrail] {
        guard let url = bundle.url(forResource: "LongTrails", withExtension: "json"),
              let data = try? Data(contentsOf: url)
        else { return [] }
        return decode(data)
    }

    static func decode(_ data: Data) -> [LongTrail] {
        struct Row: Decodable {
            let code: String
            let name: String
            let officialMiles: Double
            let states: [String]
            /// Encoded polylines, precision 5, like trip routes.
            let lines: [String]
        }
        guard let rows = try? JSONDecoder().decode([Row].self, from: data) else { return [] }
        return rows.map {
            LongTrail(
                code: $0.code,
                name: $0.name,
                officialMiles: $0.officialMiles,
                states: $0.states,
                lines: $0.lines.map { Polyline.decode($0) }.filter { $0.count >= 2 }
            )
        }
    }
}

/// Metres on a flat plane around a point: plenty at the few hundred metres
/// trail matching works at, and much cheaper than great-circle maths.
enum LocalProjection {
    static let metersPerDegreeLatitude = 110_574.0

    static func distance(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        let scale = cos((a.latitude + b.latitude) / 2 * .pi / 180) * 111_320
        let dx = (b.longitude - a.longitude) * scale
        let dy = (b.latitude - a.latitude) * metersPerDegreeLatitude
        return (dx * dx + dy * dy).squareRoot()
    }

    /// Shortest distance from `p` to the segment `a`–`b`.
    static func distance(from p: CLLocationCoordinate2D, toSegment a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        let scale = cos(p.latitude * .pi / 180) * 111_320
        let bx = (b.longitude - a.longitude) * scale, by = (b.latitude - a.latitude) * metersPerDegreeLatitude
        let px = (p.longitude - a.longitude) * scale, py = (p.latitude - a.latitude) * metersPerDegreeLatitude
        let lengthSquared = bx * bx + by * by
        let t = lengthSquared > 0 ? min(max((px * bx + py * by) / lengthSquared, 0), 1) : 0
        let dx = px - t * bx, dy = py - t * by
        return (dx * dx + dy * dy).squareRoot()
    }
}

// MARK: - Progress

/// How much of a long trail the user's finished trips have walked, worked out
/// from their logged routes. Pure, like `TripStats`.
struct LongTrailProgress: Identifiable, Sendable {
    /// A trip whose route walked part of the trail.
    struct TripSection: Identifiable, Sendable {
        let trip: TripStats.FinishedTrip
        /// Official-scale metres of the trail this trip walked.
        let meters: Double
        /// Of those, the metres no earlier trip had walked.
        let newMeters: Double

        var id: String { trip.id }
    }

    /// How close a route has to pass to a station to walk it: the trail line
    /// is simplified to ~150 m, and GPS and route simplification add a little.
    static let matchMeters = 300.0

    let trail: LongTrail
    /// Indices into `trail.stations`.
    let walked: Set<Int>
    /// Oldest first.
    let trips: [TripSection]

    var id: String { trail.code }
    var fraction: Double {
        guard trail.lineMeters > 0 else { return 0 }
        return min(walked.reduce(0) { $0 + trail.stations[$1].meters } / trail.lineMeters, 1)
    }
    /// On the official length's scale, so "of 2,650 mi" adds up.
    var meters: Double { fraction * trail.officialMeters }
    var hasProgress: Bool { !walked.isEmpty }

    init(trail: LongTrail, finished: [TripStats.FinishedTrip]) {
        self.trail = trail
        var walked = Set<Int>()
        var sections: [TripSection] = []
        let scale = trail.lineMeters > 0 ? trail.officialMeters / trail.lineMeters : 1
        for trip in finished.sorted(by: { $0.start < $1.start }) {
            let stations = LongTrailCoverageCache.shared.stations(of: trail, walkedBy: trip.trip)
            guard !stations.isEmpty else { continue }
            let fresh = stations.subtracting(walked)
            sections.append(TripSection(
                trip: trip,
                meters: stations.reduce(0) { $0 + trail.stations[$1].meters } * scale,
                newMeters: fresh.reduce(0) { $0 + trail.stations[$1].meters } * scale
            ))
            walked.formUnion(stations)
        }
        self.walked = walked
        self.trips = sections
    }

    /// The walked stretches as lines to draw over the trail. Each station
    /// stands for the stretch since the one before, so a run starts there.
    var walkedLines: [[CLLocationCoordinate2D]] {
        var lines: [[CLLocationCoordinate2D]] = []
        var current: [CLLocationCoordinate2D] = []
        for index in trail.stations.indices {
            let station = trail.stations[index]
            guard walked.contains(index) else {
                if current.count >= 2 { lines.append(current) }
                current = []
                continue
            }
            if current.isEmpty {
                let previous = index > 0 ? trail.stations[index - 1] : nil
                if let previous, previous.line == station.line {
                    current.append(previous.coordinate)
                } else if let start = trail.lines[station.line].first {
                    current.append(start)
                }
            } else if trail.stations[index - 1].line != station.line {
                if current.count >= 2 { lines.append(current) }
                current = trail.lines[station.line].first.map { [$0] } ?? []
            }
            current.append(station.coordinate)
        }
        if current.count >= 2 { lines.append(current) }
        return lines
    }

    /// The stations `route` walks: those within `matchMeters` of one of its segments.
    static func stations(of trail: LongTrail, walkedBy route: [CLLocationCoordinate2D]) -> Set<Int> {
        guard route.count >= 2 else { return [] }
        let pad = matchMeters / LocalProjection.metersPerDegreeLatitude
        let south = (route.map(\.latitude).min() ?? 0) - pad
        let north = (route.map(\.latitude).max() ?? 0) + pad
        // Longitude degrees shrink toward the poles; 0.6 covers up to ~53°.
        let west = (route.map(\.longitude).min() ?? 0) - pad / 0.6
        let east = (route.map(\.longitude).max() ?? 0) + pad / 0.6
        guard trail.mayTouch(south: south, west: west, north: north, east: east) else { return [] }

        let grid = SegmentGrid(route: route)
        var walked = Set<Int>()
        for (index, station) in trail.stations.enumerated() {
            let c = station.coordinate
            guard c.latitude >= south, c.latitude <= north, c.longitude >= west, c.longitude <= east else { continue }
            if grid.nearestDistance(to: c, within: matchMeters) <= matchMeters { walked.insert(index) }
        }
        return walked
    }
}

/// Route segments bucketed by ~550 m cells, so a station checks only the
/// segments near it rather than the whole route.
private struct SegmentGrid {
    static let cell = 0.005

    private var buckets: [Int64: [Int]] = [:]
    private let route: [CLLocationCoordinate2D]

    init(route: [CLLocationCoordinate2D]) {
        self.route = route
        for i in 1..<route.count {
            let a = route[i - 1], b = route[i]
            let (x0, y0) = Self.cellOf(CLLocationCoordinate2D(latitude: min(a.latitude, b.latitude), longitude: min(a.longitude, b.longitude)))
            let (x1, y1) = Self.cellOf(CLLocationCoordinate2D(latitude: max(a.latitude, b.latitude), longitude: max(a.longitude, b.longitude)))
            // A long straight segment (a sparse import) spans many cells; cap the sweep.
            guard (x1 - x0 + 1) * (y1 - y0 + 1) <= 40_000 else { continue }
            for x in x0...x1 {
                for y in y0...y1 { buckets[Self.key(x, y), default: []].append(i) }
            }
        }
    }

    func nearestDistance(to point: CLLocationCoordinate2D, within meters: Double) -> Double {
        let (cx, cy) = Self.cellOf(point)
        // One cell is ≥ ~330 m east–west up to 53° north, which covers `meters`.
        let reach = Int((meters / (Self.cell * LocalProjection.metersPerDegreeLatitude * 0.6)).rounded(.up))
        var best = Double.infinity
        for x in (cx - reach)...(cx + reach) {
            for y in (cy - reach)...(cy + reach) {
                for i in buckets[Self.key(x, y)] ?? [] {
                    best = min(best, LocalProjection.distance(from: point, toSegment: route[i - 1], route[i]))
                    if best <= meters { return best }
                }
            }
        }
        return best
    }

    private static func cellOf(_ c: CLLocationCoordinate2D) -> (Int, Int) {
        (Int((c.longitude / cell).rounded(.down)), Int((c.latitude / cell).rounded(.down)))
    }

    private static func key(_ x: Int, _ y: Int) -> Int64 { Int64(x) << 32 | Int64(UInt32(bitPattern: Int32(y))) }
}

/// Matching a route against a trail is the slow part, and a trip's route
/// rarely changes, so each answer is kept per trail, trip and route.
final class LongTrailCoverageCache: @unchecked Sendable {
    static let shared = LongTrailCoverageCache()

    private let lock = NSLock()
    private var answers: [String: Set<Int>] = [:]

    func stations(of trail: LongTrail, walkedBy trip: Trip) -> Set<Int> {
        guard let encoded = trip.log?.route, !encoded.isEmpty else { return [] }
        let key = "\(trail.code)|\(trip.id)|\(encoded.hashValue)"
        lock.lock()
        let known = answers[key]
        lock.unlock()
        if let known { return known }
        let walked = LongTrailProgress.stations(of: trail, walkedBy: Polyline.decode(encoded))
        lock.lock()
        answers[key] = walked
        lock.unlock()
        return walked
    }
}
