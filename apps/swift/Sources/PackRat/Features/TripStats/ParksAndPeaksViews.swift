import MapKit
import SwiftUI

// MARK: - Stats screen cards

/// "N of 63" with a bar and the latest parks, opening the full checklist.
struct ParksCard: View {
    let record: TripParksAndPeaks
    let unit: TripDistanceUnit

    var body: some View {
        let visited = record.visitedParks
        NavigationLink {
            ParksChecklistView(unit: unit)
        } label: {
            StatsCard(title: "National Parks") {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(visited.count, format: .number)
                        .font(.title.weight(.bold))
                        .monospacedDigit()
                    Text("of \(NationalParks.count)")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.tertiary)
                }
                ProgressView(value: Double(visited.count), total: Double(NationalParks.count))
                    .tint(.green)
                Text(summary(visited))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("National Parks, \(visited.count) of \(NationalParks.count) visited")
        .accessibilityIdentifier("trip_stats_parks_card")
    }

    private func summary(_ visited: [TripParksAndPeaks.ParkStatus]) -> String {
        guard !visited.isEmpty else {
            return "Trips inside a park tick it off. Add parks you visited before PackRat."
        }
        let latest = visited
            .sorted { ($0.visits.compactMap(\.date).max() ?? .distantPast) > ($1.visits.compactMap(\.date).max() ?? .distantPast) }
            .prefix(3)
            .map(\.park.name)
        return "Latest: " + latest.formatted(.list(type: .and))
    }
}

/// Peak count and highest summit, opening the full list. With no summits yet
/// it invites one instead of showing zeros.
struct PeaksCard: View {
    let record: TripParksAndPeaks
    let unit: TripDistanceUnit

    var body: some View {
        NavigationLink {
            PeaksListView(unit: unit)
        } label: {
            StatsCard(title: "Peaks") {
                if record.ascents.isEmpty {
                    HStack(spacing: 12) {
                        Image(systemName: "flag.fill")
                            .foregroundStyle(Color.accentColor)
                            .frame(width: 32, height: 32)
                            .background(Color.accentColor.opacity(0.12), in: Circle())
                        Text("Add the summits you reach in a trip's log, or add past climbs by hand.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.leading)
                        Spacer(minLength: 0)
                        chevron
                    }
                } else {
                    HStack(alignment: .top, spacing: 16) {
                        figure("\(record.peakCount)", record.peakCount == 1 ? "Peak" : "Peaks")
                        if let highest = record.highest, let metres = highest.summit.elevationMeters {
                            figure(unit.formatElevation(metres), "Highest · \(highest.summit.name)")
                        }
                        Spacer(minLength: 0)
                        chevron
                    }
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("trip_stats_peaks_card")
    }

    private var chevron: some View {
        Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
    }

    private func figure(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.title.weight(.bold)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
            Text(label).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
        }
    }
}

// MARK: - Shared record

extension AppState {
    /// The parks and peaks record over every finished trip and hand-added entry.
    var parksAndPeaks: TripParksAndPeaks {
        let stats = TripStats(trips: tripsVM.trips, packs: [])
        return TripParksAndPeaks(finished: stats.finished, entries: tripGoalsVM.entries)
    }
}

// MARK: - Parks checklist

struct ParksChecklistView: View {
    @Environment(AppState.self) private var appState
    let unit: TripDistanceUnit

    enum Filter: String, CaseIterable, Identifiable {
        case all = "All", visited = "Visited", notYet = "Not Yet"
        var id: String { rawValue }
    }

    @State private var filter: Filter = .all
    @State private var query = ""

    var body: some View {
        let record = appState.parksAndPeaks
        let rows = record.parks.filter { status in
            switch filter {
            case .all: return true
            case .visited: return status.isVisited
            case .notYet: return !status.isVisited
            }
        }
        .filter { query.isEmpty || $0.park.name.localizedCaseInsensitiveContains(query) || $0.park.states.contains(query.uppercased()) }

        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text("\(record.visitedParks.count) of \(NationalParks.count) visited")
                        .font(.headline)
                    ProgressView(value: Double(record.visitedParks.count), total: Double(NationalParks.count))
                        .tint(.green)
                }
                .padding(.vertical, 4)
                Picker("Show", selection: $filter) {
                    ForEach(Filter.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("parks_filter")
            }

            Section {
                ForEach(rows) { status in
                    NavigationLink {
                        ParkDetailView(code: status.park.code)
                    } label: {
                        ParkRow(status: status)
                    }
                    .accessibilityIdentifier("park_row_\(status.park.code)")
                }
            } footer: {
                Text("A trip counts when its location or route is inside the park. Boundaries from the National Park Service.")
            }
        }
        .searchable(text: $query, prompt: "Park or state")
        .overlay {
            if rows.isEmpty {
                ContentUnavailableView.search(text: query)
            }
        }
        .navigationTitle("National Parks")
        .accessibilityIdentifier("parks_checklist")
    }
}

private struct ParkRow: View {
    let status: TripParksAndPeaks.ParkStatus

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: status.isVisited ? "checkmark.circle.fill" : "circle")
                .font(.title3)
                .foregroundStyle(status.isVisited ? Color.green : Color.secondary.opacity(0.5))
            VStack(alignment: .leading, spacing: 2) {
                Text(status.park.name)
                Text(detail).font(.caption).foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(status.isVisited ? .isSelected : [])
    }

    private var detail: String {
        let states = status.park.states.joined(separator: ", ")
        guard status.isVisited else { return states }
        let visits = status.visits.count == 1 ? "1 visit" : "\(status.visits.count) visits"
        if let first = status.firstVisit {
            return "\(states) · \(visits) · first \(first.formatted(.dateTime.month(.abbreviated).year()))"
        }
        return "\(states) · \(visits)"
    }
}

struct ParkDetailView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext
    let code: String

    @State private var addingVisit = false

    var body: some View {
        let status = appState.parksAndPeaks.parks.first { $0.park.code == code }
        List {
            if let status {
                Section {
                    Map(initialPosition: .rect(Self.rect(for: status.park)), interactionModes: [.zoom, .pan]) {
                        ForEach(Array(status.park.rings.enumerated()), id: \.offset) { _, ring in
                            MapPolygon(coordinates: ring)
                                .foregroundStyle(.green.opacity(0.18))
                                .stroke(.green, lineWidth: 1.5)
                        }
                    }
                    .mapStyle(.standard(elevation: .realistic, pointsOfInterest: .excludingAll))
                    .frame(height: 220)
                    .listRowInsets(EdgeInsets())
                }

                Section {
                    if status.visits.isEmpty {
                        Text("Not visited yet. A trip here ticks it off, or add a visit from before PackRat.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(status.visits) { visit in
                        VisitRow(visit: visit)
                            .deleteDisabled(visit.tripId != nil)
                    }
                    .onDelete { offsets in
                        let ids = offsets.map { status.visits[$0] }.filter { $0.tripId == nil }.map(\.id)
                        Task { await appState.tripGoalsVM.deleteEntries(ids: ids, context: modelContext) }
                    }
                    Button {
                        addingVisit = true
                    } label: {
                        Label("Add a Past Visit", systemImage: "plus")
                    }
                    .accessibilityIdentifier("park_add_visit")
                } header: {
                    Text("Visits")
                } footer: {
                    if status.visits.contains(where: { $0.tripId != nil }) {
                        Text("Visits from trips follow the trip. Change the trip to change them.")
                    }
                }
            }
        }
        .navigationTitle(status?.park.name ?? "Park")
        .sheet(isPresented: $addingVisit) {
            DatedEntrySheet(title: "Add a Visit", dateLabel: "Visited on") { date in
                let entry = TripStatsEntry(
                    id: UUID().uuidString.lowercased(),
                    kind: .park,
                    parkCode: code,
                    date: date.map { TripGoal.dayString(from: $0) }
                )
                Task { await appState.tripGoalsVM.save(entry, context: modelContext) }
            }
        }
    }

    private static func rect(for park: NationalPark) -> MKMapRect {
        let corners = [
            CLLocationCoordinate2D(latitude: park.minLatitude, longitude: park.minLongitude),
            CLLocationCoordinate2D(latitude: park.maxLatitude, longitude: park.maxLongitude),
        ].map(MKMapPoint.init)
        let rect = MKMapRect(
            x: min(corners[0].x, corners[1].x),
            y: min(corners[0].y, corners[1].y),
            width: abs(corners[0].x - corners[1].x),
            height: abs(corners[0].y - corners[1].y)
        )
        return rect.insetBy(dx: -rect.width * 0.1, dy: -rect.height * 0.1)
    }
}

private struct VisitRow: View {
    @Environment(AppState.self) private var appState
    let visit: TripParksAndPeaks.Visit

    var body: some View {
        if let tripId = visit.tripId {
            Button {
                appState.selectedTripId = tripId
                appState.navItem = .trips
            } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(visit.tripName ?? "Trip")
                        if let date = visit.date {
                            Text(date.formatted(date: .abbreviated, time: .omitted)).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        } else {
            VStack(alignment: .leading, spacing: 2) {
                Text("Added by hand")
                Text(visit.date?.formatted(date: .abbreviated, time: .omitted) ?? "Date not recorded")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

/// A date, or "I don't remember", for a hand-added visit.
private struct DatedEntrySheet: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    let dateLabel: String
    let onSave: (Date?) -> Void

    @State private var knowsDate = true
    @State private var date = Calendar.current.startOfDay(for: .now)

    var body: some View {
        NavigationStack {
            Form {
                Toggle("I know the date", isOn: $knowsDate)
                if knowsDate {
                    DatePicker(dateLabel, selection: $date, in: ...Date.now, displayedComponents: .date)
                }
            }
            .navigationTitle(title)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        onSave(knowsDate ? date : nil)
                        dismiss()
                    }
                    .accessibilityIdentifier("dated_entry_save")
                }
            }
        }
        .presentationDetents([.medium])
        .formSheetSize(minWidth: 420, minHeight: 280)
    }
}

// MARK: - Peaks list

struct PeaksListView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext
    let unit: TripDistanceUnit

    @State private var adding = false

    var body: some View {
        let record = appState.parksAndPeaks
        List {
            if !record.ascents.isEmpty {
                Section {
                    HStack(spacing: 24) {
                        figure("\(record.peakCount)", record.peakCount == 1 ? "Peak" : "Peaks")
                        figure("\(record.ascents.count)", record.ascents.count == 1 ? "Summit" : "Summits")
                        if let metres = record.highest?.summit.elevationMeters {
                            figure(unit.formatElevation(metres), "Highest")
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            Section {
                ForEach(record.ascents) { ascent in
                    AscentRow(ascent: ascent, unit: unit)
                        .deleteDisabled(ascent.tripId != nil)
                }
                .onDelete { offsets in
                    let ids = offsets.map { record.ascents[$0] }.filter { $0.tripId == nil }.map(\.id)
                    Task { await appState.tripGoalsVM.deleteEntries(ids: ids, context: modelContext) }
                }
            } footer: {
                if !record.ascents.isEmpty {
                    Text("Summits from trips live in each trip's log. Swipe to remove one you added by hand.")
                }
            }
        }
        .overlay {
            if record.ascents.isEmpty {
                ContentUnavailableView {
                    Label("No Summits Yet", systemImage: "flag")
                } description: {
                    Text("Add the peaks you reach in a trip's log, or add climbs from before PackRat here.")
                } actions: {
                    Button("Add a Past Summit") { adding = true }
                        .buttonStyle(.borderedProminent)
                }
            }
        }
        .navigationTitle("Peaks")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { adding = true } label: { Label("Add Summit", systemImage: "plus") }
                    .accessibilityIdentifier("peaks_add")
            }
        }
        .sheet(isPresented: $adding) {
            PastSummitEditor(unit: unit, region: PeakPickerView.region(
                route: [],
                location: appState.tripsVM.trips.activeTrips.compactMap(\.location).last
            ))
        }
        .accessibilityIdentifier("peaks_list")
    }

    private func figure(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.title2.weight(.bold)).monospacedDigit()
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
    }
}

private struct AscentRow: View {
    @Environment(AppState.self) private var appState
    let ascent: TripParksAndPeaks.Ascent
    let unit: TripDistanceUnit

    var body: some View {
        let detail = [ascent.summit.elevationMeters.map(unit.formatElevation), ascent.tripName ?? "Added by hand"]
            .compactMap { $0 }
            .joined(separator: " · ")
        let content = HStack(spacing: 10) {
            Image(systemName: "flag.fill").foregroundStyle(Color.accentColor)
            VStack(alignment: .leading, spacing: 2) {
                Text(ascent.summit.name).lineLimit(1)
                Text(detail).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            .layoutPriority(1)
            Spacer(minLength: 8)
            Text(ascent.date?.formatted(.dateTime.month(.abbreviated).year()) ?? "Undated")
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize()
        }
        .accessibilityElement(children: .combine)
        if let tripId = ascent.tripId {
            Button {
                appState.selectedTripId = tripId
                appState.navItem = .trips
            } label: { content.contentShape(Rectangle()) }
            .buttonStyle(.plain)
        } else {
            content
        }
    }
}

struct SummitRow: View {
    let summit: TripSummit
    let unit: TripDistanceUnit

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "flag.fill").foregroundStyle(Color.accentColor)
            VStack(alignment: .leading, spacing: 2) {
                Text(summit.name)
                if let metres = summit.elevationMeters {
                    Text(unit.formatElevation(metres)).font(.caption).foregroundStyle(.secondary).monospacedDigit()
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// A climb from before PackRat: picked from the map, or typed in.
private struct PastSummitEditor: View {
    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    let unit: TripDistanceUnit
    let region: MKCoordinateRegion

    @State private var summit: TripSummit?
    @State private var choosing = false
    @State private var knowsDate = true
    @State private var date = Calendar.current.startOfDay(for: .now)

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if let summit {
                        SummitRow(summit: summit, unit: unit)
                        Button("Choose a Different Peak") { choosing = true }
                    } else {
                        Button {
                            choosing = true
                        } label: {
                            Label("Choose a Peak", systemImage: "mountain.2")
                        }
                        .accessibilityIdentifier("past_summit_choose")
                    }
                } header: {
                    Text("Peak")
                }
                Section {
                    Toggle("I know the date", isOn: $knowsDate)
                    if knowsDate {
                        DatePicker("Summited on", selection: $date, in: ...Date.now, displayedComponents: .date)
                    }
                }
            }
            .navigationTitle("Add a Past Summit")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add", action: save)
                        .disabled(summit == nil)
                        .accessibilityIdentifier("past_summit_save")
                }
            }
            .sheet(isPresented: $choosing) {
                PeakPickerView(region: region, excluded: []) { summit = $0 }
            }
        }
        .formSheetSize(minWidth: 480, minHeight: 420)
    }

    private func save() {
        guard let summit else { return }
        let entry = TripStatsEntry(
            id: UUID().uuidString.lowercased(),
            kind: .summit,
            name: summit.name,
            elevationMeters: summit.elevationMeters,
            latitude: summit.latitude,
            longitude: summit.longitude,
            osmId: summit.osmId,
            date: knowsDate ? TripGoal.dayString(from: date) : nil
        )
        Task { await appState.tripGoalsVM.save(entry, context: modelContext) }
        dismiss()
    }
}

// MARK: - Peak picker

/// Named peaks from OpenStreetMap in the area on the map, highest first. Pan
/// and "Search This Area" to look elsewhere; a peak that isn't mapped can be
/// typed in by hand.
struct PeakPickerView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("speedUnit") private var speedUnit: SpeedUnit = .mph

    let region: MKCoordinateRegion
    let excluded: Set<String>
    let onPick: (TripSummit) -> Void

    private enum LoadState: Equatable {
        case loading, loaded, failed(String)
    }

    @State private var position: MapCameraPosition
    @State private var visibleRegion: MKCoordinateRegion?
    @State private var searchedRegion: MKCoordinateRegion?
    @State private var peaks: [NearbyPeak] = []
    @State private var state: LoadState = .loading
    @State private var query = ""
    @State private var typing = false
    @State private var typedName = ""
    @State private var typedElevation = ""

    init(region: MKCoordinateRegion, excluded: Set<String>, onPick: @escaping (TripSummit) -> Void) {
        self.region = region
        self.excluded = excluded
        self.onPick = onPick
        _position = State(initialValue: .region(region))
    }

    private var unit: TripDistanceUnit { TripDistanceUnit(speedUnit: speedUnit) }

    private var filtered: [NearbyPeak] {
        peaks.filter { query.isEmpty || $0.name.localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ZStack(alignment: .top) {
                    Map(position: $position) {
                        ForEach(filtered) { peak in
                            Annotation(peak.name, coordinate: CLLocationCoordinate2D(latitude: peak.latitude, longitude: peak.longitude)) {
                                Image(systemName: "triangle.fill")
                                    .font(.caption2)
                                    .foregroundStyle(.brown)
                            }
                            .annotationTitles(.hidden)
                        }
                    }
                    .mapStyle(.standard(elevation: .realistic, pointsOfInterest: .excludingAll))
                    .onMapCameraChange(frequency: .onEnd) { visibleRegion = $0.region }

                    if let visibleRegion, visibleRegion.differs(from: searchedRegion) {
                        Button {
                            Task { await load(visibleRegion) }
                        } label: {
                            Label("Search This Area", systemImage: "magnifyingglass")
                                .font(.subheadline.weight(.semibold))
                        }
                        .buttonStyle(.borderedProminent)
                        .buttonBorderShape(.capsule)
                        .padding(.top, 10)
                        .accessibilityIdentifier("peak_picker_search_area")
                    }
                }
                .frame(height: 220)

                List {
                    switch state {
                    case .loading:
                        HStack { Spacer(); ProgressView("Finding peaks…"); Spacer() }
                            .listRowBackground(Color.clear)
                    case .failed(let message):
                        VStack(alignment: .leading, spacing: 8) {
                            Text(message).foregroundStyle(.secondary)
                            if KeychainService.shared.sessionToken != nil {
                                Button("Try Again") { Task { await load(searchedRegion ?? region) } }
                            }
                        }
                    case .loaded:
                        if filtered.isEmpty {
                            Text(peaks.isEmpty ? "No named peaks here. Move the map or zoom out, then search this area." : "No peaks match “\(query)”.")
                                .foregroundStyle(.secondary)
                        }
                        ForEach(filtered) { peak in
                            let taken = excluded.contains(peak.summit.peakKey)
                            Button {
                                onPick(peak.summit)
                                dismiss()
                            } label: {
                                HStack {
                                    SummitRow(summit: peak.summit, unit: unit)
                                    Spacer()
                                    if taken { Image(systemName: "checkmark").foregroundStyle(Color.accentColor) }
                                }
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .disabled(taken)
                            .accessibilityIdentifier("peak_option_\(peak.osmId)")
                        }
                    }

                    Section {
                        Button("Enter a Peak by Hand", systemImage: "pencil") { typing = true }
                            .accessibilityIdentifier("peak_picker_by_hand")
                    } footer: {
                        Text("Peak data © OpenStreetMap contributors.")
                    }
                }
                .searchable(text: $query, prompt: "Filter peaks")
            }
            .navigationTitle("Choose a Peak")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
            .alert("Enter a Peak", isPresented: $typing) {
                TextField("Name", text: $typedName)
                TextField("Elevation (\(unit.elevationSymbol))", text: $typedElevation)
                    #if os(iOS)
                    .keyboardType(.numberPad)
                    #endif
                Button("Cancel", role: .cancel) {}
                Button("Add") { addTyped() }
            } message: {
                Text("For a peak that isn't on the map.")
            }
            .task { await load(region) }
        }
        .formSheetSize(minWidth: 520, minHeight: 640)
    }

    private func load(_ region: MKCoordinateRegion) async {
        searchedRegion = region
        guard KeychainService.shared.sessionToken != nil else {
            state = .failed("Sign in to search mapped peaks. You can still enter a peak by hand.")
            return
        }
        state = .loading
        let box = PeakPickerView.box(around: region)
        do {
            peaks = try await TripStatsService.shared.nearbyPeaks(
                south: box.south, west: box.west, north: box.north, east: box.east
            )
            state = .loaded
        } catch {
            state = .failed(NetworkMonitor.shared.isConnected
                ? "Couldn't load peaks right now. Try again in a moment, or enter the peak by hand."
                : "You're offline. Enter the peak by hand, or try again when you're connected.")
        }
    }

    private func addTyped() {
        let name = typedName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        let elevation = Double(typedElevation.trimmingCharacters(in: .whitespaces)).map(unit.metres(fromElevation:))
        let center = (searchedRegion ?? region).center
        onPick(TripSummit(name: name, elevationMeters: elevation, latitude: center.latitude, longitude: center.longitude, osmId: nil))
        dismiss()
    }

    // MARK: Regions

    /// The server takes boxes up to 1° × 1.5°; a wider view is trimmed to its middle.
    static func box(around region: MKCoordinateRegion) -> (south: Double, west: Double, north: Double, east: Double) {
        let latSpan = min(max(region.span.latitudeDelta, 0.02), 0.98) / 2
        let lonSpan = min(max(region.span.longitudeDelta, 0.02), 1.48) / 2
        let center = region.center
        return (
            max(center.latitude - latSpan, -90),
            max(center.longitude - lonSpan, -180),
            min(center.latitude + latSpan, 90),
            min(center.longitude + lonSpan, 180)
        )
    }

    /// Around the route when there is one, else the trip's location, else the continental US.
    static func region(route: [CLLocationCoordinate2D], location: TripLocation?) -> MKCoordinateRegion {
        if route.count >= 2 {
            let lats = route.map(\.latitude), lons = route.map(\.longitude)
            let minLat = lats.min() ?? 0, maxLat = lats.max() ?? 0
            let minLon = lons.min() ?? 0, maxLon = lons.max() ?? 0
            return MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2, longitude: (minLon + maxLon) / 2),
                span: MKCoordinateSpan(
                    latitudeDelta: max((maxLat - minLat) * 1.3, 0.08),
                    longitudeDelta: max((maxLon - minLon) * 1.3, 0.08)
                )
            )
        }
        if let location {
            return MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: location.latitude, longitude: location.longitude),
                span: MKCoordinateSpan(latitudeDelta: 0.3, longitudeDelta: 0.3)
            )
        }
        return MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 39.5, longitude: -105.8),
            span: MKCoordinateSpan(latitudeDelta: 0.6, longitudeDelta: 0.8)
        )
    }
}

private extension MKCoordinateRegion {
    /// True once the map has moved or zoomed enough to be worth a new search.
    func differs(from other: MKCoordinateRegion?) -> Bool {
        guard let other else { return true }
        let moved = abs(center.latitude - other.center.latitude) > span.latitudeDelta * 0.25
            || abs(center.longitude - other.center.longitude) > span.longitudeDelta * 0.25
        let zoomed = abs(span.latitudeDelta - other.span.latitudeDelta) > other.span.latitudeDelta * 0.4
        return moved || zoomed
    }
}
