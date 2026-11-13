#if os(iOS)
import CoreLocation
import Defaults
import MapboxMaps
import SwiftUI

/// Frame an area on the map, choose the detail, see the size, and save it.
///
/// The visible map is the frame: what the user sees is what gets saved.
struct OfflineAreaPickerView: View {
    /// Where the map opens. A trip or trail passes its destination.
    var initialCenter: CLLocationCoordinate2D?
    var suggestedName: String = ""
    var tripId: String?
    var tripEndDate: Date?

    @Environment(\.dismiss) private var dismiss
    @State private var store = OfflineMapStore.shared
    @State private var viewport: Viewport
    @State private var bounds: OfflineAreaBounds?
    @State private var detail: OfflineDetailLevel = .standard
    @State private var name: String
    @State private var estimate: Int64?
    @State private var estimateFailed = false
    @State private var confirmingCellular = false
    @State private var areasToFree: [OfflineArea] = []
    @State private var confirmingFreeSpace = false
    @State private var overLimit = false

    init(
        initialCenter: CLLocationCoordinate2D? = nil,
        suggestedName: String = "",
        tripId: String? = nil,
        tripEndDate: Date? = nil
    ) {
        self.initialCenter = initialCenter
        self.suggestedName = suggestedName
        self.tripId = tripId
        self.tripEndDate = tripEndDate
        _name = State(initialValue: suggestedName)
        _viewport = State(initialValue: initialCenter.map { .camera(center: $0, zoom: 11) }
            ?? .followPuck(zoom: 11))
    }

    private var isTooLarge: Bool { (estimate ?? 0) > OfflineMapStore.maxAreaBytes }

    private var canSave: Bool {
        bounds != nil && estimate != nil && !isTooLarge
            && !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        VStack(spacing: 0) {
            MapReader { proxy in
                Map(viewport: $viewport) {
                    Puck2D()
                }
                .mapStyle(.outdoors)
                .onMapIdle { _ in
                    guard let map = proxy.map else { return }
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
                RoundedRectangle(cornerRadius: 4)
                    .strokeBorder(Color.accentColor, lineWidth: 3)
                    .allowsHitTesting(false)
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
                        Text("This area is too large to save. Zoom in to frame a smaller area, or choose Standard detail.")
                            .foregroundStyle(.red)
                    } else {
                        Text("Everything inside the frame is saved.")
                    }
                }
            }
            .frame(maxHeight: 300)
        }
        .navigationTitle("Save Map Area")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
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
        .alert("Free up space first", isPresented: $confirmingFreeSpace) {
            Button("Delete and Save", role: .destructive) {
                for area in areasToFree { store.delete(area) }
                attemptSave()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This map needs more room than your offline maps limit allows. Deleting \(ListFormatter.localizedString(byJoining: areasToFree.map(\.name))) makes room for it.")
        }
        .alert("Over your storage limit", isPresented: $overLimit) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("This map is larger than your offline maps limit. Raise the limit in Offline Maps, or save a smaller area.")
        }
    }

    @ViewBuilder
    private var sizeLabel: some View {
        if let estimate {
            Text("About \(estimate.fileSizeText)")
                .foregroundStyle(isTooLarge ? .red : .secondary)
        } else if estimateFailed {
            Text("Unavailable").foregroundStyle(.secondary)
        } else {
            ProgressView()
        }
    }

    private func refreshEstimate() async {
        guard let bounds else { return }
        estimate = nil
        estimateFailed = false
        // Let the camera settle before asking: each pan ends in an idle event.
        try? await Task.sleep(for: .milliseconds(300))
        guard !Task.isCancelled else { return }
        do {
            let bytes = try await store.estimateSize(bounds: bounds, detail: detail)
            guard !Task.isCancelled else { return }
            estimate = bytes
        } catch {
            guard !Task.isCancelled else { return }
            estimateFailed = true
        }
    }

    private func attemptSave() {
        guard let estimate else { return }
        guard let toFree = store.areasToFree(forAdditional: estimate) else {
            overLimit = true
            return
        }
        guard toFree.isEmpty else {
            areasToFree = toFree
            confirmingFreeSpace = true
            return
        }
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
            allowCellular: allowCellular
        )
        dismiss()
    }
}

private struct EstimateKey: Equatable {
    var bounds: OfflineAreaBounds?
    var detail: OfflineDetailLevel
}
#endif
