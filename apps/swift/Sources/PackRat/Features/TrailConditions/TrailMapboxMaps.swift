#if os(iOS)
import CoreLocation
import MapboxMaps
import SwiftUI

/// A trail's line on Mapbox Outdoors, framed to fit. Not interactive.
struct MapboxTrailLineMap: View {
    let lines: [[CLLocationCoordinate2D]]

    var body: some View {
        Map(initialViewport: .framing(lines.flatMap { $0 }, padding: 24, maxZoom: 14)) {
            PolylineAnnotationGroup(Array(lines.enumerated()), id: \.offset) { _, line in
                routeLine(line)
            }
            .lineCap(.round)
        }
        .mapStyle(.outdoors)
        .allowsHitTesting(false)
    }
}

/// A single dropped pin on Mapbox Outdoors. Not interactive.
struct MapboxPinMap: View {
    let coordinate: CLLocationCoordinate2D

    var body: some View {
        Map(initialViewport: .camera(center: coordinate, zoom: 14)) {
            MapViewAnnotation(coordinate: coordinate) { MapPin() }
                .variableAnchors([ViewAnnotationAnchorConfig(anchor: .bottom)])
                .allowOverlap(true)
        }
        .mapStyle(.outdoors)
        .allowsHitTesting(false)
    }
}

/// The map half of `TrailPinDropView` on Mapbox Outdoors: tapping moves the pin.
struct MapboxPinDropMap: View {
    @Binding var pin: CLLocationCoordinate2D?
    var onTap: () -> Void = {}
    @State private var viewport: Viewport

    init(pin: Binding<CLLocationCoordinate2D?>, start: CLLocationCoordinate2D?, onTap: @escaping () -> Void = {}) {
        _pin = pin
        self.onTap = onTap
        _viewport = State(initialValue: start.map { .camera(center: $0, zoom: 14) } ?? .followPuck(zoom: 14))
    }

    var body: some View {
        Map(viewport: $viewport) {
            Puck2D()
            if let pin {
                MapViewAnnotation(coordinate: pin) { MapPin() }
                    .variableAnchors([ViewAnnotationAnchorConfig(anchor: .bottom)])
                    .allowOverlap(true)
            }
        }
        .mapStyle(.outdoors)
        .onMapTapGesture { context in
            pin = context.coordinate
            onTap()
        }
        .overlay(alignment: .bottomTrailing) {
            Button {
                withViewportAnimation(.default(maxDuration: 1)) { viewport = .followPuck(zoom: 14) }
            } label: {
                Image(systemName: "location.fill")
                    .font(.body.weight(.semibold))
                    .frame(width: 44, height: 44)
                    .background(.regularMaterial, in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Show my location")
            .padding(12)
        }
    }
}
#endif
