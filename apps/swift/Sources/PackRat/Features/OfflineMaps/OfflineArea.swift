import CoreLocation
import Defaults
import Foundation

/// How much of the map a saved area keeps.
///
/// Zoom ranges end on Mapbox's tile-pack group edges (0-5, 6-10, 11-14,
/// 15-16): a request inside a group downloads the whole group anyway, so
/// stopping mid-group would cost the same space and show less.
enum OfflineDetailLevel: String, Codable, CaseIterable, Identifiable, Defaults.Serializable {
    case standard
    case trail

    var id: String { rawValue }

    var label: String {
        switch self {
        case .standard: return "Standard"
        case .trail: return "Trail detail"
        }
    }

    var summary: String {
        switch self {
        case .standard: return "Roads, towns and terrain."
        case .trail: return "Adds the closest zoom levels for following a path."
        }
    }

    var maxZoom: UInt8 {
        switch self {
        case .standard: return 14
        case .trail: return 16
        }
    }
}

/// The rectangle a saved area covers, stored as plain degrees so it encodes
/// without depending on the map SDK.
struct OfflineAreaBounds: Codable, Hashable, Defaults.Serializable {
    var south: Double
    var west: Double
    var north: Double
    var east: Double

    var center: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: (south + north) / 2, longitude: (west + east) / 2)
    }

    /// Closed ring, counter-clockwise from the south-west corner.
    var ring: [CLLocationCoordinate2D] {
        [
            CLLocationCoordinate2D(latitude: south, longitude: west),
            CLLocationCoordinate2D(latitude: south, longitude: east),
            CLLocationCoordinate2D(latitude: north, longitude: east),
            CLLocationCoordinate2D(latitude: north, longitude: west),
            CLLocationCoordinate2D(latitude: south, longitude: west),
        ]
    }

    func contains(_ coordinate: CLLocationCoordinate2D) -> Bool {
        (south...north).contains(coordinate.latitude) && (west...east).contains(coordinate.longitude)
    }
}

extension OfflineAreaBounds {
    /// The rectangle around a set of rings.
    init?(enclosing rings: [[CLLocationCoordinate2D]]) {
        let points = rings.flatMap { $0 }
        guard let first = points.first else { return nil }
        var bounds = OfflineAreaBounds(south: first.latitude, west: first.longitude, north: first.latitude, east: first.longitude)
        for point in points {
            bounds.south = min(bounds.south, point.latitude)
            bounds.north = max(bounds.north, point.latitude)
            bounds.west = min(bounds.west, point.longitude)
            bounds.east = max(bounds.east, point.longitude)
        }
        self = bounds
    }
}

/// A point on a saved trail line, stored as plain degrees like the bounds.
struct OfflinePoint: Codable, Hashable, Defaults.Serializable {
    var latitude: Double
    var longitude: Double

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

/// A map area the user saved for offline use.
///
/// The tiles live in Mapbox's tile store under `id`; this record carries
/// what the tile store does not: the user's name for it, the detail level,
/// and the trip or trail it was saved for.
struct OfflineArea: Codable, Hashable, Identifiable, Defaults.Serializable {
    var id: String
    var name: String
    var bounds: OfflineAreaBounds
    var detail: OfflineDetailLevel
    var savedAt: Date
    var tripId: String?
    var tripEndDate: Date?
    var trailId: String?
    /// The trail's line, kept so the saved map can draw it without signal.
    var trailLines: [[OfflinePoint]]?
    /// A named region's outline. Nil for a hand-framed area, which covers
    /// `bounds`.
    var boundary: [[OfflinePoint]]?
    /// Bytes on disk once the download finished. Zero while downloading.
    var sizeBytes: Int64 = 0
    /// False until every tile has arrived, so an interrupted download can be
    /// picked up again on the next launch.
    var isComplete: Bool = false

    /// The shape the saved tiles cover.
    var rings: [[CLLocationCoordinate2D]] {
        boundary.map { rings in rings.map { ring in ring.map(\.coordinate) } } ?? [bounds.ring]
    }

    var tripHasEnded: Bool {
        guard let tripEndDate else { return false }
        return tripEndDate < Date()
    }
}

/// Mapbox's cap on saved map data, counted the way the SDK counts it.
///
/// Tiles are saved in packs: one pack per tile at an index zoom, holding that
/// tile's children down to the group's deepest zoom (0-5 from zoom 0, 6-10
/// from 6, 11-14 from 11, 15-16 from 12). The SDK refuses a download that
/// would take the device past 750 unique packs across every saved area, so
/// "too large" is a pack count, not a byte count.
enum OfflineTilePacks {
    static let limit = 750
    /// What we let through. Our count runs a few packs under the SDK's (a
    /// Yosemite plus Vermont pair we put at 742 was refused), so keep a margin
    /// rather than offer a download the SDK will turn down.
    static let budget = 700

    private static func indexZooms(_ detail: OfflineDetailLevel) -> [(group: Int, zoom: Int)] {
        switch detail {
        case .standard: return [(0, 0), (6, 6), (11, 11)]
        case .trail: return [(0, 0), (6, 6), (11, 11), (15, 12)]
        }
    }

    /// The packs covering the rings at the given detail, as stable keys.
    static func packs(for rings: [[CLLocationCoordinate2D]], detail: OfflineDetailLevel) -> Set<String> {
        var keys = Set<String>()
        for (group, zoom) in indexZooms(detail) {
            for tile in tiles(covering: rings, zoom: zoom) {
                keys.insert("\(group)/\(zoom)/\(tile.x)/\(tile.y)")
            }
        }
        return keys
    }

    /// Packs a new area would add on top of the saved ones, and how many the
    /// saved ones already use.
    static func budget(
        adding rings: [[CLLocationCoordinate2D]],
        detail: OfflineDetailLevel,
        to saved: [OfflineArea]
    ) -> (used: Int, added: Int) {
        let used = saved.reduce(into: Set<String>()) { $0.formUnion(packs(for: $1.rings, detail: $1.detail)) }
        return (used.count, packs(for: rings, detail: detail).subtracting(used).count)
    }

    struct Tile: Hashable {
        let x: Int
        let y: Int
    }

    /// Every tile at `zoom` the rings touch: tiles any edge passes through,
    /// plus tiles whose centre lies inside a ring.
    ///
    /// Stops early past `maxTiles`: by then the area is far over the limit
    /// and the exact count no longer matters.
    static func tiles(covering rings: [[CLLocationCoordinate2D]], zoom: Int, maxTiles: Int = limit * 4) -> Set<Tile> {
        let scale = Double(1 << zoom)
        var tiles = Set<Tile>()
        for ring in rings where !ring.isEmpty {
            let points = ring.map { project($0, scale: scale) }
            for (a, b) in zip(points, points.dropFirst() + [points[0]]) {
                insertTiles(from: a, to: b, scale: scale, into: &tiles)
                if tiles.count > maxTiles { return tiles }
            }
            // Interior: for each row of tile centres, fill between the points
            // where the ring crosses it (even-odd).
            let minY = Int(points.map(\.y).min() ?? 0), maxY = Int(points.map(\.y).max() ?? 0)
            guard maxY > minY + 1 else { continue }
            for y in (minY + 1)..<maxY {
                let rowY = Double(y) + 0.5
                var crossings: [Double] = []
                for (a, b) in zip(points, points.dropFirst() + [points[0]]) where (a.y > rowY) != (b.y > rowY) {
                    crossings.append(a.x + (rowY - a.y) / (b.y - a.y) * (b.x - a.x))
                }
                crossings.sort()
                for pair in stride(from: 0, to: crossings.count - 1, by: 2) {
                    let from = Int((crossings[pair] - 0.5).rounded(.up)), to = Int((crossings[pair + 1] - 0.5).rounded(.down))
                    guard from <= to else { continue }
                    for x in from...to { tiles.insert(Tile(x: x, y: y)) }
                    if tiles.count > maxTiles { return tiles }
                }
            }
        }
        return tiles
    }

    /// Web Mercator tile space at the given scale (tiles across the world).
    private static func project(_ coordinate: CLLocationCoordinate2D, scale: Double) -> (x: Double, y: Double) {
        let latitude = min(max(coordinate.latitude, -85.0511), 85.0511) * .pi / 180
        let x = (coordinate.longitude + 180) / 360 * scale
        let y = (1 - log(tan(latitude) + 1 / cos(latitude)) / .pi) / 2 * scale
        return (x, y)
    }

    /// Every tile an edge passes through, walked one grid line at a time
    /// (Amanatides and Woo). An edge through a tile corner takes both tiles
    /// beside it, so the count errs high rather than letting an area through.
    private static func insertTiles(
        from a: (x: Double, y: Double),
        to b: (x: Double, y: Double),
        scale: Double,
        into tiles: inout Set<Tile>
    ) {
        let last = Int(scale) - 1
        func insert(_ x: Int, _ y: Int) {
            tiles.insert(Tile(x: min(max(x, 0), last), y: min(max(y, 0), last)))
        }
        var x = Int(a.x.rounded(.down)), y = Int(a.y.rounded(.down))
        let endX = Int(b.x.rounded(.down)), endY = Int(b.y.rounded(.down))
        let dx = b.x - a.x, dy = b.y - a.y
        let stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1
        let deltaX = dx == 0 ? .infinity : abs(1 / dx), deltaY = dy == 0 ? .infinity : abs(1 / dy)
        // How far along the edge (0...1) the next vertical and horizontal grid lines are.
        var nextX = dx == 0 ? .infinity : (dx > 0 ? Double(x + 1) - a.x : a.x - Double(x)) / abs(dx)
        var nextY = dy == 0 ? .infinity : (dy > 0 ? Double(y + 1) - a.y : a.y - Double(y)) / abs(dy)
        insert(x, y)
        while x != endX || y != endY {
            if y == endY || (x != endX && nextX < nextY) {
                x += stepX
                nextX += deltaX
            } else if x == endX || nextY < nextX {
                y += stepY
                nextY += deltaY
            } else {
                insert(x + stepX, y)
                insert(x, y + stepY)
                x += stepX
                y += stepY
                nextX += deltaX
                nextY += deltaY
            }
            insert(x, y)
        }
    }
}

extension Defaults.Keys {
    static let offlineAreas = Key<[OfflineArea]>("offlineAreas", default: [])
    /// Off by default: map downloads run to hundreds of megabytes.
    static let offlineMapsAllowCellular = Key<Bool>("offlineMapsAllowCellular", default: false)
}

extension Int64 {
    var fileSizeText: String { ByteCountFormatter.string(fromByteCount: self, countStyle: .file) }
}
