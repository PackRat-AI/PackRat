#if os(iOS)
import CoreLocation
import MapboxMaps
import SwiftUI

/// `RoutePreview` on Mapbox Outdoors, so a logged route shows offline.
struct MapboxRoutePreview: View {
    let coordinates: [CLLocationCoordinate2D]
    @State private var viewport: Viewport

    init(coordinates: [CLLocationCoordinate2D]) {
        self.coordinates = coordinates
        _viewport = State(initialValue: .framing(coordinates, padding: 24))
    }

    var body: some View {
        Map(viewport: $viewport) {
            if coordinates.count >= 2 {
                PolylineAnnotationGroup {
                    routeLine(coordinates)
                }
                .lineCap(.round)
            }
            if let start = coordinates.first {
                MapViewAnnotation(coordinate: start) { MapDot(color: .green) }
                    .allowOverlap(true)
            }
            if let end = coordinates.last {
                MapViewAnnotation(coordinate: end) { MapDot(color: .red) }
                    .allowOverlap(true)
            }
        }
        .mapStyle(.outdoors)
        .allowsHitTesting(false)
        .onChange(of: coordinates.frameKey) {
            viewport = .framing(coordinates, padding: 24)
        }
    }
}

/// The map half of `RouteDrawingView` on Mapbox Outdoors: tapping adds a point.
struct MapboxRouteDrawingMap: View {
    @Binding var points: [CLLocationCoordinate2D]
    @State private var viewport: Viewport

    init(points: Binding<[CLLocationCoordinate2D]>, initial: [CLLocationCoordinate2D], center: CLLocationCoordinate2D?) {
        _points = points
        _viewport = State(initialValue: .framing(initial, fallback: center, zoom: 13, padding: 48))
    }

    var body: some View {
        Map(viewport: $viewport) {
            if points.count >= 2 {
                PolylineAnnotationGroup {
                    routeLine(points)
                }
                .lineCap(.round)
            }
            ForEvery(Array(points.enumerated()), id: \.offset) { index, point in
                let isEnd = index == 0 || index == points.count - 1
                MapViewAnnotation(coordinate: point) {
                    MapDot(
                        color: index == 0 ? .green : index == points.count - 1 ? .red : .orange,
                        size: isEnd ? 14 : 9
                    )
                }
                .allowOverlap(true)
            }
        }
        .mapStyle(.outdoors)
        .onMapTapGesture { context in
            points.append(context.coordinate)
        }
    }
}
#endif
