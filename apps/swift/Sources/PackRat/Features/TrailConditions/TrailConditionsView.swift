import MapKit
import Sentry
import SwiftUI

// MARK: - List Column

struct TrailConditionsListView: View {
    @Bindable var viewModel: TrailConditionsViewModel
    @Binding var selectedId: String?
    var showsGuestLimitInList = true
    @Environment(AuthManager.self) private var authManager
    @State private var showingSubmitSheet = false
    @State private var moderation = TrailReportModeration.shared
    @State private var actions = TrailReportActions()
    /// Ranks trail search results nearest first, when location is already allowed.
    @State private var searchLocation = TrailReportLocationProvider()
    #if os(iOS)
    /// Drafts captured on the paired watch, waiting for a trail name (#2721).
    @State private var draftStore = WatchTrailDraftStore.shared
    @State private var draftBeingCompleted: WatchTrailDraft?
    #endif
    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    private var isCompact: Bool {
        horizontalSizeClass == .compact && UIDevice.current.userInterfaceIdiom == .phone
    }
    #else
    private var isCompact: Bool { false }
    #endif

    var body: some View {
        Group {
            if !authManager.isAuthenticated {
                if showsGuestLimitInList {
                    GuestLimitedView(
                        "Sign In for Trail Reports",
                        subtitle: "Read what other hikers found on the trail recently, and add your own. Your packs and trips stay on this device and keep working without an account.",
                        systemImage: "figure.hiking"
                    )
                } else {
                    Color.clear
                }
            } else if isSearching {
                // Searching finds trails and places to open, not report text.
                TrailSearchResultsView(query: viewModel.searchText, location: searchLocation)
            } else if viewModel.isLoading && viewModel.reports.isEmpty {
                ProgressView("Loading reports…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.error, viewModel.reports.isEmpty {
                ErrorView(error, retry: { await viewModel.load() })
            } else if visibleReports.isEmpty && !hasWatchDrafts {
                EmptyStateView(
                    "No Trail Reports Yet",
                    subtitle: "Be the first to report conditions on a trail",
                    systemImage: "figure.hiking",
                    actionLabel: "Submit Report",
                    action: { showingSubmitSheet = true }
                )
            } else {
                reportList
            }
        }
        .navigationTitle("Trail Conditions")
        .searchable(text: $viewModel.searchText, prompt: "Search trails and places")
        .toolbar {
            if authManager.isAuthenticated {
                ToolbarItem(placement: .primaryAction) {
                    Button("Submit Report", systemImage: "plus") { showingSubmitSheet = true }
                        .accessibilityIdentifier("trail_conditions_submit_report_button")
                }
            }
        }
        .task { if authManager.isAuthenticated && viewModel.reports.isEmpty { await viewModel.load() } }
        // A queued report that just sent picks up its place in the feed.
        .onChange(of: OutboxService.shared.pendingCount) { old, new in
            guard new < old, !viewModel.pendingIds.isEmpty, authManager.isAuthenticated else { return }
            Task { await viewModel.load() }
        }
        .refreshable { if authManager.isAuthenticated { await viewModel.load() } }
        .sheet(isPresented: $showingSubmitSheet) {
            SubmitTrailConditionView(viewModel: viewModel)
        }
        #if os(iOS)
        // Opened by tapping a watch draft, never presented on arrival — a draft
        // syncing in must not hijack whatever the phone is already showing.
        .sheet(item: $draftBeingCompleted) { draft in
            SubmitTrailConditionView(
                viewModel: viewModel,
                draft: draft,
                onSubmitted: { draftStore.remove(draft.id) }
            )
        }
        #endif
    }

    @ViewBuilder
    private func reportRow(_ report: TrailConditionReport) -> some View {
        Group {
            if isCompact {
                NavigationLink {
                    TrailConditionDetailView(report: report, authorName: viewModel.authorNames[report.id])
                } label: {
                    TrailReportRow(report: report, authorName: viewModel.authorNames[report.id], isWaiting: viewModel.pendingIds.contains(report.id))
                }
            } else {
                TrailReportRow(report: report, authorName: viewModel.authorNames[report.id], isWaiting: viewModel.pendingIds.contains(report.id))
            }
        }
        .tag(report.id)
        .accessibilityIdentifier("trail_report_row_\(report.trailName)")
        .accessibilityLabel(report.trailName)
        .contextMenu {
            TrailReportMenuItems(report: report, authorName: viewModel.authorNames[report.id], actions: actions)
        }
    }

    /// Reports minus any the hiker flagged, deleted, or whose author they blocked.
    private var visibleReports: [TrailConditionReport] {
        viewModel.reports.filter { !moderation.hides($0) }
    }

    private var isSearching: Bool {
        !viewModel.searchText.trimmingCharacters(in: .whitespaces).isEmpty
    }

    /// Whether the paired watch has captures waiting. Always false off iOS,
    /// where there is no paired watch.
    private var hasWatchDrafts: Bool {
        #if os(iOS)
        draftStore.hasDrafts
        #else
        false
        #endif
    }

    private var reportList: some View {
        List(selection: $selectedId) {
            #if os(iOS)
            watchDraftsSection
            #endif
            ForEach(visibleReports) { report in
                reportRow(report)
            }
        }
        .trailReportActionDialogs(actions)
    }

    #if os(iOS)
    /// Watch captures sit above the reports, waiting for a trail.
    @ViewBuilder
    private var watchDraftsSection: some View {
        if draftStore.hasDrafts {
            Section("From Apple Watch") {
                ForEach(draftStore.drafts) { draft in
                    Button {
                        draftBeingCompleted = draft
                    } label: {
                        WatchTrailDraftRow(draft: draft)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("watch_trail_draft_row_\(draft.id)")
                    .accessibilityHint("Choose the trail to finish this report")
                    .swipeActions(edge: .trailing) {
                        Button("Discard", systemImage: "trash", role: .destructive) {
                            draftStore.remove(draft.id)
                        }
                    }
                }
            }
        }
    }
    #endif
}

#if os(iOS)
/// A watch capture awaiting a trail name, shown above the submitted reports.
private struct WatchTrailDraftRow: View {
    let draft: WatchTrailDraft

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "applewatch")
                .font(.title3)
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(TrailConditionLevel(rawValue: draft.condition)?.label ?? draft.condition.capitalized)
                    .font(.body.weight(.medium))
                if !draft.note.isEmpty {
                    Text(draft.note)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Text("Needs a trail")
                    .font(.caption2)
                    .foregroundStyle(.orange)
            }
            Spacer(minLength: 0)
            Text(draft.createdAt, format: .relative(presentation: .numeric))
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .contentShape(Rectangle())
    }
}
#endif

private struct TrailReportRow: View {
    let report: TrailConditionReport
    let authorName: String?
    var isWaiting = false

    var body: some View {
        // Photos go under the words, as review lists do: a thumbnail on only
        // some rows would leave the text starting at different widths.
        VStack(alignment: .leading, spacing: 8) {
            details
            if !report.photos.isEmpty {
                ReportPhotoPreviewRow(photos: report.photos)
            }
        }
        .padding(.vertical, 4)
    }

    /// Scan order for a list: which trail and its verdict, whose word and how
    /// fresh, what could turn you back, then a taste of the account.
    private var details: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .firstTextBaseline) {
                Text(report.trailName).font(.headline)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("trail_report_title_\(report.trailName)")
                Spacer()
                ConditionPill(report: report)
            }
            HStack(spacing: 6) {
                HStack(spacing: 4) {
                    // A pinned report has no trail page to open; say so up front.
                    if report.isPinned {
                        Image(systemName: "mappin")
                            .accessibilityLabel("Dropped pin")
                    }
                    Text(byline)
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                if report.isOlder { OlderPill() }
                if isWaiting { WaitingToSendPill() }
            }
            HazardLine(hazards: report.hazards)
            if let notes = report.notes, !notes.isEmpty {
                Text(notes)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
    }

    private var byline: String {
        [authorName, report.timeAgo].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
    }
}

// MARK: - Detail View

/// One report, ordered by what decides a hike: the evidence (photos), whose
/// word it is and how fresh, the verdict, what could turn you back, the ground
/// underfoot, then the writer's own account. Researched against WTA trip
/// reports and Trailforks condition reports, where age and hazards are what
/// readers look for first.
struct TrailConditionDetailView: View {
    let report: TrailConditionReport
    var authorName: String? = nil
    /// Off on the trail page itself, where a link back to it would loop.
    var showsTrailLink = true

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var actions = TrailReportActions()
    @State private var photoIndex = 0
    @State private var viewerStart: PhotoViewerStart?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if !report.photos.isEmpty {
                    PhotoCarousel(images: report.photos, selection: $photoIndex) { index in
                        viewerStart = PhotoViewerStart(index: index)
                    }
                    .frame(maxHeight: 420)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .accessibilityIdentifier("trail_report_photos")
                }

                header
                verdict
                hazardsSection
                underfootSection
                notesSection
                placeSection
            }
            .padding(.horizontal)
            .padding(.bottom, 32)
        }
        // The trail name is the heading below; repeating it here doubled it.
        .navigationTitle("Report")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(item: $viewerStart) { start in
            PhotoViewer(images: report.photos, selection: start.index)
        }
        #else
        .sheet(item: $viewerStart) { start in
            PhotoViewer(images: report.photos, selection: start.index)
                .frame(minWidth: 640, minHeight: 640)
        }
        #endif
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    TrailReportMenuItems(report: report, authorName: authorName, actions: actions, onHidden: close)
                } label: {
                    Label("More", systemImage: "ellipsis.circle")
                }
                .accessibilityIdentifier("trail_report_more")
            }
        }
        .trailReportActionDialogs(actions, onHidden: close)
        .task(id: report.id) {
            // Opened from anywhere counts as read, so the trip it's on loses its marker.
            await TrailReportUnreadStore.shared.markRead([report.id])
        }
    }

    // MARK: Header

    /// Trail name, then who wrote it and when: a reader judges a report by its
    /// author and its age, so both sit right under the name.
    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                // The name in full: a navigation title truncates long names
                // ("Use trail to Mirror Lake…") with no way to read the rest.
                Text(report.trailName)
                    .font(.title2.bold())
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                if report.isPinned {
                    Label("Dropped pin", systemImage: "mappin")
                        .labelStyle(TightLabelStyle())
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                } else if let region = report.trailRegion, !region.isEmpty {
                    Text(region).font(.subheadline).foregroundStyle(.secondary)
                }
            }

            HStack(spacing: 10) {
                Text(String((authorName ?? "?").prefix(1)).uppercased())
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.tint)
                    .frame(width: 34, height: 34)
                    .background(.tint.opacity(0.14), in: Circle())
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 1) {
                    Text(authorName ?? "A hiker")
                        .font(.subheadline.weight(.semibold))
                    Text([report.timeAgo, report.writtenDateText].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .accessibilityElement(children: .combine)
        }
    }

    // MARK: Verdict

    private var verdict: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 14) {
                Image(systemName: report.conditionSymbol)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(report.conditionTint)
                    .frame(width: 48, height: 48)
                    .background(report.conditionTint.opacity(0.15), in: Circle())
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(report.overallCondition.capitalized)
                        .font(.title3.bold())
                        .foregroundStyle(report.conditionTint)
                    Text(report.conditionMeaning)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            .padding(16)
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("trail_report_verdict")

            // Trail conditions change within days; an old report says so here,
            // next to the verdict it qualifies, not in a footnote.
            if report.isOlder {
                Divider().padding(.leading, 16)
                Label("Written \(report.timeAgo). Conditions may have changed since.", systemImage: "clock.arrow.circlepath")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .accessibilityIdentifier("trail_report_older_notice")
            }
        }
        .background(report.conditionTint.opacity(0.08), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: Hazards

    /// What could turn a hiker back. "None reported" is said outright: it's
    /// information too, and an absent section reads as a missing one.
    private var hazardsSection: some View {
        section("Hazards") {
            if report.hazards.isEmpty {
                Label("None reported", systemImage: "checkmark.shield")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(report.hazards.enumerated()), id: \.offset) { index, hazard in
                        if index > 0 { Divider().padding(.leading, 52) }
                        HStack(spacing: 12) {
                            Image(systemName: HazardStyle.symbol(for: hazard))
                                .font(.callout.weight(.semibold))
                                .foregroundStyle(.orange)
                                .frame(width: 28, height: 28)
                                .background(.orange.opacity(0.14), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                                .accessibilityHidden(true)
                            Text(hazard.capitalized)
                                .font(.body)
                            Spacer(minLength: 0)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                    }
                }
                .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .accessibilityIdentifier("trail_report_hazards")
            }
        }
    }

    // MARK: Underfoot

    private var underfootSection: some View {
        section("On the Trail") {
            HStack(spacing: 10) {
                factTile(
                    symbol: report.surfaceStyle?.symbol ?? "road.lanes",
                    value: report.surfaceStyle?.label ?? (report.surface == "unknown" ? "Not noted" : report.surface.capitalized),
                    caption: "Surface"
                )
                factTile(
                    symbol: "water.waves",
                    value: report.waterCrossings == 0
                        ? "None"
                        : "\(report.waterCrossings) crossing\(report.waterCrossings == 1 ? "" : "s")",
                    caption: report.waterCrossingDifficulty.map { "Water · \($0.capitalized)" } ?? "Water crossings"
                )
            }
        }
    }

    private func factTile(symbol: String, value: String, caption: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: symbol)
                .font(.title3)
                .foregroundStyle(.tint)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(value).font(.headline)
                Text(caption).font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    // MARK: Notes

    /// The writer's own account, set as reading text rather than boxed.
    @ViewBuilder
    private var notesSection: some View {
        if let notes = report.notes, !notes.isEmpty {
            section(authorName.map { "From \($0)" } ?? "Notes") {
                Text(notes)
                    .font(.body)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
                    .accessibilityIdentifier("trail_report_notes")
            }
        }
    }

    // MARK: Place

    @ViewBuilder
    private var placeSection: some View {
        if showsTrailLink, let trailId = report.trailId {
            NavigationLink {
                TrailPageView(trail: TrailSummary(id: trailId, name: report.trailName))
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "figure.hiking")
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(.tint)
                        .frame(width: 32, height: 32)
                        .background(.tint.opacity(0.14), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("All Reports for This Trail").font(.body)
                        Text(report.trailName).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.tertiary)
                }
                .padding(12)
                .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("trail_report_view_trail")
        } else if report.isPinned, let lat = report.latitude, let lon = report.longitude {
            section("Where") {
                Map(initialPosition: .region(MKCoordinateRegion(
                    center: CLLocationCoordinate2D(latitude: lat, longitude: lon),
                    latitudinalMeters: 1_500, longitudinalMeters: 1_500
                ))) {
                    Marker(report.trailName, coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lon))
                }
                .frame(height: 170)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .allowsHitTesting(false)
                .accessibilityLabel("Map of the dropped pin")
                .accessibilityIdentifier("trail_report_pin_map")
            }
        }
    }

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline)
                .accessibilityAddTraits(.isHeader)
            content()
        }
    }

    /// Leaves a report that's gone: pops it on a phone, clears the iPad detail column.
    private func close() {
        if appState.selectedReportId == report.id { appState.selectedReportId = nil }
        dismiss()
    }
}

// MARK: - Submit Form

struct SubmitTrailConditionView: View {
    let viewModel: TrailConditionsViewModel
    /// Called after a successful submit. Used to clear the originating watch
    /// draft only once the report actually exists (#2721).
    private let onSubmitted: (() -> Void)?
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthManager.self) private var authManager

    @State private var place: ReportPlace?
    @State private var location = TrailReportLocationProvider()
    @State private var surface = TrailSurface.dirt.rawValue
    @State private var condition: String
    @State private var selectedHazards: Set<String> = []
    @State private var notes: String
    @State private var photos: [DraftPhoto] = []
    /// "Uploading photo 2 of 3" while photos go up; nil otherwise.
    @State private var uploadProgress: (completed: Int, total: Int)?
    @State private var isSubmitting = false
    @State private var error: String?
    @FocusState private var isInputFocused: Bool
    @State private var showingTrailPicker = false
    /// True when the form opened from a watch capture, so the trail picker can
    /// open immediately — the trail is the one thing the draft cannot carry.
    private let isCompletingWatchDraft: Bool

    /// Reports written from a trip are linked to it.
    private let tripId: String?

    init(viewModel: TrailConditionsViewModel) {
        self.viewModel = viewModel
        self.onSubmitted = nil
        self.isCompletingWatchDraft = false
        self.tripId = nil
        _condition = State(initialValue: "good")
        _notes = State(initialValue: "")
    }

    /// Opens the form with its trail filled in: from a trip (the report is then
    /// linked to it) or from a trail page.
    init(viewModel: TrailConditionsViewModel, tripId: String? = nil, trail: TrailSummary?, onSubmitted: @escaping () -> Void) {
        self.viewModel = viewModel
        self.onSubmitted = onSubmitted
        self.isCompletingWatchDraft = false
        self.tripId = tripId
        _place = State(initialValue: trail.map { .trail($0) })
        _condition = State(initialValue: "good")
        _notes = State(initialValue: "")
    }

    #if os(iOS)
    /// Opens the form pre-filled from a watch capture. The watch supplies the
    /// condition and the note; the trail name is what the user still has to add.
    init(
        viewModel: TrailConditionsViewModel,
        draft: WatchTrailDraft,
        onSubmitted: @escaping () -> Void
    ) {
        self.viewModel = viewModel
        self.onSubmitted = onSubmitted
        self.isCompletingWatchDraft = true
        self.tripId = nil
        _condition = State(
            initialValue: TrailConditionLevel(rawValue: draft.condition)?.rawValue ?? "good"
        )
        _notes = State(initialValue: draft.note)
    }
    #endif

    private let hazardOptions = ["Downed trees", "Muddy sections", "Ice", "High water", "Rock slides", "Wildlife", "Washed out trail"]
    private var isValid: Bool { place != nil }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Button {
                        showingTrailPicker = true
                    } label: {
                        ReportPlaceRow(place: place)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("trail_report_choose_trail")
                } header: {
                    Text("Trail")
                } footer: {
                    if isCompletingWatchDraft {
                        Text("Condition and notes came from your Apple Watch. Choose the trail to submit.")
                    }
                }
                Section("Conditions") {
                    Picker("Overall", selection: $condition) {
                        ForEach(TrailConditionLevel.allCases, id: \.rawValue) { lvl in
                            Text(lvl.label).tag(lvl.rawValue)
                        }
                    }
                    Picker("Surface", selection: $surface) {
                        ForEach(TrailSurface.allCases, id: \.rawValue) { s in
                            Label(s.label, systemImage: s.symbol).tag(s.rawValue)
                        }
                    }
                }
                Section("Hazards") {
                    ForEach(hazardOptions, id: \.self) { hazard in
                        Toggle(hazard, isOn: Binding(
                            get: { selectedHazards.contains(hazard) },
                            set: { on in if on { selectedHazards.insert(hazard) } else { selectedHazards.remove(hazard) } }
                        ))
                        .accessibilityIdentifier("trail_hazard_\(hazard.accessibilitySlug)")
                        .accessibilityLabel(hazard)
                    }
                }
                Section("Notes") {
                    TextField("Describe conditions in detail…", text: $notes, axis: .vertical)
                        .lineLimit(4, reservesSpace: true)
                        .focused($isInputFocused)
                        .accessibilityIdentifier("trail_report_notes")
                }
                ReportPhotoPickerSection(photos: $photos, isLocked: isSubmitting)
                if let uploadProgress {
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Uploading photo \(min(uploadProgress.completed + 1, uploadProgress.total)) of \(uploadProgress.total)…")
                                .font(.callout)
                            ProgressView(value: Double(uploadProgress.completed), total: Double(max(uploadProgress.total, 1)))
                        }
                        .padding(.vertical, 4)
                        .accessibilityIdentifier("trail_report_upload_progress")
                    }
                }
                if let error { Section { InlineErrorView(message: error) } }
            }
            .packRatFormStyle()
            .dismissesKeyboardOnScroll()
            // One keyboard toolbar only — a second `keyboardDoneButton` renders a
            // duplicate "Done". Clears whichever of the two focus flags is set.
            .keyboardDoneButton { isInputFocused = false }
            .navigationTitle(isCompletingWatchDraft ? "Finish Watch Report" : "Submit Report")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .navigationDestination(isPresented: $showingTrailPicker) {
                ReportTrailPickerView(selectedTrailId: place?.trailId, location: location) { picked in
                    place = picked
                    showingTrailPicker = false
                }
            }
            // Fixes early so the picker opens on the nearest trails, and the
            // report records where it was written.
            .task { location.start() }
            // The trail is the only thing a watch capture cannot fill, so go
            // straight to choosing it rather than making the user hunt for it.
            .task { if isCompletingWatchDraft { showingTrailPicker = true } }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Submit") { submit() }
                        .accessibilityIdentifier("trail_report_submit")
                        .disabled(!isValid || isSubmitting)
                }
            }
        }
        .formSheetSize(minWidth: 560, minHeight: 680)
    }

    private func submit() {
        guard let place, !isSubmitting else { return }
        isSubmitting = true
        error = nil
        Task {
            defer {
                isSubmitting = false
                uploadProgress = nil
            }
            // Without signal the photos wait on the device with the report.
            if NetworkMonitor.shared.isConnected {
                do {
                    try await uploadPhotos()
                } catch {
                    SentrySDK.capture(error: error) { scope in
                        scope.setTag(value: "trailConditions", key: "feature")
                        scope.setTag(value: "uploadReportPhotos", key: "action")
                        scope.setExtra(value: photos.count, key: "photoCount")
                    }
                    // A photo the server refuses won't go later either. Any
                    // other failure queues the report with the photos that
                    // didn't make it.
                    if case .terminal = OutboxService.shared.classify(error, operation: .create) {
                        self.error = "Your photos didn't upload. Try again, or remove a photo. Nothing you entered was lost."
                        return
                    }
                }
            }
            do {
                try await viewModel.submitReport(
                    place: place,
                    writtenAt: location.coordinate.map { ($0.latitude, $0.longitude) },
                    surface: surface,
                    overallCondition: condition,
                    hazards: Array(selectedHazards),
                    notes: notes.isEmpty ? nil : notes,
                    photos: photos.map { $0.uploadedKey.map(ReportPhotoInput.uploaded) ?? .local($0.jpeg) },
                    photoOwnerId: authManager.currentUser?.id,
                    tripId: tripId
                )
                // Only now — a draft cleared on a failed submit would lose the
                // capture with nothing to show for it.
                onSubmitted?()
                dismiss()
            } catch { self.error = error.localizedDescription }
        }
    }

    /// Uploads the photos not yet uploaded. Each keeps its key as it lands, so
    /// a retry, or the queue, only sends the rest.
    private func uploadPhotos() async throws {
        let pending = photos.filter { $0.uploadedKey == nil }
        guard !pending.isEmpty else { return }
        guard let userId = authManager.currentUser?.id else { throw PackRatError.unauthorized }
        var completed = photos.count - pending.count
        uploadProgress = (completed, photos.count)
        try await withThrowingTaskGroup(of: (UUID, String).self) { group in
            for photo in pending {
                let id = photo.id
                let jpeg = photo.jpeg
                group.addTask {
                    // The presign route requires keys to start with `{userId}-`.
                    let key = try await UploadService.shared.upload(
                        data: jpeg,
                        fileName: "\(userId)-\(UUID().uuidString).jpg",
                        mimeType: "image/jpeg"
                    )
                    return (id, key)
                }
            }
            for try await (id, key) in group {
                if let index = photos.firstIndex(where: { $0.id == id }) {
                    photos[index].uploadedKey = key
                }
                completed += 1
                uploadProgress = (completed, photos.count)
            }
        }
    }
}

/// The form's trail row: what the report is about, or a prompt to choose.
private struct ReportPlaceRow: View {
    let place: ReportPlace?

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .foregroundStyle(place == nil ? Color.secondary : Color.accentColor)
                .frame(width: 24)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(place?.displayName ?? "Choose Trail")
                    .foregroundStyle(place == nil ? Color.accentColor : Color.primary)
                if let detail {
                    Text(detail).font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
                .accessibilityHidden(true)
        }
        .contentShape(Rectangle())
    }

    private var symbol: String {
        switch place {
        case .pin: "mappin.and.ellipse"
        case .trail: "figure.hiking"
        case nil: "magnifyingglass"
        }
    }

    private var detail: String? {
        switch place {
        case .trail(let trail): trail.lengthM > 0 ? trail.lengthText : nil
        case .pin: "Pinned location"
        case nil: nil
        }
    }
}

private extension String {
    var accessibilitySlug: String {
        lowercased()
            .replacingOccurrences(of: " ", with: "_")
            .filter { $0.isLetter || $0.isNumber || $0 == "_" }
    }
}

// MARK: - Flow Layout helper

/// Lays chips out left to right, wrapping onto new lines, each at its own
/// width. (A LazyVGrid with adaptive columns centred every chip in a fixed
/// cell, so a short chip like "Ice" sat indented from the section edge.)
struct FlowLayout<Data: RandomAccessCollection, Content: View>: View where Data.Element: Hashable {
    let data: Data
    let content: (Data.Element) -> Content

    init(_ data: Data, @ViewBuilder content: @escaping (Data.Element) -> Content) {
        self.data = data
        self.content = content
    }

    var body: some View {
        WrappingStack(spacing: 6) {
            ForEach(Array(data), id: \.self) { item in
                content(item)
            }
        }
    }
}

private struct WrappingStack: Layout {
    var spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(subviews, width: proposal.width ?? .infinity)
        let width = rows.map(\.width).max() ?? 0
        let height = rows.map(\.height).reduce(0, +) + spacing * CGFloat(max(rows.count - 1, 0))
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in arrange(subviews, width: bounds.width) {
            var x = bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row {
        var indices: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func arrange(_ subviews: Subviews, width maxWidth: CGFloat) -> [Row] {
        var rows: [Row] = []
        var row = Row()
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let needed = row.indices.isEmpty ? size.width : row.width + spacing + size.width
            if needed > maxWidth, !row.indices.isEmpty {
                rows.append(row)
                row = Row()
            }
            row.width = row.indices.isEmpty ? size.width : row.width + spacing + size.width
            row.height = max(row.height, size.height)
            row.indices.append(index)
        }
        if !row.indices.isEmpty { rows.append(row) }
        return rows
    }
}
