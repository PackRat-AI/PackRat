import MapKit
import SwiftUI
import UniformTypeIdentifiers

// MARK: - Detail section

/// The Trip log on a finished trip's detail screen: a prompt to log it, or
/// what was logged, plus the switch that leaves the trip out of stats.
struct TripLogSection: View {
    let trip: Trip
    let viewModel: TripsViewModel

    @State private var showingEditor = false
    @Environment(\.modelContext) private var modelContext
    @AppStorage("speedUnit") private var speedUnit: SpeedUnit = .mph

    private var unit: TripDistanceUnit { TripDistanceUnit(speedUnit: speedUnit) }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("TRIP LOG")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            if let log = trip.log {
                loggedCard(log)
            } else {
                promptCard
            }

            Toggle(isOn: Binding(
                get: { !trip.isExcludedFromStats },
                set: { counts in
                    Task { await viewModel.setExcludedFromStats(!counts, for: trip.id, context: modelContext) }
                }
            )) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Count in Trip Stats").font(.callout)
                    Text("Turn off for a trip that didn't happen or wasn't yours.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(14)
            .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .accessibilityIdentifier("trip_log_count_in_stats")
        }
        .padding(.horizontal)
        .sheet(isPresented: $showingEditor) {
            TripLogEditor(trip: trip, viewModel: viewModel)
        }
    }

    private var promptCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "figure.hiking")
                    .font(.title2)
                    .foregroundStyle(Color.accentColor)
                    .frame(width: 36, height: 36)
                    .background(Color.accentColor.opacity(0.12), in: Circle())
                VStack(alignment: .leading, spacing: 4) {
                    Text("How did it go?").font(.headline)
                    Text("Add what you did, how far and how much you climbed, or import a GPS track. It all counts toward your Trip Stats.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Button {
                showingEditor = true
            } label: {
                Text("Log This Trip").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .accessibilityIdentifier("trip_log_start")
        }
        .padding(16)
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func loggedCard(_ log: TripLog) -> some View {
        Button {
            showingEditor = true
        } label: {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 16) {
                    if let distance = log.distanceMeters {
                        figure(unit.formatDistance(distance), "Distance", "point.topleft.down.to.point.bottomright.curvepath")
                    }
                    if let gain = log.elevationGainMeters {
                        figure(unit.formatElevation(gain), "Climbing", "arrow.up.right")
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.tertiary)
                }
                if !log.activities.isEmpty {
                    ActivityChips(activities: log.activities)
                }
                if !log.summits.isEmpty {
                    Label(
                        log.summits.map(\.name).formatted(.list(type: .and)),
                        systemImage: "flag.fill"
                    )
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .accessibilityIdentifier("trip_log_summits")
                }
                if log.distanceMeters == nil, log.elevationGainMeters == nil, log.activities.isEmpty, log.summits.isEmpty {
                    Text("Route saved").font(.callout).foregroundStyle(.secondary)
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.background.secondary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityHint("Edit the trip log")
        .accessibilityIdentifier("trip_log_card")
    }

    private func figure(_ value: String, _ label: String, _ symbol: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Label(label, systemImage: symbol)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value).font(.title3.bold().monospacedDigit())
        }
    }
}

private struct ActivityChips: View {
    let activities: [TripActivity]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(activities) { activity in
                    Label(activity.label, systemImage: activity.symbol)
                        .font(.caption.weight(.medium))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.accentColor.opacity(0.12), in: Capsule())
                        .foregroundStyle(Color.accentColor)
                }
            }
        }
    }
}

// MARK: - Editor

/// Fills a trip log by hand, from a GPS track file, or both: a track sets the
/// distance, climbing and route, and any figure can still be corrected.
struct TripLogEditor: View {
    let trip: Trip
    let viewModel: TripsViewModel

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @AppStorage("speedUnit") private var speedUnit: SpeedUnit = .mph

    @State private var activities: [TripActivity] = []
    @State private var distanceText = ""
    @State private var elevationText = ""
    @State private var route: String?
    @State private var source: TripLog.Source?
    @State private var summits: [TripSummit] = []
    @State private var showingPeakPicker = false
    @State private var showingImporter = false
    @State private var importError: String?
    @State private var isSaving = false
    @State private var confirmingClear = false
    @FocusState private var focusedField: Field?

    private enum Field { case distance, elevation }

    private var unit: TripDistanceUnit { TripDistanceUnit(speedUnit: speedUnit) }
    private var routeCoordinates: [CLLocationCoordinate2D] { route.map(Polyline.decode) ?? [] }

    private static let gpxType = UTType(filenameExtension: "gpx", conformingTo: .xml) ?? .xml

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 130), spacing: 8)], spacing: 8) {
                        ForEach(TripActivity.allCases) { activity in
                            activityToggle(activity)
                        }
                    }
                    .padding(.vertical, 4)
                } header: {
                    Text("What did you do?")
                }

                Section {
                    if routeCoordinates.count >= 2 {
                        RoutePreview(coordinates: routeCoordinates)
                            .frame(height: 180)
                            .listRowInsets(EdgeInsets())
                        Button("Replace Track", systemImage: "arrow.triangle.2.circlepath") {
                            showingImporter = true
                        }
                        Button("Remove Route", systemImage: "trash", role: .destructive) {
                            route = nil
                            if source == .track { source = .manual }
                        }
                    } else {
                        Button {
                            showingImporter = true
                        } label: {
                            Label("Import GPS Track", systemImage: "square.and.arrow.down")
                        }
                        .accessibilityIdentifier("trip_log_import_track")
                    }
                    if let importError {
                        Text(importError).font(.footnote).foregroundStyle(.red)
                    }
                } header: {
                    Text("Route")
                } footer: {
                    Text("Export a GPX file from your watch, Strava, AllTrails, Gaia GPS or another app. PackRat reads the distance, climbing and route from it.")
                }

                Section {
                    ForEach(summits, id: \.self) { summit in
                        SummitRow(summit: summit, unit: unit)
                    }
                    .onDelete { summits.remove(atOffsets: $0) }
                    Button {
                        showingPeakPicker = true
                    } label: {
                        Label("Add Summit", systemImage: "plus")
                    }
                    .accessibilityIdentifier("trip_log_add_summit")
                } header: {
                    Text("Summits")
                } footer: {
                    Text("Pick from the named peaks around this trip. Summits count toward your Peaks list.")
                }

                Section {
                    numberField("Distance", text: $distanceText, symbol: unit.distanceSymbol, field: .distance)
                        .accessibilityIdentifier("trip_log_distance")
                    numberField("Elevation gain", text: $elevationText, symbol: unit.elevationSymbol, field: .elevation)
                        .accessibilityIdentifier("trip_log_elevation")
                } header: {
                    Text("Distance & Climbing")
                } footer: {
                    Text("Total for the whole trip. Leave blank if you don't know.")
                }

                if trip.log != nil {
                    Section {
                        Button("Clear Trip Log", role: .destructive) { confirmingClear = true }
                    }
                }
            }
            .navigationTitle("Trip Log")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(isSaving)
                        .accessibilityIdentifier("trip_log_save")
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") { focusedField = nil }
                }
            }
            .fileImporter(
                isPresented: $showingImporter,
                allowedContentTypes: [Self.gpxType, .xml],
                allowsMultipleSelection: false
            ) { result in
                importTrack(result)
            }
            .confirmationDialog("Clear this trip's log?", isPresented: $confirmingClear, titleVisibility: .visible) {
                Button("Clear Trip Log", role: .destructive) {
                    Task {
                        await viewModel.saveLog(nil, for: trip.id, context: modelContext)
                        dismiss()
                    }
                }
            } message: {
                Text("The trip stays, but its activity, distance, climbing, route and summits stop counting in your stats.")
            }
            .sheet(isPresented: $showingPeakPicker) {
                PeakPickerView(
                    region: PeakPickerView.region(route: routeCoordinates, location: trip.location),
                    excluded: Set(summits.map(\.peakKey))
                ) { picked in
                    if !summits.contains(where: { $0.peakKey == picked.peakKey }) { summits.append(picked) }
                }
            }
            .onAppear(perform: prefill)
        }
        .formSheetSize(minWidth: 520, minHeight: 640)
    }

    private func activityToggle(_ activity: TripActivity) -> some View {
        let selected = activities.contains(activity)
        return Button {
            if selected {
                activities.removeAll { $0 == activity }
            } else {
                activities.append(activity)
            }
        } label: {
            Label(activity.label, systemImage: activity.symbol)
                .font(.subheadline.weight(.medium))
                .lineLimit(1)
                .frame(maxWidth: .infinity, minHeight: 36)
                .padding(.horizontal, 8)
                .background(
                    selected ? Color.accentColor : Color.secondary.opacity(0.12),
                    in: RoundedRectangle(cornerRadius: 10, style: .continuous)
                )
                .foregroundStyle(selected ? Color.white : Color.primary)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
        .accessibilityIdentifier("trip_log_activity_\(activity.rawValue)")
    }

    private func numberField(_ title: String, text: Binding<String>, symbol: String, field: Field) -> some View {
        HStack {
            Text(title)
            Spacer()
            TextField("0", text: text)
                .multilineTextAlignment(.trailing)
                .monospacedDigit()
                .focused($focusedField, equals: field)
                #if os(iOS)
                .keyboardType(.decimalPad)
                #endif
                .frame(maxWidth: 120)
            Text(symbol).foregroundStyle(.secondary)
        }
    }

    private func prefill() {
        guard let log = trip.log else { return }
        activities = log.activities
        distanceText = log.distanceMeters.map { format(unit.distanceValue($0), digits: 1) } ?? ""
        elevationText = log.elevationGainMeters.map { format(unit.elevationValue($0), digits: 0) } ?? ""
        route = log.route
        source = log.source
        summits = log.summits
    }

    private func format(_ value: Double, digits: Int) -> String {
        value.formatted(.number.precision(.fractionLength(0...digits)).grouping(.never))
    }

    private func parse(_ text: String) -> Double? {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        let value = (try? Double(trimmed, format: .number)) ?? Double(trimmed.replacingOccurrences(of: ",", with: "."))
        return value.flatMap { $0 >= 0 ? $0 : nil }
    }

    private func importTrack(_ result: Result<[URL], Error>) {
        importError = nil
        do {
            guard let url = try result.get().first else { return }
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            let points = try GPXParser.parse(try Data(contentsOf: url))
            guard let summary = TrackSummary(points: points) else { throw GPXParser.Failure.noPoints }
            route = summary.route
            source = .track
            distanceText = format(unit.distanceValue(summary.distanceMeters), digits: 1)
            if let gain = summary.elevationGainMeters {
                elevationText = format(unit.elevationValue(gain), digits: 0)
            }
        } catch {
            importError = error.localizedDescription
        }
    }

    private func save() {
        isSaving = true
        let log = TripLog(
            activities: TripActivity.allCases.filter(activities.contains),
            distanceMeters: parse(distanceText).map(unit.metres(fromDistance:)),
            elevationGainMeters: parse(elevationText).map(unit.metres(fromElevation:)),
            route: route,
            source: source ?? .manual,
            summits: summits
        )
        Task {
            await viewModel.saveLog(log, for: trip.id, context: modelContext)
            isSaving = false
            dismiss()
        }
    }
}

// MARK: - Route map

struct RoutePreview: View {
    let coordinates: [CLLocationCoordinate2D]

    var body: some View {
        Map(initialPosition: .automatic, interactionModes: []) {
            MapPolyline(coordinates: coordinates)
                .stroke(.orange, style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
            if let start = coordinates.first {
                Annotation("Start", coordinate: start) {
                    Circle().fill(.green).stroke(.white, lineWidth: 2).frame(width: 12, height: 12)
                }
                .annotationTitles(.hidden)
            }
            if let end = coordinates.last {
                Annotation("Finish", coordinate: end) {
                    Circle().fill(.red).stroke(.white, lineWidth: 2).frame(width: 12, height: 12)
                }
                .annotationTitles(.hidden)
            }
        }
        .mapStyle(.standard(elevation: .realistic))
    }
}
