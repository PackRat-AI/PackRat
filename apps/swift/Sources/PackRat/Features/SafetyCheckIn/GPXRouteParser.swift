import Foundation

/// Reads the track (or route, or waypoints) out of a GPX file as a planned
/// route. Long recordings are thinned so the route stays small enough to sync.
enum GPXRouteParser {
    static let maxPoints = 5_000

    enum ParseError: LocalizedError {
        case noPoints

        var errorDescription: String? {
            "That file has no track or route in it. Export a GPX track from your mapping app and try again."
        }
    }

    static func parse(_ data: Data) throws -> [TripRoutePoint] {
        let delegate = Delegate()
        let parser = XMLParser(data: data)
        parser.delegate = delegate
        parser.parse()
        // Prefer a recorded track, then a planned route, then bare waypoints.
        let points = [delegate.trackPoints, delegate.routePoints, delegate.waypoints]
            .first { $0.count >= 2 } ?? []
        guard points.count >= 2 else { throw ParseError.noPoints }
        return thin(points, to: maxPoints)
    }

    /// Keeps every nth point (and always the last) so the shape survives.
    static func thin(_ points: [TripRoutePoint], to limit: Int) -> [TripRoutePoint] {
        guard points.count > limit, limit >= 2 else { return points }
        let stride = Double(points.count - 1) / Double(limit - 1)
        return (0..<limit).map { points[Int((Double($0) * stride).rounded())] }
    }

    /// Total length in metres, for the summary under the route.
    static func lengthMeters(_ points: [TripRoutePoint]) -> Double {
        zip(points, points.dropFirst()).reduce(0) { total, pair in
            total + haversine(pair.0, pair.1)
        }
    }

    private static func haversine(_ a: TripRoutePoint, _ b: TripRoutePoint) -> Double {
        let r = 6_371_000.0
        let dLat = (b.latitude - a.latitude) * .pi / 180
        let dLon = (b.longitude - a.longitude) * .pi / 180
        let lat1 = a.latitude * .pi / 180
        let lat2 = b.latitude * .pi / 180
        let h = sin(dLat / 2) * sin(dLat / 2) + cos(lat1) * cos(lat2) * sin(dLon / 2) * sin(dLon / 2)
        return 2 * r * asin(min(1, sqrt(h)))
    }

    private final class Delegate: NSObject, XMLParserDelegate {
        var trackPoints: [TripRoutePoint] = []
        var routePoints: [TripRoutePoint] = []
        var waypoints: [TripRoutePoint] = []

        func parser(
            _ parser: XMLParser, didStartElement elementName: String, namespaceURI: String?,
            qualifiedName qName: String?, attributes: [String: String] = [:]
        ) {
            guard let lat = attributes["lat"].flatMap(Double.init),
                  let lon = attributes["lon"].flatMap(Double.init),
                  (-90...90).contains(lat), (-180...180).contains(lon)
            else { return }
            let point = TripRoutePoint(latitude: lat, longitude: lon)
            // Element names may carry a namespace prefix, e.g. "gpx:trkpt".
            switch elementName.split(separator: ":").last {
            case "trkpt": trackPoints.append(point)
            case "rtept": routePoints.append(point)
            case "wpt": waypoints.append(point)
            default: break
            }
        }
    }
}
