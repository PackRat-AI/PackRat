import CoreLocation
import Foundation

/// The bundled landscape grid (`Resources/Landscapes.bin`, built by
/// `scripts/generate-landscapes.ts`): one code per 0.05° cell, row 0 at 90°N,
/// column 0 at 180°W, stored and held as runs per row (~1 MB in memory).
struct LandscapeGrid: Sendable {
    static let cellSize = 0.05
    static let width = 7_200
    static let height = 3_600

    /// Per row: the last column of each run, and its code.
    private let runEnds: [[UInt16]]
    private let runCodes: [[UInt8]]

    static let shared = LandscapeGrid.load(from: .main)

    static func load(from bundle: Bundle) -> LandscapeGrid {
        guard let url = bundle.url(forResource: "Landscapes", withExtension: "bin"),
              let compressed = try? Data(contentsOf: url),
              let runs = try? (compressed as NSData).decompressed(using: .zlib) as Data
        else { return LandscapeGrid(runEnds: [], runCodes: []) }
        return decode(runs)
    }

    /// Per row: UInt16 count, then `count` UInt16 last columns, then `count`
    /// UInt8 codes, little-endian. A truncated file reads as empty.
    static func decode(_ data: Data) -> LandscapeGrid {
        let bytes = [UInt8](data)
        var ends: [[UInt16]] = []
        var codes: [[UInt8]] = []
        ends.reserveCapacity(height)
        codes.reserveCapacity(height)
        var offset = 0
        func u16(_ at: Int) -> UInt16 { UInt16(bytes[at]) | UInt16(bytes[at + 1]) << 8 }
        for _ in 0..<height {
            guard offset + 2 <= bytes.count else { return LandscapeGrid(runEnds: [], runCodes: []) }
            let count = Int(u16(offset))
            offset += 2
            guard count > 0, offset + count * 3 <= bytes.count else { return LandscapeGrid(runEnds: [], runCodes: []) }
            ends.append((0..<count).map { u16(offset + $0 * 2) })
            offset += count * 2
            codes.append(Array(bytes[offset..<(offset + count)]))
            offset += count
        }
        return LandscapeGrid(runEnds: ends, runCodes: codes)
    }

    init(runEnds: [[UInt16]], runCodes: [[UInt8]]) {
        self.runEnds = runEnds
        self.runCodes = runCodes
    }

    var isEmpty: Bool { runEnds.isEmpty }

    func code(row: Int, column: Int) -> UInt8 {
        guard row >= 0, row < runEnds.count else { return 0 }
        let ends = runEnds[row]
        let wrapped = (column % Self.width + Self.width) % Self.width
        var low = 0
        var high = ends.count - 1
        while low < high {
            let mid = (low + high) / 2
            if Int(ends[mid]) < wrapped { low = mid + 1 } else { high = mid }
        }
        return runCodes[row][low]
    }

    /// The landscape at a spot. A point just offshore (a beach pin, a
    /// simplified coastline) reads as coastal when land is within two cells.
    func landscape(at coordinate: CLLocationCoordinate2D) -> TripLandscape? {
        guard !isEmpty else { return nil }
        let row = Int(((90 - coordinate.latitude) / Self.cellSize).rounded(.down))
        let column = Int(((coordinate.longitude + 180) / Self.cellSize).rounded(.down))
        if let landscape = TripLandscape(gridCode: code(row: row, column: column)) { return landscape }
        for dr in -2...2 {
            for dc in -2...2 where TripLandscape(gridCode: code(row: row + dr, column: column + dc)) != nil {
                return .coastal
            }
        }
        return nil
    }
}

extension TripLandscape {
    /// The byte for each landscape in `Landscapes.bin`; 0 is open sea.
    init?(gridCode: UInt8) {
        switch gridCode {
        case 1: self = .desert
        case 2: self = .grassland
        case 3: self = .forest
        case 4: self = .polar
        case 5: self = .mountain
        case 6: self = .coastal
        case 7: self = .water
        default: return nil
        }
    }
}

/// Which landscape each trip was in, and the breakdown for the stats screen.
/// Pure, like `TripStats`.
struct TripLandscapes: Sendable {
    struct Bucket: Identifiable, Sendable {
        let landscape: TripLandscape
        /// Newest first.
        let trips: [TripStats.FinishedTrip]

        var id: TripLandscape { landscape }
    }

    /// Most trips first.
    let buckets: [Bucket]

    var isEmpty: Bool { buckets.isEmpty }

    init(finished: [TripStats.FinishedTrip], grid: LandscapeGrid = .shared) {
        var grouped: [TripLandscape: [TripStats.FinishedTrip]] = [:]
        for trip in finished {
            guard let landscape = Self.landscape(of: trip.trip, grid: grid) else { continue }
            grouped[landscape, default: []].append(trip)
        }
        buckets = grouped
            .map { Bucket(landscape: $0.key, trips: $0.value.sorted { $0.start > $1.start }) }
            .sorted { lhs, rhs in
                if lhs.trips.count != rhs.trips.count { return lhs.trips.count > rhs.trips.count }
                return (TripLandscape.allCases.firstIndex(of: lhs.landscape) ?? 0)
                    < (TripLandscape.allCases.firstIndex(of: rhs.landscape) ?? 0)
            }
    }

    /// The user's choice, else the map's answer at the trip's spot (or the
    /// middle of its route), sharpened by the log: a summit, a climbing or
    /// ski trip, or steady climbing turns open country into mountain, and a
    /// paddling trip inland is lakes and rivers.
    static func landscape(of trip: Trip, grid: LandscapeGrid = .shared) -> TripLandscape? {
        if let chosen = trip.log?.landscape { return chosen }
        guard let spot = spot(of: trip), let mapped = grid.landscape(at: spot) else { return nil }
        guard mapped == .forest || mapped == .grassland || mapped == .desert, let log = trip.log else { return mapped }
        if isMountainous(log) { return .mountain }
        if log.activities.contains(.paddling) { return .water }
        return mapped
    }

    static func spot(of trip: Trip) -> CLLocationCoordinate2D? {
        if let location = trip.location {
            return CLLocationCoordinate2D(latitude: location.latitude, longitude: location.longitude)
        }
        let route = trip.log?.route.map(Polyline.decode) ?? []
        return route.isEmpty ? nil : route[route.count / 2]
    }

    /// 500 m of climbing at 40 m a kilometre or more is a mountain day by most
    /// hiking-difficulty scales (e.g. Shenandoah's rating, AllTrails' "hard").
    static func isMountainous(_ log: TripLog) -> Bool {
        if !log.summits.isEmpty { return true }
        if !Set(log.activities).isDisjoint(with: [.climbing, .mountaineering, .skiing]) { return true }
        guard let gain = log.elevationGainMeters, gain >= 500 else { return false }
        guard let distance = log.distanceMeters, distance > 0 else { return true }
        return gain / (distance / 1_000) >= 40
    }
}
