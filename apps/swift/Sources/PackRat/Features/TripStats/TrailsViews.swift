import MapKit
import SwiftUI

// MARK: - Stats screen card

/// How many trails the user has walked and how far they add up to, opening the
/// full list. With none logged yet it says how to add one instead of showing zeros.
struct TrailsCard: View {
    let record: TripTrailsRecord
    let unit: TripDistanceUnit

    var body: some View {
        NavigationLink {
            TrailsListView(unit: unit)
        } label: {
            StatsCard(title: "Trails") {
                if record.isEmpty {
                    HStack(spacing: 12) {
                        Image(systemName: "point.bottomleft.forward.to.point.topright.scurvepath")
                            .foregroundStyle(Color.accentColor)
                            .frame(width: 32, height: 32)
                            .background(Color.accentColor.opacity(0.12), in: Circle())
                        Text("Add the trails you walk in a trip's log. A GPS track finds them for you.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.leading)
                        Spacer(minLength: 0)
                        chevron
                    }
                } else {
                    HStack(alignment: .top, spacing: 16) {
                        figure("\(record.trails.count)", record.trails.count == 1 ? "Trail" : "Trails")
                        if record.totalLengthMeters > 0 {
                            figure(unit.formatDistance(record.totalLengthMeters), "Of trail")
                        }
                        Spacer(minLength: 0)
                        chevron
                    }
                    Text("Latest: " + record.trails.prefix(3).map(\.trail.name).formatted(.list(type: .and)))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("trip_stats_trails_card")
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

extension AppState {
    /// Every trail named in a finished trip's log.
    var tripTrails: TripTrailsRecord {
        TripTrailsRecord(finished: TripStats(trips: tripsVM.trips, packs: []).finished)
    }
}

// MARK: - List

struct TrailsListView: View {
    @Environment(AppState.self) private var appState
    let unit: TripDistanceUnit

    var body: some View {
        let record = appState.tripTrails
        List {
            if !record.isEmpty {
                Section {
                    HStack(spacing: 24) {
                        figure("\(record.trails.count)", record.trails.count == 1 ? "Trail" : "Trails")
                        let walks = record.trails.reduce(0) { $0 + $1.walks.count }
                        figure("\(walks)", walks == 1 ? "Walk" : "Walks")
                        if record.totalLengthMeters > 0 {
                            figure(unit.formatDistance(record.totalLengthMeters), "Of trail")
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            Section {
                ForEach(record.trails) { walked in
                    NavigationLink {
                        WalkedTrailDetailView(trailId: walked.trail.id, unit: unit)
                    } label: {
                        WalkedTrailRow(walked: walked, unit: unit)
                    }
                    .accessibilityIdentifier("trail_row_\(walked.trail.id)")
                }
            } footer: {
                if !record.isEmpty {
                    Text("Trails come from each trip's log. A trail walked on several trips counts once.")
                }
            }
        }
        .overlay {
            if record.isEmpty {
                ContentUnavailableView {
                    Label("No Trails Yet", systemImage: "point.bottomleft.forward.to.point.topright.scurvepath")
                } description: {
                    Text("Open a finished trip, then add the trails you walked in its Trip Log.")
                }
            }
        }
        .navigationTitle("Trails")
        .accessibilityIdentifier("trails_list")
    }

    private func figure(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.title2.weight(.bold)).monospacedDigit()
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
    }
}

private struct WalkedTrailRow: View {
    let walked: TripTrailsRecord.WalkedTrail
    let unit: TripDistanceUnit

    var body: some View {
        let times = walked.walks.count == 1 ? "Once" : "\(walked.walks.count) times"
        let detail = [walked.trail.lengthMeters.map(unit.formatDistance), times]
            .compactMap { $0 }
            .joined(separator: " · ")
        HStack(spacing: 10) {
            Image(systemName: "point.bottomleft.forward.to.point.topright.scurvepath")
                .foregroundStyle(Color.accentColor)
            VStack(alignment: .leading, spacing: 2) {
                Text(walked.trail.name).lineLimit(1)
                Text(detail).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            .layoutPriority(1)
            Spacer(minLength: 8)
            Text(walked.latest.formatted(.dateTime.month(.abbreviated).year()))
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize()
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Detail

/// One walked trail: its line on a map (fetched from the registry) and the
/// trips it was walked on.
struct WalkedTrailDetailView: View {
    @Environment(AppState.self) private var appState
    let trailId: String
    let unit: TripDistanceUnit

    @State private var detail: RegistryTrailDetail?
    @State private var mapUnavailable = false

    var body: some View {
        let walked = appState.tripTrails.trail(id: trailId)
        List {
            Section {
                Group {
                    if let detail, !detail.parts.isEmpty {
                        TrailMap(parts: detail.parts)
                    } else if mapUnavailable {
                        ContentUnavailableView(
                            "Map Unavailable",
                            systemImage: "map",
                            description: Text(KeychainService.shared.sessionToken == nil
                                ? "Sign in to see this trail on the map."
                                : "Couldn't load this trail's map. Check your connection.")
                        )
                    } else {
                        ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                    }
                }
                .frame(height: 260)
                .listRowInsets(EdgeInsets())
            }

            if let walked {
                if let length = walked.trail.lengthMeters {
                    Section {
                        LabeledContent("Length", value: unit.formatDistance(length))
                        LabeledContent("Walked", value: walked.walks.count == 1 ? "Once" : "\(walked.walks.count) times")
                    }
                }
                Section("Trips") {
                    ForEach(walked.walks) { walk in
                        Button {
                            appState.selectedTripId = walk.tripId
                            appState.navItem = .trips
                        } label: {
                            HStack {
                                Text(walk.tripName).lineLimit(1)
                                Spacer()
                                Text(walk.date.formatted(date: .abbreviated, time: .omitted))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .navigationTitle(walked?.trail.name ?? "Trail")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .task(id: trailId) {
            guard KeychainService.shared.sessionToken != nil else {
                mapUnavailable = true
                return
            }
            do {
                detail = try await TrailRegistryService.shared.trail(id: trailId)
            } catch {
                mapUnavailable = true
            }
        }
        .accessibilityIdentifier("walked_trail_detail")
    }
}

/// A registry trail's parts drawn on a map, framed to fit.
struct TrailMap: View {
    let parts: [[CLLocationCoordinate2D]]

    var body: some View {
        Map(initialPosition: .automatic, interactionModes: [.pan, .zoom]) {
            ForEach(parts.indices, id: \.self) { index in
                MapPolyline(coordinates: parts[index])
                    .stroke(.orange, style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
            }
        }
        .mapStyle(.standard(elevation: .realistic))
    }
}

// MARK: - Picker

/// Picks the registry trails a trip walked. With a route it leads with the
/// trails the route follows; otherwise the trails nearest the trip; typing
/// searches every trail by name.
struct TrailPickerView: View {
    let route: [CLLocationCoordinate2D]
    let location: TripLocation?
    let excluded: Set<String>
    let onPick: (TripTrail) -> Void

    @Environment(\.dismiss) private var dismiss
    @AppStorage("speedUnit") private var speedUnit: SpeedUnit = .mph
    @State private var query = ""
    @State private var onRoute: [TrailMatch] = []
    @State private var nearby: [RegistryTrail] = []
    @State private var results: [RegistryTrail] = []
    @State private var state: LoadState = .loading

    private enum LoadState: Equatable { case loading, loaded, failed(String) }

    private var unit: TripDistanceUnit { TripDistanceUnit(speedUnit: speedUnit) }
    private var isSearching: Bool { query.trimmingCharacters(in: .whitespaces).count >= 2 }

    /// Where "nearby" is measured from: the route's start, else the trip's place.
    private var center: CLLocationCoordinate2D? {
        if let start = route.first { return start }
        guard let location else { return nil }
        return CLLocationCoordinate2D(latitude: location.latitude, longitude: location.longitude)
    }

    var body: some View {
        NavigationStack {
            List {
                if case .failed(let message) = state {
                    Text(message).foregroundStyle(.secondary)
                }
                if isSearching {
                    Section {
                        ForEach(results) { trail in
                            row(trail.tripTrail, detail: unit.formatDistance(trail.lengthMeters))
                        }
                    } footer: {
                        if state == .loaded, results.isEmpty {
                            Text("No mapped trail by that name. Trails are mapped in California for now.")
                        }
                    }
                } else {
                    if !onRoute.isEmpty {
                        Section("On Your Route") {
                            ForEach(onRoute) { match in
                                row(match.tripTrail, detail: "\(unit.formatDistance(match.lengthMeters)) · \(match.coverage.formatted(.percent.precision(.fractionLength(0)))) walked")
                            }
                        }
                    }
                    Section {
                        ForEach(nearby.filter { trail in !onRoute.contains { $0.id == trail.id } }) { trail in
                            let away = trail.distanceMeters.map { "\(unit.formatDistance($0)) away" }
                            row(trail.tripTrail, detail: [unit.formatDistance(trail.lengthMeters), away].compactMap { $0 }.joined(separator: " · "))
                        }
                    } header: {
                        Text("Nearby")
                    } footer: {
                        if state == .loaded, nearby.isEmpty, onRoute.isEmpty {
                            Text(center == nil
                                ? "This trip has no place or route. Search for a trail by name."
                                : "No mapped trails near this trip. Trails are mapped in California for now; search by name.")
                        }
                    }
                }
            }
            .overlay {
                if state == .loading { ProgressView() }
            }
            .searchable(text: $query, prompt: "Search trails")
            .navigationTitle("Add Trail")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .task { await loadSuggestions() }
            .task(id: query) { await search() }
        }
        .formSheetSize(minWidth: 480, minHeight: 600)
        .accessibilityIdentifier("trail_picker")
    }

    private func row(_ trail: TripTrail, detail: String) -> some View {
        let taken = excluded.contains(trail.id)
        return Button {
            onPick(trail)
            dismiss()
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "point.bottomleft.forward.to.point.topright.scurvepath")
                    .foregroundStyle(Color.accentColor)
                VStack(alignment: .leading, spacing: 2) {
                    Text(trail.name).foregroundStyle(.primary)
                    Text(detail).font(.caption).foregroundStyle(.secondary).monospacedDigit()
                }
                Spacer()
                Image(systemName: taken ? "checkmark" : "plus.circle")
                    .foregroundStyle(taken ? Color.secondary : Color.accentColor)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(taken)
        .accessibilityHint(taken ? "Already added" : "Adds this trail")
        .accessibilityIdentifier("trail_option_\(trail.id)")
    }

    private func loadSuggestions() async {
        guard KeychainService.shared.sessionToken != nil else {
            state = .failed("Sign in to find mapped trails.")
            return
        }
        state = .loading
        do {
            if route.count >= 2 {
                onRoute = try await TrailRegistryService.shared.match(route: Polyline.encode(route))
            }
            if let center {
                nearby = try await TrailRegistryService.shared.search(near: center)
            }
            state = .loaded
        } catch {
            state = .failed(failureMessage)
        }
    }

    private func search() async {
        guard isSearching, KeychainService.shared.sessionToken != nil else { return }
        try? await Task.sleep(for: .milliseconds(300))
        guard !Task.isCancelled else { return }
        state = .loading
        do {
            results = try await TrailRegistryService.shared.search(query: query.trimmingCharacters(in: .whitespaces))
            state = .loaded
        } catch {
            if !Task.isCancelled { state = .failed(failureMessage) }
        }
    }

    private var failureMessage: String {
        NetworkMonitor.shared.isConnected
            ? "Couldn't load trails right now. Try again in a moment."
            : "You're offline. Try again when you're connected."
    }
}
