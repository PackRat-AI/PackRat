import SwiftUI
import Charts

// MARK: - List Column (shown in content pane of 3-column nav)

struct PackTemplatesListView: View {
    @Bindable var viewModel: PackTemplatesViewModel
    @Binding var selectedId: String?
    var packsVM: PacksViewModel = PacksViewModel()
    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    private var isCompact: Bool { horizontalSizeClass == .compact }
    #else
    private var isCompact: Bool { false }
    #endif

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.templates.isEmpty {
                ProgressView("Loading templates…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.error, viewModel.templates.isEmpty {
                ErrorView(error, retry: { await viewModel.load() })
            } else if viewModel.templates.isEmpty {
                EmptyStateView(
                    "No Templates",
                    subtitle: "Templates let you quickly populate a pack with a standard gear list",
                    systemImage: "doc.on.doc"
                )
            } else {
                templateList
            }
        }
        .navigationTitle("Pack Templates")
        .searchable(text: $viewModel.searchText, prompt: "Search templates")
        .task { if viewModel.templates.isEmpty { await viewModel.load() } }
        .refreshable { await viewModel.load() }
    }

    private var templateList: some View {
        List(selection: $selectedId) {
            if !viewModel.officialTemplates.isEmpty {
                Section("Official") {
                    ForEach(viewModel.officialTemplates) { t in
                        templateRow(t)
                    }
                }
            }
            if !viewModel.myTemplates.isEmpty {
                Section("Mine") {
                    ForEach(viewModel.myTemplates) { t in
                        templateRow(t)
                            .contextMenu {
                                Button("Delete", systemImage: "trash", role: .destructive) {
                                    Task { try? await viewModel.deleteTemplate(t.id) }
                                }
                            }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func templateRow(_ template: PackTemplate) -> some View {
        Group {
            if isCompact {
                NavigationLink {
                    PackTemplateDetailView(template: template, viewModel: viewModel, packsVM: packsVM)
                } label: {
                    TemplateRowView(template: template)
                }
            } else {
                TemplateRowView(template: template)
            }
        }
        .tag(template.id)
    }
}

private struct TemplateRowView: View {
    let template: PackTemplate

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(template.name).font(.headline)
                if template.isOfficial {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.caption)
                        .foregroundStyle(.tint)
                }
                Spacer()
                Text("\(template.itemCount) items")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let desc = template.description {
                Text(desc).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            if let cat = template.category {
                Label(cat.capitalized, systemImage: PackCategory(rawValue: cat)?.symbol ?? "backpack")
                    .font(.caption2).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Detail View

struct PackTemplateDetailView: View {
    let template: PackTemplate
    let viewModel: PackTemplatesViewModel
    let packsVM: PacksViewModel

    @State private var showingApplySheet = false
    @State private var applyError: String?
    @State private var applySuccess = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header info
                if let desc = template.description {
                    Text(desc)
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal)
                }

                HStack(spacing: 10) {
                    if let cat = template.category {
                        Label(cat.capitalized, systemImage: PackCategory(rawValue: cat)?.symbol ?? "backpack")
                            .font(.callout)
                    }
                    Spacer()
                    Text("\(template.itemCount) items")
                        .font(.callout.bold())
                    if template.totalWeightGrams > 0 {
                        Text("·").foregroundStyle(.secondary)
                        Text(template.formattedTotalWeight())
                            .font(.callout.bold().monospacedDigit())
                            .foregroundStyle(.tint)
                    }
                }
                .padding(.horizontal)

                if template.totalWeightGrams > 0 {
                    TemplateWeightChart(template: template)
                }

                if let error = applyError {
                    InlineErrorView(message: error).padding(.horizontal)
                }
                if applySuccess {
                    Label("Applied to pack!", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                        .padding(.horizontal)
                }

                // Items list
                if let items = template.items, !items.isEmpty {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Gear List")
                            .font(.caption.uppercaseSmallCaps())
                            .foregroundStyle(.secondary)
                            .padding(.horizontal)
                            .padding(.bottom, 6)

                        let groups = Dictionary(grouping: items, by: { $0.category ?? "Other" })
                        ForEach(groups.keys.sorted(), id: \.self) { cat in
                            Section {
                                ForEach(groups[cat] ?? []) { item in
                                    TemplateItemRow(item: item)
                                    Divider().padding(.leading)
                                }
                            } header: {
                                Text(cat.capitalized)
                                    .font(.caption.uppercaseSmallCaps())
                                    .foregroundStyle(.secondary)
                                    .padding(.horizontal)
                                    .padding(.vertical, 4)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(.background)
                            }
                        }
                    }
                }
            }
            .padding(.bottom)
        }
        .navigationTitle(template.name)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Apply to Pack", systemImage: "plus.square.on.square") {
                    showingApplySheet = true
                }
            }
        }
        .sheet(isPresented: $showingApplySheet) {
            ApplyTemplateSheet(
                template: template,
                packs: packsVM.packs,
                onApply: { packId in
                    applyError = nil
                    applySuccess = false
                    do {
                        try await viewModel.applyTemplate(template.id, toPack: packId)
                        applySuccess = true
                    } catch {
                        applyError = error.localizedDescription
                    }
                }
            )
        }
        .task { if packsVM.packs.isEmpty { await packsVM.load() } }
    }
}

private struct TemplateItemRow: View {
    let item: PackTemplateItem

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(item.name).font(.body)
                HStack(spacing: 8) {
                    if let w = item.weight, let u = item.weightUnit {
                        Label(String(format: "%.0f %@", w, u), systemImage: "scalemass")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    if let qty = item.quantity, qty > 1 {
                        Text("×\(qty)").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            Spacer()
            HStack(spacing: 6) {
                if item.worn == true {
                    Image(systemName: "person.fill").font(.caption).foregroundStyle(.orange)
                }
                if item.consumable == true {
                    Image(systemName: "flame").font(.caption).foregroundStyle(.purple)
                }
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }
}

private struct ApplyTemplateSheet: View {
    let template: PackTemplate
    let packs: [Pack]
    let onApply: (String) async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selectedPackId: String?
    @State private var isApplying = false

    var body: some View {
        NavigationStack {
            Group {
                if packs.isEmpty {
                    ContentUnavailableView(
                        "No Packs",
                        systemImage: "backpack",
                        description: Text("Create a pack first, then apply this template.")
                    )
                } else {
                    List(packs, selection: $selectedPackId) { pack in
                        Text(pack.name).tag(pack.id)
                    }
                }
            }
            .navigationTitle("Apply \"\(template.name)\"")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Apply") {
                        guard let id = selectedPackId else { return }
                        isApplying = true
                        Task {
                            await onApply(id)
                            dismiss()
                        }
                    }
                    .disabled(selectedPackId == nil || isApplying)
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 340, minHeight: 280)
        #endif
    }
}

// MARK: - Template Weight Chart

private struct TemplateWeightChart: View {
    let template: PackTemplate

    private struct CategoryWeight: Identifiable {
        let id = UUID()
        let category: String
        let grams: Double
        static let palette: [Color] = [.blue, .green, .orange, .purple, .pink, .teal]
        var color: Color { Self.palette[abs(category.hashValue) % Self.palette.count] }
    }

    private var categoryData: [CategoryWeight] {
        let groups = Dictionary(grouping: template.items ?? [], by: { $0.category ?? "Other" })
        return groups.compactMap { key, items -> CategoryWeight? in
            let g = items.reduce(0.0) { $0 + $1.weightInGrams }
            guard g > 0 else { return nil }
            return CategoryWeight(category: key.capitalized, grams: g)
        }.sorted { $0.grams > $1.grams }
    }

    private var total: Double { template.totalWeightGrams }

    var body: some View {
        if !categoryData.isEmpty {
            HStack(alignment: .center, spacing: 16) {
                Chart(categoryData) { item in
                    SectorMark(angle: .value("Weight", item.grams),
                               innerRadius: .ratio(0.54),
                               angularInset: 1.5)
                    .foregroundStyle(item.color)
                    .cornerRadius(3)
                }
                .chartLegend(.hidden)
                .overlay {
                    VStack(spacing: 2) {
                        Text(template.formattedTotalWeight())
                            .font(.caption2.monospacedDigit().bold())
                            .minimumScaleFactor(0.6)
                            .lineLimit(1)
                        Text("total")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .padding(4)
                }
                .frame(width: 100, height: 100)

                VStack(alignment: .leading, spacing: 5) {
                    ForEach(categoryData.prefix(5)) { item in
                        HStack(spacing: 6) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(item.color)
                                .frame(width: 10, height: 10)
                            Text(item.category)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                            Spacer(minLength: 0)
                            Text(total > 0 ? String(format: "%.0f%%", item.grams / total * 100) : "")
                                .font(.caption2.monospacedDigit())
                                .foregroundStyle(.tertiary)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(16)
            .background(.background.secondary, in: RoundedRectangle(cornerRadius: 14))
            .padding(.horizontal)
        }
    }
}
