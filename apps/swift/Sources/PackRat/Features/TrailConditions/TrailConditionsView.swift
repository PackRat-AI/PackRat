import SwiftUI

// MARK: - List Column

struct TrailConditionsListView: View {
    @Bindable var viewModel: TrailConditionsViewModel
    @Binding var selectedId: String?
    @Environment(AuthManager.self) private var authManager
    @State private var showingSubmitSheet = false
    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    private var isCompact: Bool { horizontalSizeClass == .compact }
    #else
    private var isCompact: Bool { false }
    #endif

    var body: some View {
        Group {
            if !authManager.isAuthenticated {
                AccountRequiredView(
                    "Sign In to View Trail Reports",
                    subtitle: "Community trail conditions are shared through your PackRat account.",
                    systemImage: "figure.hiking"
                )
            } else if viewModel.isLoading && viewModel.reports.isEmpty {
                ProgressView("Loading reports…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.error, viewModel.reports.isEmpty {
                ErrorView(error, retry: { await viewModel.load() })
            } else if viewModel.reports.isEmpty {
                EmptyStateView(
                    "No Trail Reports",
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
            ToolbarItem(placement: .primaryAction) {
                Button("Submit Report", systemImage: "plus") { showingSubmitSheet = true }
                    .accessibilityIdentifier("trail_conditions_submit_report_button")
                    .disabled(!authManager.isAuthenticated)
            }
        }
        .task { if authManager.isAuthenticated && viewModel.reports.isEmpty { await viewModel.load() } }
        .refreshable { if authManager.isAuthenticated { await viewModel.load() } }
        .sheet(isPresented: $showingSubmitSheet) {
            SubmitTrailConditionView(viewModel: viewModel)
        }
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

    private var reportList: some View {
        List(selection: $selectedId) {
            ForEach(viewModel.filteredReports) { report in
                reportRow(report)
            }
        }
    }
}

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
    @Environment(\.dismiss) private var dismiss

    @State private var trailName = ""
    @State private var trailRegion = ""
    @State private var surface = TrailSurface.dirt.rawValue
    @State private var condition = "good"
    @State private var selectedHazards: Set<String> = []
    @State private var notes = ""
    @State private var isSubmitting = false
    @State private var error: String?

    private let hazardOptions = ["Downed trees", "Muddy sections", "Ice", "High water", "Rock slides", "Wildlife", "Washed out trail"]
    private var isValid: Bool { !trailName.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        NavigationStack {
            Form {
                Section("Trail") {
                    TextField("Trail", text: $trailName)
                        .accessibilityIdentifier("trail_report_name")
                    TextField("Region", text: $trailRegion)
                        .accessibilityIdentifier("trail_report_region")
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
                    }
                }
                Section("Notes") {
                    TextField("Describe conditions in detail…", text: $notes, axis: .vertical)
                        .lineLimit(4, reservesSpace: true)
                        .accessibilityIdentifier("trail_report_notes")
                }
                if let error { Section { InlineErrorView(message: error) } }
            }
            .navigationTitle("Submit Report")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Submit") { submit() }
                        .accessibilityIdentifier("trail_report_submit")
                        .disabled(!isValid || isSubmitting)
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 420, minHeight: 500)
        #endif
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
