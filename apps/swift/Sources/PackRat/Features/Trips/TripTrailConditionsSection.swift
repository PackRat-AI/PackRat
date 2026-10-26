import SwiftUI

/// What hikers are finding on the trip's trail, or on trails near its
/// destination when the trip names none. Part of the trip, never an alert.
/// Shows nothing for a trip with no destination: there's no place to have
/// conditions about.
struct TripTrailConditionsSection: View {
    let trip: Trip

    @Environment(AppState.self) private var appState
    @Environment(AuthManager.self) private var authManager
    @State private var response: TripConditionsResponse?
    @State private var loadFailed = false
    @State private var showingSubmit = false
    @State private var moderation = TrailReportModeration.shared
    @State private var actions = TrailReportActions()
    /// The report a notification tap asked for, pushed over the trip.
    @State private var linkedReport: TripConditionReport?

    private let service = TrailConditionsService.shared

    /// Reports past this age are still shown, dated, and marked as older.
    static let recentWindow: TimeInterval = 14 * 86_400

    private var hasPlace: Bool {
        trip.trailId != nil || trip.location.map { $0.latitude != 0 || $0.longitude != 0 } == true
    }

    /// Reloads when the trip's trail or destination changes.
    private var loadKey: String {
        "\(trip.id)|\(trip.trailId ?? "-")|\(trip.location?.latitude ?? 0),\(trip.location?.longitude ?? 0)"
    }

    var body: some View {
        if NavItem.trailConditions.isFeatureEnabled, authManager.isAuthenticated, hasPlace {
            VStack(alignment: .leading, spacing: 8) {
                header
                content
            }
            .padding(.horizontal)
            .trailReportActionDialogs(actions)
            .task(id: loadKey) { await load() }
            .onChange(of: appState.pendingTrailReport?.reportId) { _, _ in openLinkedReport() }
            .navigationDestination(isPresented: Binding(
                get: { linkedReport != nil },
                set: { if !$0 { linkedReport = nil } }
            )) {
                if let item = linkedReport {
                    TrailConditionDetailView(report: item.report, authorName: item.authorName)
                }
            }
            .sheet(isPresented: $showingSubmit) {
                SubmitTrailConditionView(
                    viewModel: appState.trailConditionsVM,
                    tripId: trip.id,
                    trail: trip.trailId.map { TrailSummary(id: $0, name: trip.trailName ?? "Trail") },
                    onSubmitted: { Task { await load() } }
                )
            }
        }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text("TRAIL CONDITIONS")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                if let subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
            Spacer()
            // Always there: reporting never waits on, or depends on, loading others' reports.
            Button("Report", systemImage: "plus") { showingSubmit = true }
                .font(.caption.weight(.semibold))
                .buttonStyle(.borderless)
                .accessibilityIdentifier("trip_trail_conditions_report")
        }
    }

    private var subtitle: String? {
        if let name = trip.trailName, trip.trailId != nil { return name }
        if let place = trip.location?.name, !place.isEmpty { return "Trails near \(place)" }
        return nil
    }

    @ViewBuilder
    private var content: some View {
        if let response {
            let reports = response.reports.filter { !moderation.hides($0.report) }
            if reports.isEmpty {
                emptyCard
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(reports.enumerated()), id: \.element.id) { index, item in
                        if index > 0 { Divider().padding(.leading, 44) }
                        NavigationLink {
                            TrailConditionDetailView(report: item.report, authorName: item.authorName)
                        } label: {
                            TripConditionRow(item: item, showsTrail: response.scope == .nearby)
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            TrailReportMenuItems(report: item.report, authorName: item.authorName, actions: actions)
                        }
                        .accessibilityIdentifier("trip_trail_condition_\(item.id)")
                    }
                }
                .padding(.vertical, 4)
                .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        } else if loadFailed {
            HStack {
                Text("Couldn't load trail conditions.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                Spacer()
                Button("Try Again") { Task { await load() } }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
            }
            .padding(14)
            .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        } else {
            HStack(spacing: 10) {
                ProgressView()
                Text("Checking recent reports…").font(.callout).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    private var emptyCard: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "figure.hiking")
                .font(.title3)
                .foregroundStyle(.tint)
                .frame(width: 32, height: 32)
                .background(.tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 6) {
                Text("No reports yet")
                    .font(.callout.weight(.semibold))
                Text(trip.trailId != nil
                     ? "Nobody has reported on this trail. Be the first once you're out there."
                     : "No reports from trails near here. Be the first once you're out there.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Button("Write a Report") { showingSubmit = true }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .padding(.top, 2)
                    .accessibilityIdentifier("trip_trail_conditions_first_report")
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func load() async {
        do {
            let fresh = try await service.tripConditions(tripId: trip.id)
            guard !Task.isCancelled else { return }
            response = fresh
            loadFailed = false
            openLinkedReport()
            // Seen now, so read: the "New" labels stay for this visit only.
            await TrailReportUnreadStore.shared.markRead(
                fresh.reports.filter(\.unread).map(\.id),
                onTrip: trip.id
            )
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled else { return }
            // Keep what's on screen; only an empty section turns into an error.
            if response == nil { loadFailed = true }
        }
    }

    /// Opens the report a notification tap named, once it's among this trip's
    /// reports. A report no longer shown (hidden, removed) leaves the trip open.
    private func openLinkedReport() {
        guard let link = appState.pendingTrailReport, link.tripId == trip.id,
              let item = response?.reports.first(where: { $0.id == link.reportId })
        else { return }
        appState.pendingTrailReport = nil
        guard !moderation.hides(item.report) else { return }
        linkedReport = item
    }
}

struct TripConditionRow: View {
    let item: TripConditionReport
    /// Nearby reports name their trail so the hiker can tell theirs from its neighbours.
    let showsTrail: Bool

    private var report: TrailConditionReport { item.report }

    private var isOlder: Bool { report.isOlder }

    private var color: Color { report.conditionTint }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: report.conditionSymbol)
                .font(.body.weight(.semibold))
                .foregroundStyle(color)
                .frame(width: 32, height: 32)
                .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                // The trail name gets its own line and wraps: truncated, two
                // neighbouring trails with long names were indistinguishable.
                if showsTrail {
                    Text(report.trailName)
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(.primary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                HStack(spacing: 6) {
                    Text(report.overallCondition.capitalized)
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(color)
                    if item.unread { NewReportPill() }
                    if isOlder { OlderPill() }
                }
                Text(byline)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                HazardLine(hazards: report.hazards)
                if let notes = report.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                if !report.photos.isEmpty {
                    ReportPhotoPreviewRow(photos: report.photos, size: 56)
                        .padding(.top, 5)
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
                .padding(.top, 8)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }

    private var byline: String {
        var parts: [String] = []
        if let author = item.authorName { parts.append(author) }
        parts.append(report.timeAgo)
        if showsTrail, let d = item.distanceM {
            let away = Measurement(value: Double(d), unit: UnitLength.meters)
                .formatted(.measurement(width: .abbreviated, usage: .road))
            parts.append("\(away) away")
        }
        return parts.joined(separator: " · ")
    }
}
