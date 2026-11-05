import Foundation

/// Where the user stands against a planned route: how far along it, how far
/// is left, and how far off it they are.
///
/// Works on a local flat projection around each segment, which is accurate to
/// well under a metre over the few hundred metres between route points.
struct RouteProgress: Equatable, Sendable {
    /// Metres from the user to the nearest point on the route.
    let offRouteMeters: Double
    /// Metres along the route to that nearest point.
    let alongMeters: Double
    /// Metres left from that point to the end of the route.
    let remainingMeters: Double
    /// Compass bearing (0 = north) from the user to the nearest point on the route.
    let bearingToRoute: Double

    /// Further than this from the line counts as off route. GPS on a phone
    /// under trees drifts 20–30 m, so anything tighter cries wolf.
    static let offRouteThreshold = 75.0

    var isOnRoute: Bool { offRouteMeters <= Self.offRouteThreshold }

    init?(position: TripRoutePoint, route: [TripRoutePoint]) {
        guard route.count >= 2 else { return nil }
        var best: (distance: Double, along: Double, point: TripRoutePoint)?
        var travelled = 0.0
        for (a, b) in zip(route, route.dropFirst()) {
            let length = Geo.distance(a, b)
            let (t, nearest) = Geo.project(position, ontoSegment: a, b)
            let distance = Geo.distance(position, nearest)
            if distance < (best?.distance ?? .infinity) {
                best = (distance, travelled + t * length, nearest)
            }
            travelled += length
        }
        guard let best else { return nil }
        offRouteMeters = best.distance
        alongMeters = best.along
        remainingMeters = max(0, travelled - best.along)
        bearingToRoute = Geo.bearing(from: position, to: best.point)
    }
}

/// Small spherical-earth helpers shared by the voice answers.
enum Geo {
    static let earthRadius = 6_371_000.0

    static func distance(_ a: TripRoutePoint, _ b: TripRoutePoint) -> Double {
        let dLat = (b.latitude - a.latitude) * .pi / 180
        let dLon = (b.longitude - a.longitude) * .pi / 180
        let lat1 = a.latitude * .pi / 180
        let lat2 = b.latitude * .pi / 180
        let h = sin(dLat / 2) * sin(dLat / 2) + cos(lat1) * cos(lat2) * sin(dLon / 2) * sin(dLon / 2)
        return 2 * earthRadius * asin(min(1, sqrt(h)))
    }

    /// Initial bearing in degrees, 0 = north, clockwise.
    static func bearing(from a: TripRoutePoint, to b: TripRoutePoint) -> Double {
        let lat1 = a.latitude * .pi / 180
        let lat2 = b.latitude * .pi / 180
        let dLon = (b.longitude - a.longitude) * .pi / 180
        let y = sin(dLon) * cos(lat2)
        let x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLon)
        let degrees = atan2(y, x) * 180 / .pi
        return (degrees + 360).truncatingRemainder(dividingBy: 360)
    }

    /// The closest point to `p` on the segment a→b, and how far along it (0…1).
    static func project(_ p: TripRoutePoint, ontoSegment a: TripRoutePoint, _ b: TripRoutePoint) -> (Double, TripRoutePoint) {
        let scale = cos(a.latitude * .pi / 180)
        let ax = a.longitude * scale, ay = a.latitude
        let bx = b.longitude * scale, by = b.latitude
        let px = p.longitude * scale, py = p.latitude
        let dx = bx - ax, dy = by - ay
        let lengthSquared = dx * dx + dy * dy
        guard lengthSquared > 0 else { return (0, a) }
        let t = min(1, max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
        let point = TripRoutePoint(
            latitude: a.latitude + t * (b.latitude - a.latitude),
            longitude: a.longitude + t * (b.longitude - a.longitude)
        )
        return (t, point)
    }

    /// "north", "north-east"… for a bearing in degrees.
    static func compassName(_ bearing: Double) -> String {
        let names = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"]
        let index = Int(((bearing.truncatingRemainder(dividingBy: 360) + 360 + 22.5) / 45).rounded(.down)) % 8
        return names[index]
    }
}
