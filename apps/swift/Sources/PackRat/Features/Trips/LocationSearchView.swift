import SwiftUI
import MapKit

struct LocationSearchResult: Identifiable {
    let id = UUID()
    let name: String
    let subtitle: String
    let latitude: Double
    let longitude: Double

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    /// "Yosemite Valley, California, United States": the name the trip keeps,
    /// so the trip map can show the place and its region.
    var fullName: String {
        let region = subtitle
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty && $0 != name }
        return ([name] + region).joined(separator: ", ")
    }
}

/// Picks a trip's place: search at the top, a pin fixed at the centre of the
/// map, and the place under the pin confirmed from the panel at the bottom.
struct LocationSearchView: View {
    var initial: LocationSearchResult?
    let onSelect: (LocationSearchResult) -> Void

    private enum Pinned {
        case idle
        case loading(CLLocationCoordinate2D)
        case ready(CLLocationCoordinate2D, place: LocationSearchResult?)
    }

    private static let placeSpan = MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)

    @Environment(\.dismiss) private var dismiss
    @State private var position: MapCameraPosition
    @State private var pinned: Pinned
    @State private var isMoving = false
    @State private var query = ""
    @State private var isSearchPresented = false
    @State private var results: [LocationSearchResult] = []
    @State private var isSearching = false
    @State private var searchTask: Task<Void, Never>?
    @State private var lookupTask: Task<Void, Never>?
    @State private var visibleRegion: MKCoordinateRegion?
    /// Set when the camera flies to a search result, so its known name is kept
    /// instead of being looked up again when the camera settles.
    @State private var knownPlace: LocationSearchResult?

    init(initial: LocationSearchResult? = nil, onSelect: @escaping (LocationSearchResult) -> Void) {
        self.initial = initial
        self.onSelect = onSelect
        if let initial {
            _position = State(initialValue: .region(MKCoordinateRegion(center: initial.coordinate, span: Self.placeSpan)))
            _pinned = State(initialValue: .ready(initial.coordinate, place: initial))
            _knownPlace = State(initialValue: initial)
        } else {
            _position = State(initialValue: .userLocation(fallback: .automatic))
            _pinned = State(initialValue: .idle)
        }
    }

    var body: some View {
        NavigationStack {
            map
                .overlay { if showsResults { resultsList } }
                .safeAreaInset(edge: .bottom, spacing: 0) { if !showsResults { confirmPanel } }
                .navigationTitle("Choose Location")
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                .searchable(text: $query, isPresented: $isSearchPresented,
                            placement: .navigationBarDrawer(displayMode: .always),
                            prompt: "Search for a place")
                #else
                .searchable(text: $query, isPresented: $isSearchPresented, prompt: "Search for a place")
                #endif
                .onSubmit(of: .search) { if let first = results.first { pick(first) } }
                .onChange(of: query) { search() }
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                }
        }
        .formSheetSize(minWidth: 560, minHeight: 640)
    }

    // MARK: - Map

    private var map: some View {
        Map(position: $position) {
            UserAnnotation()
        }
        .mapStyle(.standard(elevation: .realistic))
        .mapControls {
            MapUserLocationButton()
            MapCompass()
            MapScaleView()
        }
        .onMapCameraChange(frequency: .continuous) { _ in
            if !isMoving { isMoving = true }
        }
        .onMapCameraChange(frequency: .onEnd) { context in
            visibleRegion = context.region
            cameraSettled(at: context.region.center)
        }
        .overlay { pin.allowsHitTesting(false) }
        .accessibilityIdentifier("location_picker_map")
    }

    /// The fixed pin. Its tip sits on the centre of the map, and it lifts
    /// while the map moves underneath it.
    private var pin: some View {
        ZStack {
            Ellipse()
                .fill(.black.opacity(isMoving ? 0.3 : 0.2))
                .frame(width: isMoving ? 10 : 8, height: isMoving ? 5 : 4)
            VStack(spacing: 0) {
                Image(systemName: "mappin.circle.fill")
                    .font(.system(size: 36))
                    .symbolRenderingMode(.palette)
                    .foregroundStyle(.white, .red)
                Rectangle()
                    .fill(.red)
                    .frame(width: 3, height: 14)
            }
            .shadow(color: .black.opacity(0.25), radius: 3, y: 2)
            // Puts the stem's tip, not the view's centre, on the map's centre.
            .offset(y: isMoving ? -37 : -25)
        }
        .animation(.spring(duration: 0.3, bounce: 0.4), value: isMoving)
        .accessibilityHidden(true)
    }

    // MARK: - Confirm panel

    private var confirmPanel: some View {
        VStack(spacing: 16) {
            HStack(spacing: 14) {
                Image(systemName: "mappin.circle.fill")
                    .font(.title)
                    .symbolRenderingMode(.palette)
                    .foregroundStyle(.white, .red)
                VStack(alignment: .leading, spacing: 2) {
                    Text(label.title)
                        .font(.headline)
                        .foregroundStyle(isLoading ? .secondary : .primary)
                        .lineLimit(1)
                    if let region = label.region {
                        Text(region)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("location_picker_place")
            }
            Button {
                confirm()
            } label: {
                Text("Use This Location")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(!isReady)
            .accessibilityIdentifier("location_picker_confirm")
        }
        .padding(.horizontal, 20)
        .padding(.top, 18)
        .padding(.bottom, 12)
        .background(.regularMaterial)
    }

    private var isLoading: Bool {
        if case .loading = pinned { return true }
        return false
    }

    private var isReady: Bool {
        if case .ready = pinned { return true }
        return false
    }

    private var label: (title: String, region: String?) {
        switch pinned {
        case .idle:
            return ("Move the map to choose a place", nil)
        case .loading(let coordinate):
            return ("Finding this place…", Self.coordinateText(coordinate))
        case .ready(let coordinate, nil):
            return ("Dropped Pin", Self.coordinateText(coordinate))
        case .ready(let coordinate, let place?):
            return (place.name, place.subtitle.isEmpty ? Self.coordinateText(coordinate) : place.subtitle)
        }
    }

    private static func coordinateText(_ coordinate: CLLocationCoordinate2D) -> String {
        String(format: "%.4f, %.4f", coordinate.latitude, coordinate.longitude)
    }

    // MARK: - Search results

    private var showsResults: Bool {
        isSearchPresented && query.trimmingCharacters(in: .whitespaces).count >= 2
    }

    private var resultsList: some View {
        List {
            if isSearching && results.isEmpty {
                HStack { Spacer(); ProgressView(); Spacer() }
                    .listRowSeparator(.hidden)
            } else if results.isEmpty {
                ContentUnavailableView.search(text: query)
                    .listRowSeparator(.hidden)
            }
            ForEach(Array(results.enumerated()), id: \.element.id) { index, result in
                Button {
                    pick(result)
                } label: {
                    HStack(spacing: 14) {
                        Image(systemName: "mappin.circle.fill")
                            .font(.title2)
                            .symbolRenderingMode(.palette)
                            .foregroundStyle(.white, .red)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(result.name).foregroundStyle(.primary).lineLimit(1)
                            if !result.subtitle.isEmpty {
                                Text(result.subtitle).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    // Plain buttons only hit-test their glyphs; make the whole row tappable.
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("location_picker_result_\(index)")
            }
        }
        .listStyle(.plain)
        .background(.background)
    }

    // MARK: - Actions

    private func pick(_ result: LocationSearchResult) {
        knownPlace = result
        pinned = .ready(result.coordinate, place: result)
        isSearchPresented = false
        withAnimation(.easeInOut(duration: 0.6)) {
            position = .region(MKCoordinateRegion(center: result.coordinate, span: Self.placeSpan))
        }
    }

    private func cameraSettled(at center: CLLocationCoordinate2D) {
        isMoving = false
        lookupTask?.cancel()
        if let known = knownPlace,
           CLLocation(latitude: known.latitude, longitude: known.longitude)
            .distance(from: CLLocation(latitude: center.latitude, longitude: center.longitude)) < 25 {
            knownPlace = nil
            pinned = .ready(center, place: known)
            return
        }
        knownPlace = nil
        pinned = .loading(center)
        lookupTask = Task {
            let place = await Self.place(at: center)
            guard !Task.isCancelled else { return }
            pinned = .ready(center, place: place)
        }
    }

    private func confirm() {
        guard case .ready(let coordinate, let place) = pinned else { return }
        onSelect(LocationSearchResult(
            name: place?.fullName ?? "Dropped Pin",
            subtitle: "",
            latitude: coordinate.latitude,
            longitude: coordinate.longitude
        ))
        dismiss()
    }

    private func search() {
        searchTask?.cancel()
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 2 else { results = []; isSearching = false; return }
        isSearching = true
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }
            let found = await Self.search(trimmed, near: visibleRegion)
            guard !Task.isCancelled else { return }
            results = found
            isSearching = false
        }
    }

    // MARK: - MapKit lookups

    private static func search(_ query: String, near visible: MKCoordinateRegion?) async -> [LocationSearchResult] {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = query
        request.resultTypes = [.pointOfInterest, .address]
        if let visible { request.region = visible }
        guard let response = try? await MKLocalSearch(request: request).start() else { return [] }
        return response.mapItems.compactMap { item in
            guard let name = item.name else { return nil }
            return LocationSearchResult(
                name: name,
                subtitle: region(of: item.placemark, excluding: name),
                latitude: item.placemark.coordinate.latitude,
                longitude: item.placemark.coordinate.longitude
            )
        }
    }

    private static func place(at coordinate: CLLocationCoordinate2D) async -> LocationSearchResult? {
        let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        guard let placemark = try? await CLGeocoder().reverseGeocodeLocation(location).first,
              let name = placemark.areasOfInterest?.first ?? placemark.name ?? placemark.locality
        else { return nil }
        return LocationSearchResult(
            name: name,
            subtitle: region(of: placemark, excluding: name),
            latitude: coordinate.latitude,
            longitude: coordinate.longitude
        )
    }

    private static func region(of placemark: CLPlacemark, excluding name: String) -> String {
        [placemark.locality, placemark.administrativeArea, placemark.country]
            .compactMap { $0 }
            .filter { $0 != name }
            .joined(separator: ", ")
    }
}
