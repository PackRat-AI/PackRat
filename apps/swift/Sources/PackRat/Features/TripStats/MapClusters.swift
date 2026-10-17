import CoreLocation
import MapKit

/// Groups map pins that would overlap at the current zoom, the way MapKit's
/// `clusteringIdentifier` does for `MKMapView` (SwiftUI's `Map` has no
/// clustering of its own). Pins snap to a grid sized from the visible span;
/// a cell holding one pin stays a pin, a cell holding more becomes a count.
struct MapCluster<ID: Hashable>: Identifiable {
    let id: String
    let coordinate: CLLocationCoordinate2D
    let members: [ID]

    var isSingle: Bool { members.count == 1 }
}

enum MapClusters {
    /// Cells across the visible width. About eight keeps 40-pt markers on a
    /// phone-width map from touching.
    static let cellsAcross = 8.0

    static func cluster<ID: Hashable>(
        _ points: [(id: ID, coordinate: CLLocationCoordinate2D)],
        span: MKCoordinateSpan?
    ) -> [MapCluster<ID>] {
        guard let span, span.longitudeDelta > 0, span.latitudeDelta > 0 else {
            return points.map { MapCluster(id: "\($0.id)", coordinate: $0.coordinate, members: [$0.id]) }
        }
        let width = span.longitudeDelta / cellsAcross
        let height = span.latitudeDelta / cellsAcross
        var cells: [String: [(id: ID, coordinate: CLLocationCoordinate2D)]] = [:]
        var order: [String] = []
        for point in points {
            let key = "\(Int(floor(point.coordinate.longitude / width))):\(Int(floor(point.coordinate.latitude / height)))"
            if cells[key] == nil { order.append(key) }
            cells[key, default: []].append(point)
        }
        return order.compactMap { key in
            guard let members = cells[key], let first = members.first else { return nil }
            if members.count == 1 {
                return MapCluster(id: "\(first.id)", coordinate: first.coordinate, members: [first.id])
            }
            let latitude = members.map(\.coordinate.latitude).reduce(0, +) / Double(members.count)
            let longitude = members.map(\.coordinate.longitude).reduce(0, +) / Double(members.count)
            return MapCluster(
                id: "cluster:\(key)",
                coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
                members: members.map(\.id)
            )
        }
    }

    /// The region that frames a set of pins, padded so none sit on the edge.
    /// `headroom` adds room above, since a marker's head stands above its point.
    static func region(framing coordinates: [CLLocationCoordinate2D], headroom: Bool = false) -> MKCoordinateRegion? {
        guard let first = coordinates.first else { return nil }
        var minLat = first.latitude, maxLat = first.latitude
        var minLon = first.longitude, maxLon = first.longitude
        for coordinate in coordinates {
            minLat = min(minLat, coordinate.latitude); maxLat = max(maxLat, coordinate.latitude)
            minLon = min(minLon, coordinate.longitude); maxLon = max(maxLon, coordinate.longitude)
        }
        let latitudeDelta = max((maxLat - minLat) * (headroom ? 1.9 : 1.6), 0.02)
        let shift = headroom ? latitudeDelta * 0.12 : 0
        return MKCoordinateRegion(
            center: CLLocationCoordinate2D(
                latitude: min(max((minLat + maxLat) / 2 + shift, -85), 85),
                longitude: (minLon + maxLon) / 2
            ),
            span: MKCoordinateSpan(
                latitudeDelta: min(latitudeDelta, 170),
                longitudeDelta: min(max((maxLon - minLon) * 1.6, 0.02), 360)
            )
        )
    }
}
