import SwiftUI

// MARK: - List Column

struct TrailConditionsListView: View {
    @Bindable var viewModel: TrailConditionsViewModel
    @Binding var selectedId: String?
    var showsGuestLimitInList = true
    @Environment(AuthManager.self) private var authManager
    @State private var showingSubmitSheet = false
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
                        "Trail Reports Require an Account",
                        subtitle: "Community trail conditions are shared through your PackRat account.",
                        systemImage: "figure.hiking"
                    )
                } else {
                    Color.clear
                }
            } else if viewModel.isLoading && viewModel.reports.isEmpty {
                ProgressView("Loading reports…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.error, viewModel.reports.isEmpty {
                ErrorView(error, retry: { await viewModel.load() })
            } else if viewModel.reports.isEmpty && !hasWatchDrafts {
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
        .searchable(text: $viewModel.searchText, prompt: "Search trails")
        .toolbar {
            if authManager.isAuthenticated {
                ToolbarItem(placement: .primaryAction) {
                    Button("Submit Report", systemImage: "plus") { showingSubmitSheet = true }
                        .accessibilityIdentifier("trail_conditions_submit_report_button")
                }
            }
        }
        .task { if authManager.isAuthenticated && viewModel.reports.isEmpty { await viewModel.load() } }
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
                    TrailConditionDetailView(report: report)
                } label: {
                    TrailReportRow(report: report)
                }
            } else {
                TrailReportRow(report: report)
            }
        }
        .tag(report.id)
        .accessibilityIdentifier("trail_report_row_\(report.trailName)")
        .accessibilityLabel(report.trailName)
        .contextMenu {
            Button("Delete", systemImage: "trash", role: .destructive) {
                Task { try? await viewModel.deleteReport(report.id) }
            }
        }
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
            ForEach(viewModel.filteredReports) { report in
                reportRow(report)
            }
        }
    }

    #if os(iOS)
    /// Watch captures sit above the reports, and outside the search filter —
    /// they carry no trail name to match on yet, so filtering them would make
    /// them vanish the moment someone typed in the search field.
    @ViewBuilder
    private var watchDraftsSection: some View {
        if draftStore.hasDrafts && viewModel.searchText.isEmpty {
            Section("From Apple Watch") {
                ForEach(draftStore.drafts) { draft in
                    Button {
                        draftBeingCompleted = draft
                    } label: {
                        WatchTrailDraftRow(draft: draft)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("watch_trail_draft_row_\(draft.id)")
                    .accessibilityHint("Add a trail name to finish this report")
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
                Text("Needs a trail name")
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

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(report.trailName).font(.headline)
                    .accessibilityIdentifier("trail_report_title_\(report.trailName)")
                Spacer()
                conditionBadge
            }
            HStack(spacing: 8) {
                if let region = report.trailRegion {
                    Label(region, systemImage: "mappin").font(.caption).foregroundStyle(.secondary)
                }
                Text(report.timeAgo).font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }

    private var conditionBadge: some View {
        Label(
            report.overallCondition.capitalized,
            systemImage: report.conditionSymbol
        )
        .font(.caption.bold())
        .foregroundStyle(conditionColor)
        .padding(.horizontal, 8).padding(.vertical, 3)
        .background(conditionColor.opacity(0.12), in: Capsule())
    }

    private var conditionColor: Color {
        switch report.overallCondition {
        case "excellent": return .green
        case "good":      return .blue
        case "fair":      return .orange
        case "poor":      return .red
        default:          return .secondary
        }
    }
}

// MARK: - Detail View

struct TrailConditionDetailView: View {
    let report: TrailConditionReport

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Condition header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        if let region = report.trailRegion {
                            Label(region, systemImage: "mappin")
                                .font(.callout).foregroundStyle(.secondary)
                        }
                        Text(report.timeAgo).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    conditionCard
                }
                .padding(.horizontal)

                if !report.surface.isEmpty {
                    labeledSection("Surface") {
                        Label(report.surface.capitalized, systemImage: TrailSurface(rawValue: report.surface)?.symbol ?? "road.lanes")
                            .font(.callout)
                    }
                }

                if report.waterCrossings > 0 {
                    labeledSection("Water Crossings") {
                        HStack {
                            Text("\(report.waterCrossings) crossing\(report.waterCrossings == 1 ? "" : "s")")
                            if let diff = report.waterCrossingDifficulty {
                                Text("· \(diff.capitalized)").foregroundStyle(.secondary)
                            }
                        }
                        .font(.callout)
                    }
                }

                if !report.hazards.isEmpty {
                    labeledSection("Hazards") {
                        FlowLayout(report.hazards) { hazard in
                            Text(hazard.capitalized)
                                .font(.caption)
                                .padding(.horizontal, 10).padding(.vertical, 4)
                                .background(.orange.opacity(0.12), in: Capsule())
                                .foregroundStyle(.orange)
                        }
                    }
                }

                if let notes = report.notes, !notes.isEmpty {
                    labeledSection("Notes") {
                        Text(notes)
                            .font(.body)
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(.fill.secondary, in: RoundedRectangle(cornerRadius: 10))
                    }
                }
            }
            .padding(.bottom)
        }
        .navigationTitle(report.trailName)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.large)
        #endif
    }

    private var conditionCard: some View {
        let color: Color = switch report.overallCondition {
        case "excellent": .green
        case "good": .blue
        case "fair": .orange
        default: .red
        }
        return VStack(spacing: 4) {
            Image(systemName: report.conditionSymbol)
                .font(.title2)
                .foregroundStyle(color)
            Text(report.overallCondition.capitalized)
                .font(.caption.bold())
                .foregroundStyle(color)
        }
        .padding(14)
        .background(color.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
    }

    private func labeledSection(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.caption.uppercaseSmallCaps()).foregroundStyle(.secondary)
            content()
        }
        .padding(.horizontal)
    }
}

// MARK: - Submit Form

struct SubmitTrailConditionView: View {
    let viewModel: TrailConditionsViewModel
    /// Called after a successful submit. Used to clear the originating watch
    /// draft only once the report actually exists (#2721).
    private let onSubmitted: (() -> Void)?
    @Environment(\.dismiss) private var dismiss

    @State private var trailName = ""
    @State private var trailRegion = ""
    @State private var surface = TrailSurface.dirt.rawValue
    @State private var condition: String
    @State private var selectedHazards: Set<String> = []
    @State private var notes: String
    @State private var isSubmitting = false
    @State private var error: String?
    @FocusState private var isInputFocused: Bool
    /// True when the form opened from a watch capture, so the trail field can
    /// take focus immediately — it is the one thing the draft cannot carry.
    private let isCompletingWatchDraft: Bool

    init(viewModel: TrailConditionsViewModel) {
        self.viewModel = viewModel
        self.onSubmitted = nil
        self.isCompletingWatchDraft = false
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
        _condition = State(
            initialValue: TrailConditionLevel(rawValue: draft.condition)?.rawValue ?? "good"
        )
        _notes = State(initialValue: draft.note)
    }
    #endif

    private let hazardOptions = ["Downed trees", "Muddy sections", "Ice", "High water", "Rock slides", "Wildlife", "Washed out trail"]
    private var isValid: Bool { !trailName.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Trail", text: $trailName)
                        .focused($isInputFocused)
                        .submitLabel(.done)
                        .onSubmit { isInputFocused = false }
                        .accessibilityIdentifier("trail_report_name")
                    TextField("Region", text: $trailRegion)
                        .focused($isInputFocused)
                        .submitLabel(.done)
                        .onSubmit { isInputFocused = false }
                        .accessibilityIdentifier("trail_report_region")
                } header: {
                    Text("Trail")
                } footer: {
                    if isCompletingWatchDraft {
                        Text("Condition and notes came from your Apple Watch. Add the trail name to submit.")
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
                if let error { Section { InlineErrorView(message: error) } }
            }
            .packRatFormStyle()
            .dismissesKeyboardOnScroll()
            .keyboardDoneButton(isFocused: $isInputFocused)
            .navigationTitle(isCompletingWatchDraft ? "Finish Watch Report" : "Submit Report")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            // The trail name is the only field a watch capture cannot fill, so
            // put the cursor there rather than making the user hunt for it.
            .task { if isCompletingWatchDraft { isInputFocused = true } }
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
        guard isValid, !isSubmitting else { return }
        isSubmitting = true
        error = nil
        Task {
            defer { isSubmitting = false }
            do {
                try await viewModel.submitReport(
                    trailName: trailName,
                    trailRegion: trailRegion.isEmpty ? nil : trailRegion,
                    surface: surface,
                    overallCondition: condition,
                    hazards: Array(selectedHazards),
                    notes: notes.isEmpty ? nil : notes
                )
                // Only now — a draft cleared on a failed submit would lose the
                // capture with nothing to show for it.
                onSubmitted?()
                dismiss()
            } catch { self.error = error.localizedDescription }
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

struct FlowLayout<Data: RandomAccessCollection, Content: View>: View where Data.Element: Hashable {
    let data: Data
    let content: (Data.Element) -> Content

    init(_ data: Data, @ViewBuilder content: @escaping (Data.Element) -> Content) {
        self.data = data
        self.content = content
    }

    var body: some View {
        // Simple wrapping HStack approximation
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 100), spacing: 6)], spacing: 6) {
            ForEach(Array(data), id: \.self) { item in
                content(item)
            }
        }
    }
}
