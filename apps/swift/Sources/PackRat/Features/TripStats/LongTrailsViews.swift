import MapKit
import SwiftUI

// MARK: - Shared record

extension AppState {
    /// Every long trail against every finished trip's route.
    var longTrailProgress: [LongTrailProgress] {
        let finished = TripStats(trips: tripsVM.trips, packs: []).finished
        return LongTrails.all.map { LongTrailProgress(trail: $0, finished: finished) }
    }

    /// The goal behind following `code`, if the user follows it.
    func followGoal(forTrail code: String) -> TripGoal? {
        tripGoalsVM.goals.first { $0.kind == .longTrail && $0.trailCode == code }
    }
}

// MARK: - Stats screen card

/// The trails a user follows, and any they've walked part of without
/// following, each with a bar of miles done. With neither, one quiet row
/// invites them to follow one.
struct LongTrailsCard: View {
    @Environment(AppState.self) private var appState
    let progress: [LongTrailProgress]
    let unit: TripDistanceUnit
    let onFollow: (String?) -> Void

    private var shown: [LongTrailProgress] {
        progress
            .filter { appState.followGoal(forTrail: $0.trail.code) != nil || $0.hasProgress }
            .sorted { lhs, rhs in
                let lf = appState.followGoal(forTrail: lhs.trail.code) != nil
                let rf = appState.followGoal(forTrail: rhs.trail.code) != nil
                if lf != rf { return lf }
                return lhs.fraction > rhs.fraction
            }
    }

    var body: some View {
        let shown = shown
        StatsCard(title: "Long Trails") {
            if shown.isEmpty {
                Button { onFollow(nil) } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "signpost.right.and.left.fill")
                            .foregroundStyle(Color.accentColor)
                            .frame(width: 32, height: 32)
                            .background(Color.accentColor.opacity(0.12), in: Circle())
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Follow a Long Trail").font(.subheadline.weight(.semibold))
                            Text(LongTrails.all.map(\.name).formatted(.list(type: .or)) + ", walked in sections or all at once.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.leading)
                        }
                        Spacer(minLength: 8)
                        Image(systemName: "plus.circle.fill").font(.title2).foregroundStyle(Color.accentColor)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("trip_stats_follow_trail_empty")
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(shown.enumerated()), id: \.element.id) { index, item in
                        if index > 0 { Divider() }
                        NavigationLink {
                            LongTrailDetailView(code: item.trail.code)
                        } label: {
                            LongTrailRow(
                                progress: item,
                                isFollowed: appState.followGoal(forTrail: item.trail.code) != nil,
                                unit: unit
                            )
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("trip_stats_trail_\(item.trail.code)")
                    }
                }
                if shown.count < LongTrails.all.count {
                    Button { onFollow(nil) } label: {
                        Label("Follow a Trail", systemImage: "plus").font(.subheadline.weight(.semibold))
                    }
                    .buttonStyle(.borderless)
                    .accessibilityIdentifier("trip_stats_follow_trail")
                }
            }
        }
        .accessibilityIdentifier("trip_stats_long_trails_card")
    }
}

private struct LongTrailRow: View {
    let progress: LongTrailProgress
    let isFollowed: Bool
    let unit: TripDistanceUnit

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(progress.trail.name).font(.subheadline.weight(.semibold))
                if !isFollowed {
                    Text("Not followed")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(.quaternary, in: Capsule())
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary)
            }
            ProgressView(value: progress.fraction).tint(Color.accentColor)
            Text(LongTrailFormat.summary(progress, unit: unit))
                .font(.caption)
                .foregroundStyle(.secondary)
                .monospacedDigit()
        }
        .padding(.vertical, 10)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

enum LongTrailFormat {
    /// "212 of 2,650 mi · 8%". A sliver under 1% reads "<1%", never "0%".
    static func summary(_ progress: LongTrailProgress, unit: TripDistanceUnit) -> String {
        let percent = progress.fraction * 100
        let share = percent > 0 && percent < 1 ? "<1%" : "\(Int(percent.rounded(.down)))%"
        return "\(unit.formatDistance(progress.meters).valueOnlyNumber) of \(unit.formatDistance(progress.trail.officialMeters)) · \(share)"
    }
}

private extension String {
    /// "120 mi" → "120": the "of 2,650 mi" that follows carries the unit.
    var valueOnlyNumber: String {
        guard let space = lastIndex(of: " ") else { return self }
        return String(self[..<space])
    }
}

// MARK: - Detail

/// One trail: how much is done, the walked stretches drawn over the whole
/// line, and the trips that walked them. Following it makes it a goal.
struct LongTrailDetailView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext
    @AppStorage("speedUnit") private var speedUnit: SpeedUnit = .mph
    let code: String

    @State private var editingGoal: TripGoal?
    @State private var confirmingUnfollow = false

    private var unit: TripDistanceUnit { TripDistanceUnit(speedUnit: speedUnit) }

    var body: some View {
        let finished = TripStats(trips: appState.tripsVM.trips, packs: []).finished
        let goal = appState.followGoal(forTrail: code)
        List {
            if let trail = LongTrails.trail(code: code) {
                let progress = LongTrailProgress(trail: trail, finished: finished)
                Section {
                    LongTrailMap(progress: progress)
                        .frame(height: 300)
                        .listRowInsets(EdgeInsets())
                }

                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(LongTrailFormat.summary(progress, unit: unit))
                            .font(.headline)
                            .monospacedDigit()
                        ProgressView(value: progress.fraction).tint(Color.accentColor)
                        if let goal, let line = finishLine(goal: goal, finished: finished) {
                            Text(line).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                    .accessibilityElement(children: .combine)
                    .accessibilityIdentifier("long_trail_summary")

                    if goal == nil {
                        Button {
                            editingGoal = followDraft(trail)
                        } label: {
                            Label("Follow This Trail", systemImage: "signpost.right.and.left.fill")
                        }
                        .accessibilityIdentifier("long_trail_follow")
                    }
                }

                Section {
                    if progress.trips.isEmpty {
                        Text("No trips on this trail yet. A trip counts once its log has a route that follows the trail.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(progress.trips.reversed()) { section in
                        Button {
                            appState.selectedTripId = section.trip.id
                            appState.navItem = .trips
                        } label: {
                            TrailTripRow(section: section, unit: unit)
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    Text("Trips on the Trail")
                } footer: {
                    Text("Counted from logged routes. A stretch walked twice counts once. Trail line: \(Self.source(trail.code)).")
                }
            }
        }
        .navigationTitle(LongTrails.trail(code: code)?.name ?? "Long Trail")
        .toolbar {
            if let goal {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button { editingGoal = goal } label: { Label("Set Finish Date", systemImage: "calendar") }
                        Button(role: .destructive) { confirmingUnfollow = true } label: {
                            Label("Stop Following", systemImage: "xmark.circle")
                        }
                    } label: {
                        Label("More", systemImage: "ellipsis.circle")
                    }
                    .accessibilityIdentifier("long_trail_menu")
                }
            }
        }
        .confirmationDialog("Stop following this trail?", isPresented: $confirmingUnfollow, titleVisibility: .visible) {
            Button("Stop Following", role: .destructive) {
                guard let goal else { return }
                Task { await appState.tripGoalsVM.delete(goal, context: modelContext) }
            }
        } message: {
            Text("Your trips still count. Follow it again any time.")
        }
        .sheet(item: $editingGoal) { draft in
            GoalEditorView(
                goal: appState.tripGoalsVM.goals.contains { $0.id == draft.id } ? draft : nil,
                finished: finished,
                unit: unit,
                initialKind: .longTrail,
                initialTrailCode: code
            )
        }
        .accessibilityIdentifier("long_trail_detail")
    }

    /// A placeholder so the editor opens on this trail; it saves as a new goal.
    private func followDraft(_ trail: LongTrail) -> TripGoal {
        TripGoal(id: UUID().uuidString.lowercased(), kind: .longTrail, metric: .distance, target: trail.officialMeters, trailCode: trail.code)
    }

    private func finishLine(goal: TripGoal, finished: [TripStats.FinishedTrip]) -> String? {
        guard let progress = TripGoalProgress(goal: goal, finished: finished, longTrails: appState.longTrailProgress) else { return nil }
        guard let end = progress.end else { return "Following since \(progress.start.formatted(date: .abbreviated, time: .omitted))" }
        let by = "Finish by \(end.formatted(date: .abbreviated, time: .omitted))"
        switch progress.pace {
        case .ahead(let metres): return "\(by) · \(unit.formatDistance(metres)) ahead of pace"
        case .behind(let metres): return "\(by) · \(unit.formatDistance(metres)) behind pace"
        case .onPace: return "\(by) · on pace"
        case nil: return by
        }
    }

    private static func source(_ code: String) -> String {
        switch code {
        case "PCT": return "Pacific Crest Trail Association"
        case "AT": return "National Park Service and Appalachian Trail Conservancy"
        case "CDT": return "US Forest Service"
        default: return "official centerline"
        }
    }
}

private struct TrailTripRow: View {
    let section: LongTrailProgress.TripSection
    let unit: TripDistanceUnit

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(section.trip.trip.name).font(.subheadline.weight(.semibold))
                Text(section.trip.trip.dateRange).font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 2) {
                Text(unit.formatDistance(section.meters)).font(.subheadline).monospacedDigit()
                // Only worth saying when some of it was already walked.
                if section.newMeters + 1 < section.meters {
                    Text(section.newMeters < 1 ? "all walked before" : "\(unit.formatDistance(section.newMeters)) new")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }
            }
            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// The whole trail in a muted line, with the walked stretches drawn over it.
/// Frames the trail on open; a trail is long enough that pan and zoom matter.
private struct LongTrailMap: View {
    let progress: LongTrailProgress

    var body: some View {
        let walked = progress.walkedLines
        Map(initialPosition: .rect(Self.rect(progress.trail)), interactionModes: [.zoom, .pan]) {
            ForEach(Array(progress.trail.lines.enumerated()), id: \.offset) { _, line in
                MapPolyline(coordinates: line)
                    .stroke(Color.secondary.opacity(0.7), style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
            }
            ForEach(Array(walked.enumerated()), id: \.offset) { _, line in
                MapPolyline(coordinates: line)
                    .stroke(Color.orange, style: StrokeStyle(lineWidth: 6, lineCap: .round, lineJoin: .round))
            }
        }
        .mapStyle(.standard(elevation: .realistic, pointsOfInterest: .excludingAll))
        .accessibilityLabel("Map of the \(progress.trail.name), with walked stretches highlighted")
        .accessibilityIdentifier("long_trail_map")
    }

    private static func rect(_ trail: LongTrail) -> MKMapRect {
        let a = MKMapPoint(CLLocationCoordinate2D(latitude: trail.maxLatitude, longitude: trail.minLongitude))
        let b = MKMapPoint(CLLocationCoordinate2D(latitude: trail.minLatitude, longitude: trail.maxLongitude))
        let rect = MKMapRect(x: min(a.x, b.x), y: min(a.y, b.y), width: abs(a.x - b.x), height: abs(a.y - b.y))
        return rect.insetBy(dx: -rect.width * 0.15, dy: -rect.height * 0.08)
    }
}
