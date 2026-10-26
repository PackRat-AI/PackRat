import MapKit
import SwiftUI

/// Everything known about one trail's conditions: what it's like now first,
/// the history underneath. Reports that disagree are both shown; PackRat never
/// averages them into one verdict. A trail nobody has reported on still has a
/// page, inviting the first report.
struct TrailPageView: View {
    let trail: TrailSummary

    @Environment(AppState.self) private var appState
    @State private var detail: TrailDetail?
    @State private var reports: [TripConditionReport]?
    @State private var loadFailed = false
    @State private var showingSubmit = false
    @State private var showingNewTrip = false
    @State private var moderation = TrailReportModeration.shared
    @State private var reportActions = TrailReportActions()

    private let service = TrailConditionsService.shared

    /// The trail as the page knows it best: the detail once loaded (it carries
    /// the centre a new trip needs), the summary it was opened with until then.
    private var bestSummary: TrailSummary { detail?.summary ?? trail }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let detail, !detail.lines.isEmpty {
                    TrailLineMap(lines: detail.lines)
                        .frame(height: 200)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .accessibilityLabel("Map of \(trail.name)")
                }
                header
                actions
                content
            }
            .padding()
        }
        .navigationTitle("Trail")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .trailReportActionDialogs(reportActions)
        .task(id: trail.id) { await load() }
        .refreshable { await load() }
        .sheet(isPresented: $showingSubmit) {
            SubmitTrailConditionView(
                viewModel: appState.trailConditionsVM,
                trail: bestSummary,
                onSubmitted: { Task { await load() } }
            )
        }
        .sheet(isPresented: $showingNewTrip) {
            TripFormView(viewModel: appState.tripsVM, startingTrail: bestSummary)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(trail.name)
                .font(.title.bold())
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            if let subtitle {
                Text(subtitle)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var subtitle: String? {
        var parts: [String] = []
        if bestSummary.lengthM > 0 { parts.append(bestSummary.lengthText) }
        if let count = visibleReports?.count, count > 0 {
            parts.append(count == 1 ? "1 report" : "\(count) reports")
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// Reports minus any the hiker flagged or whose author they blocked.
    private var visibleReports: [TripConditionReport]? {
        reports?.filter { !moderation.hides($0.report) }
    }

    private var actions: some View {
        HStack(spacing: 10) {
            Button {
                showingSubmit = true
            } label: {
                Label("Write a Report", systemImage: "square.and.pencil")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("trail_page_write_report")
            Button {
                showingNewTrip = true
            } label: {
                Label("Plan a Trip", systemImage: "map")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .accessibilityIdentifier("trail_page_plan_trip")
        }
        .controlSize(.large)
    }

    @ViewBuilder
    private var content: some View {
        if let reports = visibleReports {
            if let latest = reports.first {
                sectionTitle("Latest")
                NavigationLink {
                    TrailConditionDetailView(report: latest.report, authorName: latest.authorName, showsTrailLink: false)
                } label: {
                    LatestReportCard(item: latest)
                }
                .buttonStyle(.plain)
                .contextMenu {
                    TrailReportMenuItems(report: latest.report, authorName: latest.authorName, actions: reportActions)
                }
                .accessibilityIdentifier("trail_page_latest_report")

                let earlier = reports.dropFirst()
                if !earlier.isEmpty {
                    sectionTitle("Earlier")
                    VStack(spacing: 0) {
                        ForEach(Array(earlier.enumerated()), id: \.element.id) { index, item in
                            if index > 0 { Divider().padding(.leading, 56) }
                            NavigationLink {
                                TrailConditionDetailView(report: item.report, authorName: item.authorName, showsTrailLink: false)
                            } label: {
                                TripConditionRow(item: item, showsTrail: false)
                            }
                            .buttonStyle(.plain)
                            .contextMenu {
                                TrailReportMenuItems(report: item.report, authorName: item.authorName, actions: reportActions)
                            }
                            .accessibilityIdentifier("trail_page_report_\(item.id)")
                        }
                    }
                    .padding(.vertical, 4)
                    .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            } else {
                firstReportInvitation
            }
        } else if loadFailed {
            HStack {
                Text("Couldn't load reports for this trail.")
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
                Text("Loading reports…").font(.callout).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
        }
    }

    private var firstReportInvitation: some View {
        VStack(spacing: 10) {
            Image(systemName: "figure.hiking")
                .font(.title)
                .foregroundStyle(.tint)
                .frame(width: 56, height: 56)
                .background(.tint.opacity(0.12), in: Circle())
                .accessibilityHidden(true)
            Text("No reports yet")
                .font(.headline)
            Text("Nobody has reported on this trail. If you've been out on it, tell the next hiker what to expect.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityIdentifier("trail_page_no_reports")
    }

    private func sectionTitle(_ title: String) -> some View {
        Text(title.uppercased())
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .padding(.bottom, -12)
    }

    private func load() async {
        // Reports come from the main database and the line from the trail
        // database; one failing must not blank the other.
        async let reportsTask = service.trailReports(trailId: trail.id)
        async let detailTask = service.trail(id: trail.id)
        do {
            let fresh = try await reportsTask
            guard !Task.isCancelled else { return }
            reports = fresh
            loadFailed = false
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled else { return }
            // Keep what's on screen; only an empty page turns into an error.
            if reports == nil { loadFailed = true }
        }
        if let fresh = try? await detailTask, !Task.isCancelled {
            detail = fresh
        }
    }
}

// MARK: - Latest report

/// The answer to "what is it like now": the newest report, in full.
private struct LatestReportCard: View {
    let item: TripConditionReport

    private var report: TrailConditionReport { item.report }

    private var isOlder: Bool { report.isOlder }

    private var color: Color { report.conditionTint }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: report.conditionSymbol)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(color)
                    .frame(width: 48, height: 48)
                    .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(report.overallCondition.capitalized)
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(color)
                        if isOlder { OlderPill() }
                    }
                    Text(byline)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
                    .accessibilityHidden(true)
            }

            if !report.hazards.isEmpty {
                FlowLayout(report.hazards) { hazard in
                    Label(hazard.capitalized, systemImage: HazardStyle.symbol(for: hazard))
                        .labelStyle(TightLabelStyle())
                        .font(.caption.weight(.medium))
                        .padding(.horizontal, 10).padding(.vertical, 4)
                        .background(.orange.opacity(0.12), in: Capsule())
                        .foregroundStyle(.orange)
                }
            }

            if let notes = report.notes, !notes.isEmpty {
                Text(notes)
                    .font(.callout)
                    .foregroundStyle(.primary)
                    .lineLimit(6)
                    .fixedSize(horizontal: false, vertical: true)
            }

            // Part of the link to the report, which is where they open full screen.
            if !report.photos.isEmpty {
                ReportPhotoStrip(photos: report.photos, size: 88, opensViewer: false)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .contentShape(Rectangle())
    }

    private var byline: String {
        var parts: [String] = []
        if let author = item.authorName { parts.append(author) }
        parts.append(report.timeAgo)
        if let surface = TrailSurface(rawValue: report.surface) { parts.append(surface.label) }
        return parts.joined(separator: " · ")
    }
}

// MARK: - Map

/// The trail's line on a map, framed to fit. Not interactive: it shows which
/// trail this is, it isn't for navigating.
private struct TrailLineMap: View {
    let lines: [[[Double]]]

    private var coordinates: [[CLLocationCoordinate2D]] {
        lines.map { line in
            line.compactMap { pair in
                pair.count >= 2 ? CLLocationCoordinate2D(latitude: pair[1], longitude: pair[0]) : nil
            }
        }
    }

    private var region: MKCoordinateRegion? {
        let all = coordinates.flatMap { $0 }
        guard let first = all.first else { return nil }
        var minLat = first.latitude, maxLat = first.latitude
        var minLon = first.longitude, maxLon = first.longitude
        for c in all {
            minLat = min(minLat, c.latitude); maxLat = max(maxLat, c.latitude)
            minLon = min(minLon, c.longitude); maxLon = max(maxLon, c.longitude)
        }
        // Padding so the line doesn't touch the edges; a floor so a short
        // trail isn't zoomed in to a few metres.
        let latSpan = max((maxLat - minLat) * 1.4, 0.01)
        let lonSpan = max((maxLon - minLon) * 1.4, 0.01)
        return MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2, longitude: (minLon + maxLon) / 2),
            span: MKCoordinateSpan(latitudeDelta: latSpan, longitudeDelta: lonSpan)
        )
    }

    var body: some View {
        Map(initialPosition: region.map { .region($0) } ?? .automatic, interactionModes: []) {
            ForEach(Array(coordinates.enumerated()), id: \.offset) { _, line in
                MapPolyline(coordinates: line)
                    .stroke(.orange, style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
            }
        }
        .mapStyle(.standard(elevation: .realistic, pointsOfInterest: .excludingAll))
    }
}
