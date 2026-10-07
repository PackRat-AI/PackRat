import CoreLocation
import Foundation

/// One recorded point of a GPS track.
struct TrackPoint: Equatable, Sendable {
    let latitude: Double
    let longitude: Double
    /// Metres above sea level, when the recorder wrote one.
    let elevation: Double?

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

/// What a track file adds to a trip log: how far, how much climbing, and the
/// line itself, simplified and encoded for upload.
struct TrackSummary: Equatable, Sendable {
    let distanceMeters: Double
    /// Nil when the file carries no elevations, so the log keeps a typed-in figure.
    let elevationGainMeters: Double?
    let route: String

    init?(points: [TrackPoint]) {
        guard points.count >= 2 else { return nil }
        distanceMeters = TrackMath.distance(points)
        elevationGainMeters = TrackMath.elevationGain(points)
        route = Polyline.encode(TrackMath.simplify(points).map(\.coordinate))
    }
}

// MARK: - GPX

/// Reads the points out of a GPX 1.0/1.1 file. Track points (`trkpt`) win;
/// a file holding only a planned route (`rtept`) falls back to that.
enum GPXParser {
    enum Failure: LocalizedError {
        case unreadable
        case noPoints

        var errorDescription: String? {
            switch self {
            case .unreadable: return "This file isn't a GPX track PackRat can read."
            case .noPoints: return "This file has no track points in it."
            }
        }
    }

    static func parse(_ data: Data) throws -> [TrackPoint] {
        let delegate = Delegate()
        let parser = XMLParser(data: data)
        parser.delegate = delegate
        guard parser.parse() else { throw Failure.unreadable }
        let points = delegate.trackPoints.isEmpty ? delegate.routePoints : delegate.trackPoints
        guard !points.isEmpty else { throw Failure.noPoints }
        return points
    }

    private final class Delegate: NSObject, XMLParserDelegate {
        var trackPoints: [TrackPoint] = []
        var routePoints: [TrackPoint] = []

        private var current: (lat: Double, lon: Double, isTrack: Bool)?
        private var elevation: Double?
        private var text = ""
        private var readingElevation = false

        func parser(
            _ parser: XMLParser,
            didStartElement elementName: String,
            namespaceURI: String?,
            qualifiedName: String?,
            attributes: [String: String] = [:]
        ) {
            switch localName(elementName) {
            case "trkpt", "rtept":
                guard let lat = attributes["lat"].flatMap(Double.init),
                      let lon = attributes["lon"].flatMap(Double.init),
                      (-90...90).contains(lat), (-180...180).contains(lon)
                else { current = nil; return }
                current = (lat, lon, localName(elementName) == "trkpt")
                elevation = nil
            case "ele" where current != nil:
                readingElevation = true
                text = ""
            default:
                break
            }
        }

        func parser(_ parser: XMLParser, foundCharacters string: String) {
            if readingElevation { text += string }
        }

        func parser(
            _ parser: XMLParser,
            didEndElement elementName: String,
            namespaceURI: String?,
            qualifiedName: String?
        ) {
            switch localName(elementName) {
            case "ele" where readingElevation:
                elevation = Double(text.trimmingCharacters(in: .whitespacesAndNewlines))
                readingElevation = false
            case "trkpt", "rtept":
                guard let point = current else { return }
                let trackPoint = TrackPoint(latitude: point.lat, longitude: point.lon, elevation: elevation)
                if point.isTrack { trackPoints.append(trackPoint) } else { routePoints.append(trackPoint) }
                current = nil
            default:
                break
            }
        }

        /// Some exporters prefix GPX elements with a namespace (`gpx:trkpt`).
        private func localName(_ name: String) -> String {
            name.split(separator: ":").last.map(String.init) ?? name
        }
    }
}

// MARK: - Track maths

enum TrackMath {
    /// Great-circle length of the line through every point.
    static func distance(_ points: [TrackPoint]) -> Double {
        zip(points, points.dropFirst()).reduce(0) { total, pair in
            total + haversine(pair.0, pair.1)
        }
    }

    /// Total climbing. GPS elevations jitter by several metres, so summing
    /// every rise inflates the figure badly on a flat walk. A climb only
    /// counts once it rises `threshold` above the last low point, the
    /// hysteresis most fitness apps apply.
    static func elevationGain(_ points: [TrackPoint], threshold: Double = 3) -> Double? {
        let elevations = points.compactMap(\.elevation)
        guard elevations.count >= 2, var reference = elevations.first else { return nil }
        var gain = 0.0
        for elevation in elevations.dropFirst() {
            if elevation - reference >= threshold {
                gain += elevation - reference
                reference = elevation
            } else if elevation < reference {
                reference = elevation
            }
        }
        return gain
    }

    /// Douglas–Peucker simplification, tightened until the line fits in
    /// `maxPoints`. A day's recording at one point a second is tens of
    /// thousands of points; a few hundred draw the same line on a map.
    static func simplify(_ points: [TrackPoint], tolerance: Double = 5, maxPoints: Int = 1_500) -> [TrackPoint] {
        guard points.count > 2 else { return points }
        var tolerance = tolerance
        var result = douglasPeucker(points, tolerance: tolerance)
        while result.count > maxPoints {
            tolerance *= 2
            result = douglasPeucker(points, tolerance: tolerance)
        }
        return result
    }

    static func haversine(_ a: TrackPoint, _ b: TrackPoint) -> Double {
        let radius = 6_371_008.8
        let lat1 = a.latitude * .pi / 180
        let lat2 = b.latitude * .pi / 180
        let dLat = lat2 - lat1
        let dLon = (b.longitude - a.longitude) * .pi / 180
        let h = sin(dLat / 2) * sin(dLat / 2) + cos(lat1) * cos(lat2) * sin(dLon / 2) * sin(dLon / 2)
        return 2 * radius * asin(min(1, sqrt(h)))
    }

    private static func douglasPeucker(_ points: [TrackPoint], tolerance: Double) -> [TrackPoint] {
        guard points.count > 2, let origin = points.first else { return points }
        // Project to local metres once; a single track spans too little of
        // the globe for the flat-earth error to matter at these tolerances.
        let metresPerDegreeLat = 111_320.0
        let metresPerDegreeLon = metresPerDegreeLat * cos(origin.latitude * .pi / 180)
        let xy = points.map {
            (x: ($0.longitude - origin.longitude) * metresPerDegreeLon,
             y: ($0.latitude - origin.latitude) * metresPerDegreeLat)
        }

        var keep = [Bool](repeating: false, count: points.count)
        keep[0] = true
        keep[points.count - 1] = true
        var stack = [(0, points.count - 1)]
        while let (first, last) = stack.popLast() {
            guard last > first + 1 else { continue }
            var maxDistance = 0.0
            var index = first
            for i in (first + 1)..<last {
                let d = perpendicularDistance(xy[i], xy[first], xy[last])
                if d > maxDistance {
                    maxDistance = d
                    index = i
                }
            }
            if maxDistance > tolerance {
                keep[index] = true
                stack.append((first, index))
                stack.append((index, last))
            }
        }
        return points.indices.filter { keep[$0] }.map { points[$0] }
    }

    private static func perpendicularDistance(
        _ p: (x: Double, y: Double),
        _ a: (x: Double, y: Double),
        _ b: (x: Double, y: Double)
    ) -> Double {
        let dx = b.x - a.x
        let dy = b.y - a.y
        let lengthSquared = dx * dx + dy * dy
        guard lengthSquared > 0 else { return hypot(p.x - a.x, p.y - a.y) }
        let t = max(0, min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared))
        return hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
    }
}

// MARK: - Encoded polyline

/// Google's encoded polyline format at precision 5 (about a metre), the form
/// a trip log's `route` is stored and synced in.
enum Polyline {
    static func encode(_ coordinates: [CLLocationCoordinate2D]) -> String {
        var output = ""
        var previousLat = 0
        var previousLon = 0
        for coordinate in coordinates {
            let lat = Int((coordinate.latitude * 1e5).rounded())
            let lon = Int((coordinate.longitude * 1e5).rounded())
            output += encodeValue(lat - previousLat)
            output += encodeValue(lon - previousLon)
            previousLat = lat
            previousLon = lon
        }
        return output
    }

    /// Returns an empty array for a malformed string rather than a partial line.
    static func decode(_ string: String) -> [CLLocationCoordinate2D] {
        let bytes = Array(string.utf8)
        var coordinates: [CLLocationCoordinate2D] = []
        var index = 0
        var lat = 0
        var lon = 0
        while index < bytes.count {
            guard let dLat = decodeValue(bytes, &index), let dLon = decodeValue(bytes, &index) else { return [] }
            lat += dLat
            lon += dLon
            coordinates.append(CLLocationCoordinate2D(latitude: Double(lat) / 1e5, longitude: Double(lon) / 1e5))
        }
        return coordinates
    }

    private static func encodeValue(_ value: Int) -> String {
        var v = value < 0 ? ~(value << 1) : value << 1
        var output = ""
        while v >= 0x20 {
            output.append(Character(UnicodeScalar(UInt8((0x20 | (v & 0x1F)) + 63))))
            v >>= 5
        }
        output.append(Character(UnicodeScalar(UInt8(v + 63))))
        return output
    }

    private static func decodeValue(_ bytes: [UInt8], _ index: inout Int) -> Int? {
        var result = 0
        var shift = 0
        while index < bytes.count {
            let byte = Int(bytes[index]) - 63
            index += 1
            guard byte >= 0, shift < 60 else { return nil }
            result |= (byte & 0x1F) << shift
            shift += 5
            if byte < 0x20 {
                return (result & 1) != 0 ? ~(result >> 1) : result >> 1
            }
        }
        return nil
    }
}
