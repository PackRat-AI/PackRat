#if os(iOS)
import AppIntents
import SwiftUI

/// Recording the hike and marking places along it, on the trip page while the
/// trip is underway. The same controls voice commands drive.
struct TripTrackingSection: View {
    let trip: Trip
    let viewModel: TripsViewModel

    @Environment(\.modelContext) private var modelContext
    @AppStorage("speedUnit") private var speedUnit: SpeedUnit = .mph
    @State private var recorder = TrackRecorder.shared
    @State private var isMarking = false
    @State private var showingLocationDenied = false
    @State private var confirmingStop = false
    @State private var pendingWaypoint: TripWaypoint?
    @State private var waypointName = ""
    /// Apple's Siri tip, until the user closes it.
    @AppStorage(VoiceCommandSettings.siriTipVisibleKey) private var siriTipVisible = true

    private var unit: TripDistanceUnit { TripDistanceUnit(speedUnit: speedUnit) }
    private var waypoints: [TripWaypoint] { trip.log?.waypoints ?? [] }
    private var track: RecordedTrack? { recorder.track?.tripId == trip.id ? recorder.track : nil }
    /// Another trip's recording is running, so this one can't start.
    private var otherTrack: RecordedTrack? { recorder.track.flatMap { $0.tripId == trip.id ? nil : $0 } }

    static func shows(for trip: Trip) -> Bool {
        guard VoiceCommandSettings.isAvailable else { return false }
        return trip.lifecycle == .inProgress
            || TrackRecorder.shared.isRecording(tripId: trip.id)
            || TripGuide.shared.isGuiding(tripId: trip.id)
            || trip.log?.waypoints.isEmpty == false
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if trip.lifecycle == .inProgress || track != nil {
                trackCard
            }
            if trip.lifecycle == .inProgress, siriTipVisible {
                SiriTipView(intent: TripCommandIntent(action: .whereAmI), isVisible: $siriTipVisible)
                    .accessibilityIdentifier("trip_siri_tip")
            }
            if TripGuidanceCard.shows(for: trip) {
                TripGuidanceCard(trip: trip)
            }
            if !waypoints.isEmpty {
                waypointList
            }
        }
        .padding(.horizontal)
        .alert("Location Is Off for PackRat", isPresented: $showingLocationDenied) {
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Allow location in Settings to record your hike and mark waypoints.")
        }
        .alert("Name This Waypoint", isPresented: Binding(
            get: { pendingWaypoint != nil },
            set: { if !$0 { pendingWaypoint = nil } }
        )) {
            TextField("Name", text: $waypointName)
                .textInputAutocapitalization(.sentences)
                .submitLabel(.done)
            Button("Save") { saveWaypoint(named: waypointName) }
                .keyboardShortcut(.defaultAction)
        }
        .onAppear {
            UITextField.appearance(whenContainedInInstancesOf: [UIAlertController.self]).clearButtonMode = .whileEditing
        }
    }

    // MARK: - Track

    private var trackCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                Image(systemName: statusSymbol)
                    .font(.title3)
                    .foregroundStyle(track == nil ? Color.accentColor : (track?.isPaused == true ? .orange : .red))
                    .symbolEffect(.pulse, isActive: track?.isPaused == false)
                    .frame(width: 36, height: 36)
                    .background(Color.accentColor.opacity(0.12), in: Circle())
                VStack(alignment: .leading, spacing: 2) {
                    Text(statusTitle).font(.headline)
                    Text(statusDetail)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            if let track {
                HStack(spacing: 0) {
                    figure(unit.formatDistance(track.distanceMeters), "Distance")
                    figure(unit.formatElevation(track.elevationGainMeters), "Climbing")
                    figure(Duration.seconds(track.movingSeconds).formatted(.time(pattern: .hourMinute)), "Moving")
                }
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("trip_track_totals")
            }

            VStack(spacing: 10) {
                if let track {
                    HStack(spacing: 10) {
                        Button {
                            track.isPaused ? recorder.resume() : recorder.pause()
                        } label: {
                            Label(track.isPaused ? "Resume" : "Pause", systemImage: track.isPaused ? "play.fill" : "pause.fill")
                                .lineLimit(1)
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .accessibilityIdentifier(track.isPaused ? "trip_track_resume" : "trip_track_pause")
                        Button(role: .destructive) {
                            confirmingStop = true
                        } label: {
                            Label("Stop", systemImage: "stop.fill")
                                .lineLimit(1)
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .accessibilityIdentifier("trip_track_stop")
                        .confirmationDialog("Stop tracking?", isPresented: $confirmingStop, titleVisibility: .visible) {
                            Button("Stop and Save to Trip Log") { stop() }
                            Button("Keep Tracking", role: .cancel) {}
                        } message: {
                            Text("The distance, climbing and route you recorded replace those in this trip's log.")
                        }
                    }
                } else {
                    Button {
                        start()
                    } label: {
                        Label("Start Tracking", systemImage: "record.circle")
                            .lineLimit(1)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(otherTrack != nil)
                    .accessibilityIdentifier("trip_track_start")
                }
                Button {
                    markWaypoint()
                } label: {
                    Group {
                        if isMarking {
                            ProgressView()
                        } else {
                            Label("Mark Waypoint", systemImage: "mappin.and.ellipse").lineLimit(1)
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(isMarking)
                .accessibilityIdentifier("trip_track_mark_waypoint")
            }
            .controlSize(.large)
        }
        .padding(16)
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var statusSymbol: String {
        guard let track else { return "point.topleft.down.to.point.bottomright.curvepath" }
        return track.isPaused ? "pause.circle.fill" : "record.circle"
    }

    private var statusTitle: String {
        guard let track else { return "Record Your Hike" }
        return track.isPaused ? "Tracking Paused" : "Tracking"
    }

    private var statusDetail: String {
        if let otherTrack { return "You're tracking \(otherTrack.tripName). Stop that recording to track this trip." }
        guard let track else { return "Records your distance, climbing and route, with the screen off. Stopping saves it to the trip log." }
        return track.isPaused
            ? "Resume when you set off again. Distance between pause and resume isn't counted."
            : "Keeps recording with the screen off. You can lock your phone."
    }

    private func figure(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.title3.bold()).monospacedDigit().contentTransition(.numericText())
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Waypoints

    private var waypointList: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("WAYPOINTS")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            VStack(spacing: 0) {
                ForEach(waypoints.reversed()) { waypoint in
                    WaypointRow(waypoint: waypoint, unit: unit)
                        .contextMenu {
                            Button("Delete Waypoint", systemImage: "trash", role: .destructive) {
                                Task { await viewModel.removeWaypoint(waypoint.id, from: trip.id, context: modelContext) }
                            }
                        }
                    if waypoint.id != waypoints.first?.id { Divider().padding(.leading, 44) }
                }
            }
            .background(.background.secondary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .accessibilityIdentifier("trip_waypoints")
    }

    // MARK: - Actions

    private func start() {
        Task {
            do {
                try await recorder.start(tripId: trip.id, tripName: trip.name)
            } catch {
                showingLocationDenied = true
            }
        }
    }

    private func stop() {
        guard let finished = recorder.stop() else { return }
        Task { await viewModel.saveRecording(finished, context: modelContext) }
    }

    private func markWaypoint() {
        isMarking = true
        Task {
            defer { isMarking = false }
            let waypoint: TripWaypoint
            if let sample = track?.lastSample, Date().timeIntervalSince(sample.time) < 30 {
                waypoint = .named(nil, latitude: sample.latitude, longitude: sample.longitude, elevation: sample.altitude)
            } else {
                do {
                    let fix = try await SafetyCheckInLocator().currentFix(timeout: .seconds(15))
                    waypoint = .named(nil, latitude: fix.latitude, longitude: fix.longitude, elevation: fix.altitude)
                } catch SafetyCheckInLocator.LocatorError.denied {
                    showingLocationDenied = true
                    return
                } catch {
                    return
                }
            }
            waypointName = waypoint.name
            pendingWaypoint = waypoint
        }
    }

    /// The spot is fixed when Mark Waypoint is tapped, so typing a name
    /// afterwards doesn't move it.
    private func saveWaypoint(named name: String?) {
        guard let marked = pendingWaypoint else { return }
        pendingWaypoint = nil
        let trimmed = name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let waypoint = TripWaypoint.named(
            trimmed.isEmpty ? nil : trimmed,
            latitude: marked.latitude,
            longitude: marked.longitude,
            elevation: marked.elevationMeters,
            at: (try? Date(marked.createdAt, strategy: .iso8601)) ?? Date()
        )
        Task { await viewModel.addWaypoint(waypoint, to: trip.id, context: modelContext) }
    }
}

private struct WaypointRow: View {
    let waypoint: TripWaypoint
    let unit: TripDistanceUnit

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: waypoint.note == nil ? "mappin.circle.fill" : "note.text")
                .font(.title3)
                .foregroundStyle(.orange)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(waypoint.name).font(.body.weight(.medium))
                if let note = waypoint.note, !note.isEmpty {
                    Text(note).font(.subheadline)
                }
                if let detail { Text(detail).font(.caption).foregroundStyle(.secondary).monospacedDigit() }
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .accessibilityElement(children: .combine)
    }

    private var detail: String? {
        var parts: [String] = []
        if let date = try? Date(waypoint.createdAt, strategy: .iso8601) {
            parts.append(date.formatted(date: .omitted, time: .shortened))
        }
        if let elevation = waypoint.elevationMeters { parts.append(unit.formatElevation(elevation)) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}
#endif
