#if os(iOS)
import CoreLocation
import MapboxMaps
import SwiftUI

/// The trip's map on Mapbox Outdoors, which draws from saved offline areas when
/// there is no connection.
struct TripMapboxMap: View {
    let destination: CLLocationCoordinate2D
    let destinationName: String
    var plannedRoute: [CLLocationCoordinate2D] = []
    var loggedRoute: [CLLocationCoordinate2D] = []

    @State private var viewport: Viewport

    init(
        destination: CLLocationCoordinate2D,
        destinationName: String,
        plannedRoute: [CLLocationCoordinate2D] = [],
        loggedRoute: [CLLocationCoordinate2D] = []
    ) {
        self.destination = destination
        self.destinationName = destinationName
        self.plannedRoute = plannedRoute
        self.loggedRoute = loggedRoute
        _viewport = State(initialValue: Self.initialViewport(
            destination: destination,
            routes: [plannedRoute, loggedRoute]
        ))
    }

    var body: some View {
        Map(viewport: $viewport) {
            // The route they meant to follow, dashed, under the one they logged.
            if plannedRoute.count >= 2 {
                PolylineAnnotationGroup {
                    PolylineAnnotation(lineCoordinates: plannedRoute)
                        .lineColor(.orange)
                        .lineWidth(3)
                }
                .lineDashArray([2, 1.3])
            }
            if loggedRoute.count >= 2 {
                PolylineAnnotationGroup {
                    PolylineAnnotation(lineCoordinates: loggedRoute)
                        .lineColor(.orange)
                        .lineWidth(4)
                        .lineJoin(.round)
                }
                .lineCap(.round)
            }
            MapViewAnnotation(coordinate: destination) {
                ZStack {
                    Circle().fill(.red).frame(width: 36, height: 36)
                    Image(systemName: "mappin.circle.fill")
                        .font(.title3)
                        .foregroundStyle(.white)
                }
                .shadow(radius: 4)
                .accessibilityLabel(destinationName)
            }
            .allowOverlap(true)
        }
        .mapStyle(.outdoors)
        .ornamentOptions(OrnamentOptions(scaleBar: ScaleBarViewOptions(visibility: .hidden)))
        .accessibilityIdentifier("trip_detail_map")
    }

    /// Frames the destination and any routes; just the destination when there are none.
    private static func initialViewport(
        destination: CLLocationCoordinate2D,
        routes: [[CLLocationCoordinate2D]]
    ) -> Viewport {
        let points = [destination] + routes.filter { $0.count >= 2 }.flatMap { $0 }
        guard points.count > 1 else { return .camera(center: destination, zoom: 11) }
        return .overview(
            geometry: MultiPoint(points),
            geometryPadding: EdgeInsets(top: 40, leading: 40, bottom: 48, trailing: 40),
            maxZoom: 14
        )
    }
}
#endif
