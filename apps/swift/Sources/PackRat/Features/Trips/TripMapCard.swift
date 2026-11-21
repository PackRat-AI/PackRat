import MapKit
import SwiftUI

/// Where the trip map's camera should go. A fresh value (new `id`) re-applies
/// the same focus, so tapping Recentre twice works.
struct TripMapFocus: Equatable {
    enum Target: Equatable { case trip, user }
    var target: Target = .trip
    var id = UUID()
}

/// Everything a trip map draws, shared by the preview card and the
/// full-screen map so both show the same place and routes.
struct TripMapModel {
    let trip: Trip
    let coordinate: CLLocationCoordinate2D
    let loggedRoute: [CLLocationCoordinate2D]
    let plannedRoute: [CLLocationCoordinate2D]

    var placeName: String {
        guard let name = trip.location?.name, !name.isEmpty else { return trip.name }
        return name
    }

    /// "Yosemite Valley" from "Yosemite Valley, California, United States".
    var title: String {
        placeName.split(separator: ",").first.map { $0.trimmingCharacters(in: .whitespaces) } ?? placeName
    }

    /// "California, United States", or nil when the name has no region part.
    var region: String? {
        let parts = placeName.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        guard parts.count > 1 else { return nil }
        return parts.dropFirst().joined(separator: ", ")
    }

    var hasRoute: Bool { loggedRoute.count >= 2 || plannedRoute.count >= 2 }

    func openInMaps() {
        let item = MKMapItem(placemark: MKPlacemark(coordinate: coordinate))
        item.name = placeName
        item.openInMaps(launchOptions: [MKLaunchOptionsMapTypeKey: MKMapType.standard.rawValue])
    }
}

// MARK: - Map surface

/// The trip map itself: Mapbox Outdoors when offline maps are on (so saved
/// areas work without a connection), MapKit otherwise.
struct TripMapSurface: View {
    let model: TripMapModel
    var satellite = false
    var showsUserLocation = false
    var focus = TripMapFocus()

    var body: some View {
        #if os(iOS)
        if OfflineMapStore.isEnabled {
            TripMapboxMap(
                destination: model.coordinate,
                destinationName: model.placeName,
                plannedRoute: model.plannedRoute,
                loggedRoute: model.loggedRoute,
                satellite: satellite,
                showsUserLocation: showsUserLocation,
                focus: focus
            )
        } else {
            TripMapKitMap(model: model, satellite: satellite, showsUserLocation: showsUserLocation, focus: focus)
        }
        #else
        TripMapKitMap(model: model, satellite: satellite, showsUserLocation: showsUserLocation, focus: focus)
        #endif
    }
}

private struct TripMapKitMap: View {
    let model: TripMapModel
    let satellite: Bool
    let showsUserLocation: Bool
    let focus: TripMapFocus

    @State private var position: MapCameraPosition = .automatic

    private var trip: Trip { model.trip }

    private var tripPosition: MapCameraPosition {
        if model.hasRoute { return .automatic }
        return .region(MKCoordinateRegion(
            center: model.coordinate,
            span: MKCoordinateSpan(latitudeDelta: 0.2, longitudeDelta: 0.2)
        ))
    }

    var body: some View {
        Map(position: $position) {
            // The route they meant to follow, dashed, under the one they logged.
            if model.plannedRoute.count >= 2 {
                MapPolyline(coordinates: model.plannedRoute)
                    .stroke(.orange, style: StrokeStyle(lineWidth: 3, dash: [6, 4]))
            }
            if model.loggedRoute.count >= 2 {
                MapPolyline(coordinates: model.loggedRoute)
                    .stroke(.orange, style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
            }
            #if os(iOS)
            // The path so far while this trip is being recorded.
            if let live = TrackRecorder.shared.track, live.tripId == trip.id, live.samples.count >= 2 {
                MapPolyline(coordinates: live.samples.map(\.trackPoint.coordinate))
                    .stroke(.red, style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
            }
            if let destination = TripGuide.shared.session.flatMap({ $0.tripId == trip.id ? $0.guide.plan.destination : nil }) {
                Marker(
                    destination.name.prefix(1).uppercased() + destination.name.dropFirst(),
                    systemImage: "flag.checkered",
                    coordinate: CLLocationCoordinate2D(latitude: destination.point.latitude, longitude: destination.point.longitude)
                )
                .tint(.blue)
            }
            #endif
            if showsUserLocation || isTracking {
                UserAnnotation()
            }
            ForEach(trip.log?.waypoints ?? []) { waypoint in
                Marker(
                    waypoint.name,
                    systemImage: waypoint.note == nil ? "mappin" : "note.text",
                    coordinate: CLLocationCoordinate2D(latitude: waypoint.latitude, longitude: waypoint.longitude)
                )
                .tint(.orange)
            }
            Annotation(model.title, coordinate: model.coordinate) {
                ZStack {
                    Circle().fill(.red).frame(width: 36, height: 36)
                    Image(systemName: "mappin.circle.fill")
                        .font(.title3)
                        .foregroundStyle(.white)
                }
                .shadow(radius: 4)
            }
        }
        .mapStyle(satellite ? .hybrid(elevation: .realistic) : .standard(elevation: .realistic))
        .mapControls {
            MapCompass()
            MapScaleView()
        }
        .onAppear { position = tripPosition }
        .onChange(of: focus) { _, focus in
            withAnimation {
                switch focus.target {
                case .trip: position = tripPosition
                case .user: position = .userLocation(fallback: tripPosition)
                }
            }
        }
        .accessibilityIdentifier("trip_detail_map")
    }

    private var isTracking: Bool {
        #if os(iOS)
        TrackRecorder.shared.isRecording(tripId: trip.id) || TripGuide.shared.isGuiding(tripId: trip.id)
        #else
        false
        #endif
    }
}

// MARK: - Preview card

/// The trip page's map: an interactive preview with Expand and Directions
/// laid over it, the place underneath, and an optional footer such as the
/// offline map row.
struct TripMapCard<Footer: View>: View {
    let model: TripMapModel
    let onExpand: () -> Void
    @ViewBuilder var footer: () -> Footer

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            TripMapSurface(model: model)
                .frame(height: 220)
                .overlay(alignment: .topTrailing) {
                    VStack(spacing: 0) {
                        overlayButton("Expand map", symbol: "arrow.up.left.and.arrow.down.right", action: onExpand)
                            .accessibilityIdentifier("trip_detail_map_expand")
                        Divider().frame(width: 24)
                        overlayButton("Directions", symbol: "arrow.triangle.turn.up.right.diamond.fill") {
                            model.openInMaps()
                        }
                        .accessibilityIdentifier("trip_detail_directions")
                    }
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .padding(10)
                }

            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(model.title)
                        .font(.callout.bold())
                        .lineLimit(1)
                    if let region = model.region {
                        Text(region)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                footer()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
        }
        .background(.fill.quaternary)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func overlayButton(_ label: String, symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
                .frame(width: 40, height: 40)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

extension TripMapCard where Footer == EmptyView {
    init(model: TripMapModel, onExpand: @escaping () -> Void) {
        self.init(model: model, onExpand: onExpand) { EmptyView() }
    }
}

// MARK: - Full screen

/// The trip map edge to edge, for exploring the area around the place.
struct TripFullScreenMap: View {
    let model: TripMapModel
    @Environment(\.dismiss) private var dismiss
    @State private var satellite = false
    @State private var showsUserLocation = false
    @State private var focus = TripMapFocus()

    var body: some View {
        TripMapSurface(model: model, satellite: satellite, showsUserLocation: showsUserLocation, focus: focus)
            .ignoresSafeArea()
            .overlay(alignment: .topLeading) {
                mapButton("Close", symbol: "xmark", circular: true) { dismiss() }
                    .accessibilityIdentifier("trip_map_close")
                    .padding()
            }
            .overlay(alignment: .topTrailing) {
                VStack(spacing: 0) {
                    mapButton(satellite ? "Show map" : "Show satellite", symbol: satellite ? "map" : "globe.americas.fill") {
                        satellite.toggle()
                    }
                    .accessibilityIdentifier("trip_map_style")
                    Divider().frame(width: 28)
                    mapButton("Show my location", symbol: showsUserLocation ? "location.fill" : "location") {
                        showsUserLocation = true
                        focus = TripMapFocus(target: .user)
                    }
                    .accessibilityIdentifier("trip_map_my_location")
                    Divider().frame(width: 28)
                    mapButton("Recentre", symbol: "scope") {
                        focus = TripMapFocus(target: .trip)
                    }
                    .accessibilityIdentifier("trip_map_recentre")
                }
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .padding()
            }
            .safeAreaInset(edge: .bottom) {
                placeBar
                    .padding(.horizontal)
                    .padding(.bottom, 8)
            }
            #if os(macOS)
            .frame(minWidth: 720, minHeight: 520)
            #endif
    }

    private var placeBar: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(model.title).font(.headline).lineLimit(1)
                if let region = model.region {
                    Text(region).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                }
            }
            Spacer(minLength: 8)
            Button {
                model.openInMaps()
            } label: {
                Label("Directions", systemImage: "arrow.triangle.turn.up.right.diamond.fill")
                    .font(.subheadline.weight(.semibold))
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
            .accessibilityIdentifier("trip_map_directions")
        }
        .padding(16)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: .black.opacity(0.12), radius: 12, y: 4)
    }

    private func mapButton(
        _ label: String, symbol: String, circular: Bool = false, action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.body.weight(.medium))
                .foregroundStyle(.primary)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .background {
            if circular {
                Circle().fill(.regularMaterial)
            }
        }
    }
}
