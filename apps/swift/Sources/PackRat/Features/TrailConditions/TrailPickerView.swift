import MapKit
import SwiftUI

/// Picks the trail a report is about. Trails near the hiker come first; typing
/// narrows by name. When the trail isn't in PackRat, the hiker drops a pin.
struct ReportTrailPickerView: View {
    /// The trail currently chosen, so the picker can mark it.
    let selectedTrailId: String?
    let location: TrailReportLocationProvider
    /// Where "near" means. Nil uses the device's location; a trip passes its
    /// destination, since the hiker is planning from somewhere else.
    var origin: CLLocationCoordinate2D? = nil
    /// Off for trips: a trip names a trail, it has no use for a pin.
    var allowsPin = true
    /// Called with the hiker's choice. The presenter closes the picker: a
    /// `dismiss()` from here, with the pin screen pushed on top, dismissed the
    /// whole report sheet instead of popping back to the form.
    let onPick: (ReportPlace) -> Void

    @State private var query = ""
    @State private var trails: [TrailSummary] = []
    @State private var isLoading = false
    @State private var loadFailed = false
    @State private var showingPinDrop = false

    private let service = TrailConditionsService.shared

    private var trimmedQuery: String { query.trimmingCharacters(in: .whitespaces) }
    private var nearCoordinate: CLLocationCoordinate2D? { origin ?? location.coordinate }
    private var near: (latitude: Double, longitude: Double)? {
        nearCoordinate.map { ($0.latitude, $0.longitude) }
    }

    /// Re-runs the search whenever the query or the fix changes.
    private var searchKey: String {
        let fix = nearCoordinate.map { "\(($0.latitude * 1000).rounded()),\(($0.longitude * 1000).rounded())" }
        return "\(trimmedQuery)|\(fix ?? "-")"
    }

    var body: some View {
        List {
            if allowsPin {
                pinSection
            }
            results
        }
        .navigationTitle("Choose Trail")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .searchable(text: $query, prompt: "Search trails")
        .task { location.start() }
        .task(id: searchKey) { await search() }
        .navigationDestination(isPresented: $showingPinDrop) {
            TrailPinDropView(start: location.coordinate) { pin in
                onPick(pin)
            }
        }
    }

    private var pinSection: some View {
        Section {
            Button {
                showingPinDrop = true
            } label: {
                Label("Drop a Pin Instead", systemImage: "mappin.and.ellipse")
            }
            .accessibilityIdentifier("trail_picker_drop_pin")
        } footer: {
            Text("For a stretch with no name, or a trail PackRat doesn't have yet.")
        }
    }

    @ViewBuilder
    private var results: some View {
        if loadFailed && trails.isEmpty {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Couldn't load trails")
                        .font(.headline)
                    Text(allowsPin ? "Check your connection and try again, or drop a pin." : "Check your connection and try again.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                    Button("Try Again") { Task { await search() } }
                        .buttonStyle(.bordered)
                }
                .padding(.vertical, 4)
            }
        } else if trimmedQuery.isEmpty && near == nil {
            Section {
                if location.isDenied {
                    hint(
                        "Search by Name",
                        systemImage: "magnifyingglass",
                        detail: "Type the trail's name. Allow location to see the trails around you first."
                    )
                } else {
                    HStack(spacing: 10) {
                        ProgressView()
                        Text("Finding trails near you…").foregroundStyle(.secondary)
                    }
                }
            }
        } else if trails.isEmpty && !isLoading {
            Section {
                if trimmedQuery.isEmpty {
                    hint(
                        "No Trails Nearby",
                        systemImage: "map",
                        detail: allowsPin ? "Search by name, or drop a pin where you are." : "Search by name."
                    )
                } else {
                    hint(
                        "No Trails Named “\(trimmedQuery)”",
                        systemImage: "magnifyingglass",
                        detail: allowsPin ? "Try part of the name, or drop a pin if it isn't mapped." : "Try part of the name."
                    )
                }
            }
        } else {
            Section {
                ForEach(trails) { trail in
                    Button {
                        onPick(.trail(trail))
                    } label: {
                        TrailPickerRow(trail: trail, isSelected: selectedTrailId == trail.id)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("trail_picker_row_\(trail.id)")
                }
            } header: {
                HStack {
                    Text(trimmedQuery.isEmpty ? (origin == nil ? "Near You" : "Near Destination") : "Trails")
                    if isLoading {
                        Spacer()
                        ProgressView().controlSize(.small)
                    }
                }
            }
        }
    }

    private func hint(_ title: String, systemImage: String, detail: String) -> some View {
        Label {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline)
                Text(detail).font(.callout).foregroundStyle(.secondary)
            }
        } icon: {
            Image(systemName: systemImage).foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }

    private func search() async {
        let query = trimmedQuery
        let near = near
        guard !query.isEmpty || near != nil else {
            trails = []
            return
        }
        // Debounce typing; a cancelled task means a newer query took over.
        if !query.isEmpty {
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }
        }
        isLoading = true
        defer { isLoading = false }
        do {
            let found = try await service.searchTrails(query: query, near: near)
            guard !Task.isCancelled else { return }
            trails = found
            loadFailed = false
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled else { return }
            loadFailed = true
        }
    }
}

struct TrailPickerRow: View {
    let trail: TrailSummary
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "figure.hiking")
                .font(.body)
                .foregroundStyle(.tint)
                .frame(width: 32, height: 32)
                .background(.tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(trail.name)
                    .font(.body)
                    .foregroundStyle(.primary)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            if isSelected {
                Image(systemName: "checkmark")
                    .foregroundStyle(.tint)
                    .accessibilityLabel("Selected")
            }
        }
        .contentShape(Rectangle())
    }

    private var subtitle: String {
        if let away = trail.distanceText {
            return "\(trail.lengthText) · \(away) away"
        }
        return trail.lengthText
    }
}

// MARK: - Pin drop

/// Places a report on the map when there's no trail to pick. The pin starts
/// where the hiker is; tapping the map moves it.
struct TrailPinDropView: View {
    let onConfirm: (ReportPlace) -> Void

    @State private var position: MapCameraPosition
    @State private var pin: CLLocationCoordinate2D?
    @State private var label = ""
    @FocusState private var isLabelFocused: Bool

    init(start: CLLocationCoordinate2D?, onConfirm: @escaping (ReportPlace) -> Void) {
        self.onConfirm = onConfirm
        _pin = State(initialValue: start)
        _position = State(initialValue: start.map {
            .region(MKCoordinateRegion(center: $0, latitudinalMeters: 1500, longitudinalMeters: 1500))
        } ?? .automatic)
    }

    var body: some View {
        VStack(spacing: 0) {
            MapReader { proxy in
                Map(position: $position) {
                    if let pin {
                        Marker("Report", systemImage: "mappin", coordinate: pin)
                    }
                    UserAnnotation()
                }
                .mapStyle(.standard(elevation: .realistic, pointsOfInterest: .excludingAll))
                .mapControls {
                    MapUserLocationButton()
                    MapCompass()
                    MapScaleView()
                }
                .onTapGesture { point in
                    if let coordinate = proxy.convert(point, from: .local) {
                        pin = coordinate
                        isLabelFocused = false
                    }
                }
                .accessibilityIdentifier("trail_pin_map")
            }
            .overlay(alignment: .top) {
                Text(pin == nil ? "Tap the map to drop a pin" : "Tap elsewhere to move the pin")
                    .font(.footnote.weight(.medium))
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(.regularMaterial, in: Capsule())
                    .padding(.top, 10)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Label")
                    .font(.caption.uppercaseSmallCaps())
                    .foregroundStyle(.secondary)
                TextField("e.g. Spur to Lost Lake", text: $label)
                    .textFieldStyle(.roundedBorder)
                    .focused($isLabelFocused)
                    .submitLabel(.done)
                    .accessibilityIdentifier("trail_pin_label")
                Text("Shown in place of a trail name. Optional.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding()
            .background(.bar)
        }
        .navigationTitle("Drop a Pin")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Use Pin") {
                    guard let pin else { return }
                    let trimmed = label.trimmingCharacters(in: .whitespaces)
                    onConfirm(.pin(
                        label: trimmed.isEmpty ? "Dropped pin" : trimmed,
                        latitude: pin.latitude,
                        longitude: pin.longitude
                    ))
                }
                .disabled(pin == nil)
                .accessibilityIdentifier("trail_pin_confirm")
            }
        }
    }
}
