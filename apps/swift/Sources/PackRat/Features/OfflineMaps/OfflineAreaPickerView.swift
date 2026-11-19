#if os(iOS)
import CoreLocation
import Defaults
import MapboxMaps
import SwiftUI

/// Frame an area on the map, choose the detail, see the size, and save it.
///
/// The visible map is the frame: what the user sees is what gets saved. A
/// named region instead saves what lies inside its outline, wherever the map
/// is panned.
struct OfflineAreaPickerView: View {
    /// Where the map opens. A trip or trail passes its destination.
    var initialCenter: CLLocationCoordinate2D?
    var suggestedName: String = ""
    var tripId: String?
    var tripEndDate: Date?
    var trailId: String?
    /// A trail's line, drawn on the map and framed to fit when the map opens.
    var lines: [[CLLocationCoordinate2D]] = []
    var region: OfflineNamedRegion?
    /// Called once a download starts. Defaults to dismissing this view.
    var onSaved: (() -> Void)?

    @Environment(\.dismiss) private var dismiss
    @State private var store = OfflineMapStore.shared
    @State private var viewport: Viewport
    @State private var bounds: OfflineAreaBounds?
    @State private var detail: OfflineDetailLevel = .standard
    @State private var name: String
    @State private var estimate: Int64?
    @State private var estimateFailed = false
    @State private var packFit: (fits: Bool, fitsAlone: Bool)?
    @State private var confirmingCellular = false

    init(
        initialCenter: CLLocationCoordinate2D? = nil,
        suggestedName: String = "",
        tripId: String? = nil,
        tripEndDate: Date? = nil,
        trailId: String? = nil,
        lines: [[CLLocationCoordinate2D]] = [],
        region: OfflineNamedRegion? = nil,
        onSaved: (() -> Void)? = nil
    ) {
        self.initialCenter = initialCenter
        self.suggestedName = suggestedName
        self.tripId = tripId
        self.tripEndDate = tripEndDate
        self.trailId = trailId
        self.lines = lines
        self.region = region
        self.onSaved = onSaved
        _name = State(initialValue: region?.name ?? suggestedName)
        if let region {
            _bounds = State(initialValue: OfflineAreaBounds(enclosing: region.rings))
            _viewport = State(initialValue: .framing(boundingCorners(region.rings.flatMap { $0 }), padding: 32, maxZoom: 14))
            return
        }
        let points = lines.flatMap { $0 }
        _viewport = State(initialValue: points.count > 1 || initialCenter != nil
            ? .framing(points, fallback: initialCenter, padding: 48, maxZoom: 14)
            : .followPuck(zoom: 11))
    }

    /// What gets saved: the region's outline, or the visible frame.
    private var rings: [[CLLocationCoordinate2D]] {
        region?.rings ?? bounds.map { [$0.ring] } ?? []
    }

    private var isTooLarge: Bool { packFit?.fitsAlone == false }
    /// Fits on its own, but not beside the maps already saved.
    private var isOutOfRoom: Bool { packFit?.fitsAlone == true && packFit?.fits == false }

    private var canSave: Bool {
        bounds != nil && estimate != nil && packFit?.fits == true
            && !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        VStack(spacing: 0) {
            MapReader { proxy in
                Map(viewport: $viewport) {
                    Puck2D()
                    PolylineAnnotationGroup(Array(lines.enumerated()), id: \.offset) { _, line in
                        routeLine(line)
                    }
                    .lineCap(.round)
                    if let region {
                        PolygonAnnotationGroup(Array(region.rings.enumerated()), id: \.offset) { _, ring in
                            PolygonAnnotation(polygon: Polygon([ring]))
                                .fillColor(UIColor.tintColor)
                                .fillOpacity(0.15)
                                .fillOutlineColor(UIColor.tintColor)
                        }
                    }
                }
                .mapStyle(.outdoors)
                .onMapIdle { _ in
                    guard region == nil, let map = proxy.map else { return }
                    let visible = map.coordinateBounds(for: CameraOptions(cameraState: map.cameraState))
                    bounds = OfflineAreaBounds(
                        south: visible.southwest.latitude,
                        west: visible.southwest.longitude,
                        north: visible.northeast.latitude,
                        east: visible.northeast.longitude
                    )
                }
            }
            .overlay {
                if region == nil {
                    RoundedRectangle(cornerRadius: 4)
                        .strokeBorder(Color.accentColor, lineWidth: 3)
                        .allowsHitTesting(false)
                }
            }
            .accessibilityIdentifier("offline_area_map")

            Form {
                Section {
                    Picker("Detail", selection: $detail) {
                        ForEach(OfflineDetailLevel.allCases) { level in
                            Text(level.label).tag(level)
                        }
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("offline_area_detail")
                } footer: {
                    Text(detail.summary)
                }

                Section {
                    TextField("Name", text: $name)
                        .accessibilityIdentifier("offline_area_name")
                    LabeledContent("Size") { sizeLabel }
                } footer: {
                    if isTooLarge {
                        Text(tooLargeMessage).foregroundStyle(.red)
                    } else if isOutOfRoom {
                        Text("Your saved maps are at their limit. Delete one you no longer need, or save a smaller area.")
                            .foregroundStyle(.red)
                    } else {
                        Text(region == nil ? "Everything inside the frame is saved." : "Everything inside the outline is saved.")
                    }
                }
            }
            .frame(maxHeight: 300)
        }
        .navigationTitle("Save Map Area")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            // Pushed from the region list, Back already leaves.
            if region == nil {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save", action: attemptSave)
                    .disabled(!canSave)
                    .accessibilityIdentifier("offline_area_save")
            }
        }
        .task(id: EstimateKey(bounds: bounds, detail: detail)) {
            await refreshEstimate()
        }
        .confirmationDialog(
            "Download over cellular?",
            isPresented: $confirmingCellular,
            titleVisibility: .visible
        ) {
            Button("Download") { startSave(allowCellular: true) }
            Button("Wait for Wi-Fi") { startSave(allowCellular: false) }
        } message: {
            Text("This map is \(estimate?.fileSizeText ?? "large") and you're not on Wi-Fi.")
        }
    }

    private var tooLargeMessage: String {
        switch (region == nil, detail) {
        case (true, .trail): return "This area is too large to save. Zoom in to frame a smaller area, or choose Standard detail."
        case (true, .standard): return "This area is too large to save. Zoom in to frame a smaller area."
        case (false, .trail): return "\(name) is too large to save at Trail detail. Choose Standard detail instead."
        case (false, .standard): return "\(name) is too large to save in one piece. Save the part you need by framing it on the map."
        }
    }

    @ViewBuilder
    private var sizeLabel: some View {
        if isTooLarge {
            Text("Too large").foregroundStyle(.red)
        } else if let estimate {
            Text("About \(estimate.fileSizeText)")
                .foregroundStyle(isOutOfRoom ? .red : .secondary)
        } else if estimateFailed {
            Text("Unavailable").foregroundStyle(.secondary)
        } else {
            ProgressView()
        }
    }

    private func refreshEstimate() async {
        guard bounds != nil else { return }
        let rings = rings
        estimate = nil
        estimateFailed = false
        packFit = nil
        // Let the camera settle before asking: each pan ends in an idle event.
        try? await Task.sleep(for: .milliseconds(300))
        guard !Task.isCancelled else { return }
        let fit = await store.packFit(rings: rings, detail: detail)
        guard !Task.isCancelled else { return }
        packFit = fit
        // Mapbox won't size an area past its cap; the warning says enough.
        guard fit.fitsAlone else { return }
        do {
            let bytes = try await store.estimateSize(rings: rings, detail: detail)
            guard !Task.isCancelled else { return }
            estimate = bytes
        } catch {
            guard !Task.isCancelled else { return }
            estimateFailed = true
        }
    }

    private func attemptSave() {
        guard estimate != nil else { return }
        let onCellular = NetworkMonitor.shared.connectionType == .cellular
        if onCellular && !Defaults[.offlineMapsAllowCellular] {
            confirmingCellular = true
        } else {
            startSave(allowCellular: Defaults[.offlineMapsAllowCellular])
        }
    }

    private func startSave(allowCellular: Bool) {
        guard let bounds else { return }
        store.save(
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            bounds: bounds,
            detail: detail,
            tripId: tripId,
            tripEndDate: tripEndDate,
            trailId: trailId,
            trailLines: lines,
            boundary: region?.rings ?? [],
            allowCellular: allowCellular
        )
        if let onSaved { onSaved() } else { dismiss() }
    }
}

private struct EstimateKey: Equatable {
    var bounds: OfflineAreaBounds?
    var detail: OfflineDetailLevel
}
#endif
