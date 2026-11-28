#if os(iOS)
import CoreLocation
import MapKit
import MapboxMaps
import SwiftUI

/// Lines on Mapbox Outdoors: a muted backdrop with highlighted stretches
/// drawn over it, framed to fit. Pan and zoom stay on.
struct MapboxLinesMap: View {
    var muted: [[CLLocationCoordinate2D]] = []
    let highlighted: [[CLLocationCoordinate2D]]
    var highlightWidth: Double = 4

    var body: some View {
        let frame = muted.isEmpty ? highlighted : muted
        Map(initialViewport: .framing(boundingCorners(frame.flatMap { $0 }), padding: 24, maxZoom: 14)) {
            PolylineAnnotationGroup(Array(muted.enumerated()), id: \.offset) { _, line in
                PolylineAnnotation(lineCoordinates: line)
                    .lineColor(UIColor.secondaryLabel)
                    .lineOpacity(0.7)
                    .lineWidth(3)
                    .lineJoin(.round)
            }
            .lineCap(.round)
            PolylineAnnotationGroup(Array(highlighted.enumerated()), id: \.offset) { _, line in
                routeLine(line, width: highlightWidth)
            }
            .lineCap(.round)
        }
        .mapStyle(.outdoors)
    }
}

/// Filled outlines with labelled pins on Mapbox Outdoors, framed to the
/// outlines. Pan and zoom stay on.
struct MapboxOutlineMap: View {
    struct Pin: Identifiable {
        let id: String
        let title: String
        let systemImage: String
        let coordinate: CLLocationCoordinate2D
    }

    let rings: [[CLLocationCoordinate2D]]
    var pins: [Pin] = []
    let tint: UIColor

    var body: some View {
        Map(initialViewport: .framing(boundingCorners(rings.flatMap { $0 }), padding: 16, maxZoom: 12)) {
            PolygonAnnotationGroup(Array(rings.enumerated()), id: \.offset) { _, ring in
                PolygonAnnotation(polygon: Polygon([ring]))
                    .fillColor(tint)
                    .fillOpacity(0.18)
                    .fillOutlineColor(tint)
            }
            ForEvery(pins) { pin in
                MapViewAnnotation(coordinate: pin.coordinate) {
                    Image(systemName: pin.systemImage)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(width: 28, height: 28)
                        .background(Color(tint), in: Circle())
                        .overlay(Circle().stroke(.white, lineWidth: 2))
                        .shadow(radius: 2)
                        .accessibilityLabel(pin.title)
                }
                .allowOverlap(true)
            }
        }
        .mapStyle(.outdoors)
    }
}

/// The peak picker's map on Mapbox Outdoors: the route, every peak as a dot,
/// and the selected peak labelled. Reports where the camera comes to rest so
/// the picker can offer to search there.
struct MapboxPeakMap: View {
    struct Peak: Identifiable {
        let id: Int
        let name: String
        let coordinate: CLLocationCoordinate2D
        let isOnRoute: Bool
    }

    let route: [CLLocationCoordinate2D]
    let peaks: [Peak]
    @Binding var selection: Int?
    /// Height of the panel over the map's bottom: the map still draws under
    /// it, but frames the route and keeps its logo above it.
    var bottomInset: CGFloat = 0
    let onSettle: (MKCoordinateRegion) -> Void

    @State private var viewport: Viewport

    init(
        region: MKCoordinateRegion,
        route: [CLLocationCoordinate2D],
        peaks: [Peak],
        selection: Binding<Int?>,
        bottomInset: CGFloat = 0,
        onSettle: @escaping (MKCoordinateRegion) -> Void
    ) {
        self.route = route
        self.peaks = peaks
        _selection = selection
        self.bottomInset = bottomInset
        self.onSettle = onSettle
        let corners = route.count >= 2 ? route : region.corners
        _viewport = State(initialValue: .framing(boundingCorners(corners), padding: 40, maxZoom: 14))
    }

    var body: some View {
        MapReader { proxy in
            Map(viewport: $viewport) {
                if route.count >= 2 {
                    PolylineAnnotation(lineCoordinates: route)
                        .lineColor(.orange)
                        .lineWidth(3)
                        .lineJoin(.round)
                }
                ForEvery(peaks) { peak in
                    MapViewAnnotation(coordinate: peak.coordinate) {
                        if selection == peak.id {
                            Label(peak.name, systemImage: "mountain.2.fill")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(.orange, in: Capsule())
                                .shadow(radius: 2)
                        } else {
                            // Unlabelled dots: names on every pin are unreadable at
                            // this density, so only the selected peak is labelled.
                            Circle()
                                .fill(peak.isOnRoute ? Color.orange : Color.brown.opacity(0.85))
                                .stroke(.white, lineWidth: 1.5)
                                .frame(width: peak.isOnRoute ? 12 : 9, height: peak.isOnRoute ? 12 : 9)
                                .padding(8)
                                .contentShape(Rectangle())
                                .onTapGesture { selection = peak.id }
                                .accessibilityLabel(peak.name)
                        }
                    }
                    .allowOverlap(true)
                    .priority(selection == peak.id ? 1 : 0)
                }
            }
            .mapStyle(.outdoors)
            .additionalSafeAreaInsets(.bottom, bottomInset)
            .onMapTapGesture { _ in selection = nil }
            .onMapIdle { _ in
                guard let map = proxy.map else { return }
                // Unwrapped so a view across the antimeridian keeps east past
                // west; the centre is then wrapped back into ±180.
                let visible = map.coordinateBoundsUnwrapped(for: CameraOptions(cameraState: map.cameraState))
                let sw = visible.southwest, ne = visible.northeast
                let longitude = (sw.longitude + ne.longitude) / 2
                onSettle(MKCoordinateRegion(
                    center: CLLocationCoordinate2D(
                        latitude: (sw.latitude + ne.latitude) / 2,
                        longitude: longitude - 360 * ((longitude + 180) / 360).rounded(.down)
                    ),
                    span: MKCoordinateSpan(
                        latitudeDelta: ne.latitude - sw.latitude,
                        longitudeDelta: ne.longitude - sw.longitude
                    )
                ))
            }
        }
    }
}

/// The south-west and north-east corners of a set of points: enough to frame
/// them, without handing the map thousands of points to fit. A shape that
/// crosses the antimeridian (Alaska, Fiji) is shifted east so it frames as
/// one piece rather than the whole world.
func boundingCorners(_ points: [CLLocationCoordinate2D]) -> [CLLocationCoordinate2D] {
    guard let first = points.first else { return [] }
    var minLat = first.latitude, maxLat = first.latitude
    var minLon = first.longitude, maxLon = first.longitude
    for point in points {
        minLat = min(minLat, point.latitude); maxLat = max(maxLat, point.latitude)
        minLon = min(minLon, point.longitude); maxLon = max(maxLon, point.longitude)
    }
    if maxLon - minLon > 180 {
        let shifted = points.map { $0.longitude < 0 ? $0.longitude + 360 : $0.longitude }
        minLon = shifted.min() ?? minLon
        maxLon = shifted.max() ?? maxLon
    }
    return [
        CLLocationCoordinate2D(latitude: minLat, longitude: minLon),
        CLLocationCoordinate2D(latitude: maxLat, longitude: maxLon),
    ]
}

private extension MKCoordinateRegion {
    var corners: [CLLocationCoordinate2D] {
        [
            CLLocationCoordinate2D(latitude: center.latitude - span.latitudeDelta / 2,
                                   longitude: center.longitude - span.longitudeDelta / 2),
            CLLocationCoordinate2D(latitude: center.latitude + span.latitudeDelta / 2,
                                   longitude: center.longitude + span.longitudeDelta / 2),
        ]
    }
}
#endif
