import MapKit
import SwiftUI

/// Draws a trip's route by tapping points on the map, joined by straight
/// lines, the "draw" mode of AllTrails' and Gaia GPS's route builders. Used
/// when there is no track file and no trail to start from.
struct RouteDrawingView: View {
    let initial: [CLLocationCoordinate2D]
    let center: CLLocationCoordinate2D?
    let unit: TripDistanceUnit
    let onDone: ([CLLocationCoordinate2D]) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var points: [CLLocationCoordinate2D] = []
    @State private var position: MapCameraPosition = .automatic

    private var distance: Double { RouteDrawing.distance(points) }

    var body: some View {
        NavigationStack {
            MapReader { proxy in
                Map(position: $position) {
                    if points.count >= 2 {
                        MapPolyline(coordinates: points)
                            .stroke(.orange, style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
                    }
                    ForEach(Array(points.enumerated()), id: \.offset) { index, point in
                        Annotation("Point \(index + 1)", coordinate: point) {
                            Circle()
                                .fill(index == 0 ? Color.green : index == points.count - 1 ? Color.red : Color.orange)
                                .stroke(.white, lineWidth: 2)
                                .frame(width: index == 0 || index == points.count - 1 ? 14 : 9)
                        }
                        .annotationTitles(.hidden)
                    }
                }
                .mapStyle(.standard(elevation: .realistic))
                .onTapGesture { location in
                    if let coordinate = proxy.convert(location, from: .local) {
                        points.append(coordinate)
                    }
                }
                .accessibilityIdentifier("route_drawing_map")
            }
            .ignoresSafeArea(edges: .bottom)
            .safeAreaInset(edge: .bottom) { panel }
            .navigationTitle("Draw Route")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        onDone(points)
                        dismiss()
                    }
                    .disabled(points.count < 2)
                    .accessibilityIdentifier("route_drawing_done")
                }
            }
            .onAppear {
                points = initial
                if let region = RouteDrawing.region(points: initial, center: center) {
                    position = .region(region)
                }
            }
        }
        .formSheetSize(minWidth: 640, minHeight: 640)
    }

    private var panel: some View {
        VStack(spacing: 10) {
            Text(points.count < 2 ? "Tap the map along the way you went." : unit.formatDistance(distance))
                .font(points.count < 2 ? .subheadline : .title3.bold().monospacedDigit())
                .foregroundStyle(points.count < 2 ? .secondary : .primary)
                .accessibilityIdentifier("route_drawing_distance")
            HStack(spacing: 12) {
                Button("Undo", systemImage: "arrow.uturn.backward") { points.removeLast() }
                    .disabled(points.isEmpty)
                Button("Out and Back", systemImage: "arrow.left.arrow.right") {
                    points = RouteDrawing.outAndBack(points)
                }
                .disabled(points.count < 2)
                Button("Clear", systemImage: "trash", role: .destructive) { points.removeAll() }
                    .disabled(points.isEmpty)
            }
            .buttonStyle(.bordered)
            .labelStyle(.titleAndIcon)
            .font(.subheadline)
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(.regularMaterial)
    }
}

/// The geometry behind `RouteDrawingView`, kept apart so it can be tested.
enum RouteDrawing {
    static func distance(_ coordinates: [CLLocationCoordinate2D]) -> Double {
        TrackMath.distance(coordinates.map { TrackPoint(latitude: $0.latitude, longitude: $0.longitude, elevation: nil) })
    }

    /// The line walked out and then back the same way.
    static func outAndBack(_ coordinates: [CLLocationCoordinate2D]) -> [CLLocationCoordinate2D] {
        guard coordinates.count >= 2 else { return coordinates }
        return coordinates + coordinates.dropLast().reversed()
    }

    /// Frames an existing line, or about 5 km around the trip's spot.
    static func region(points: [CLLocationCoordinate2D], center: CLLocationCoordinate2D?) -> MKCoordinateRegion? {
        if points.count >= 2 { return MapClusters.region(framing: points) }
        guard let center = points.first ?? center else { return nil }
        return MKCoordinateRegion(center: center, latitudinalMeters: 5_000, longitudinalMeters: 5_000)
    }
}
