#if os(iOS)
import CoreLocation
import MapboxMaps
import SwiftUI

extension Viewport {
    /// Frames a set of points, or `fallback` at `zoom` when there is at most one.
    static func framing(
        _ points: [CLLocationCoordinate2D],
        fallback: CLLocationCoordinate2D? = nil,
        zoom: Double = 11,
        padding: CGFloat = 32,
        maxZoom: Double = 15
    ) -> Viewport {
        guard points.count > 1 else {
            guard let center = points.first ?? fallback else { return .idle }
            return .camera(center: center, zoom: zoom)
        }
        return .overview(
            geometry: MultiPoint(points),
            geometryPadding: EdgeInsets(top: padding, leading: padding, bottom: padding, trailing: padding),
            maxZoom: maxZoom
        )
    }
}

/// A route drawn as a solid orange line, the style every in-app map uses.
func routeLine(_ coordinates: [CLLocationCoordinate2D], width: Double = 4) -> PolylineAnnotation {
    PolylineAnnotation(lineCoordinates: coordinates)
        .lineColor(.orange)
        .lineWidth(width)
        .lineJoin(.round)
}

/// The dot marking a route's start, finish or a drawn point.
struct MapDot: View {
    var color: Color
    var size: CGFloat = 12

    var body: some View {
        Circle().fill(color).stroke(.white, lineWidth: 2).frame(width: size, height: size)
    }
}

/// A dropped pin, standing on its point.
struct MapPin: View {
    var body: some View {
        Image(systemName: "mappin.circle.fill")
            .font(.title)
            .symbolRenderingMode(.palette)
            .foregroundStyle(.white, .red)
            .shadow(radius: 3)
    }
}
#endif
