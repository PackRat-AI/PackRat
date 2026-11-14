#if os(iOS)
import CoreLocation
import MapboxMaps
import SwiftUI

/// A saved area full screen, with the user's location and, for an area saved
/// from a trail, the trail's line. Draws from the saved tiles, so it works
/// without signal.
struct OfflineAreaMapView: View {
    let area: OfflineArea

    @State private var viewport: Viewport
    @State private var following = false

    init(area: OfflineArea) {
        self.area = area
        _viewport = State(initialValue: Self.wholeArea(area))
    }

    private static func wholeArea(_ area: OfflineArea) -> Viewport {
        .framing(area.bounds.ring, padding: 16, maxZoom: Double(area.detail.maxZoom))
    }

    private var trailLines: [[CLLocationCoordinate2D]] {
        (area.trailLines ?? []).map { line in line.map(\.coordinate) }
    }

    var body: some View {
        Map(viewport: $viewport) {
            Puck2D(bearing: .heading)
            PolylineAnnotation(lineCoordinates: area.bounds.ring)
                .lineColor(UIColor.tintColor)
                .lineWidth(2)
                .lineOpacity(0.6)
            PolylineAnnotationGroup(Array(trailLines.enumerated()), id: \.offset) { _, line in
                routeLine(line)
            }
            .lineCap(.round)
        }
        .mapStyle(.outdoors)
        .cameraBounds(CameraBoundsOptions(maxZoom: Double(area.detail.maxZoom) + 2))
        .ignoresSafeArea(edges: .bottom)
        .navigationTitle(area.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    following.toggle()
                    viewport = following ? .followPuck(zoom: 14) : Self.wholeArea(area)
                } label: {
                    Label(
                        following ? "Show Whole Area" : "Show My Location",
                        systemImage: following ? "map" : "location"
                    )
                }
                .accessibilityIdentifier("offline_area_map_locate")
            }
        }
        .accessibilityIdentifier("offline_area_full_map")
    }
}
#endif
