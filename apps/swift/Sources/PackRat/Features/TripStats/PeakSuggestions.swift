import CoreLocation
import Foundation

/// Ranks nearby peaks for the summit picker: the ones a trip's route passes
/// over first, then the rest by distance from the route (or from the map's
/// centre when there is no route). Pure, so it's tested without a map.
struct PeakSuggestions: Sendable {
    /// Close enough to call a summit "on the route": a GPS track and an OSM
    /// summit node rarely coincide, and a short spur to the top is common.
    static let onRouteMeters: Double = 250

    struct Item: Identifiable, Sendable {
        let peak: NearbyPeak
        /// From the nearest route point, or from the centre with no route.
        let distanceMeters: Double
        let isOnRoute: Bool

        var id: Int { peak.osmId }
    }

    /// Route peaks in the order the route reaches them.
    let onRoute: [Item]
    /// Everything else, nearest first.
    let nearby: [Item]

    var all: [Item] { onRoute + nearby }

    /// Routes hold up to ~1,500 points; this many keeps ranking 200 peaks instant.
    private static let routeSampleLimit = 400

    init(peaks: [NearbyPeak], route: [CLLocationCoordinate2D], center: CLLocationCoordinate2D) {
        let step = max(route.count / Self.routeSampleLimit, 1)
        let samples = stride(from: 0, to: route.count, by: step).map {
            CLLocation(latitude: route[$0].latitude, longitude: route[$0].longitude)
        }
        let origin = CLLocation(latitude: center.latitude, longitude: center.longitude)

        var onRoute: [(item: Item, index: Int)] = []
        var nearby: [Item] = []
        for peak in peaks {
            let location = CLLocation(latitude: peak.latitude, longitude: peak.longitude)
            guard samples.count >= 2 else {
                nearby.append(Item(peak: peak, distanceMeters: location.distance(from: origin), isOnRoute: false))
                continue
            }
            var best = (distance: Double.infinity, index: 0)
            for (index, sample) in samples.enumerated() {
                let d = sample.distance(from: location)
                if d < best.distance { best = (d, index) }
            }
            if best.distance <= Self.onRouteMeters {
                onRoute.append((Item(peak: peak, distanceMeters: best.distance, isOnRoute: true), best.index))
            } else {
                nearby.append(Item(peak: peak, distanceMeters: best.distance, isOnRoute: false))
            }
        }
        self.onRoute = onRoute.sorted { $0.index < $1.index }.map(\.item)
        self.nearby = nearby.sorted {
            ($0.distanceMeters, $1.peak.elevationMeters ?? 0) < ($1.distanceMeters, $0.peak.elevationMeters ?? 0)
        }
    }
}
