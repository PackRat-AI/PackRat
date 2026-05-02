import SwiftUI

// MARK: - List Column (shown in content pane of 3-column nav)

struct PackTemplatesListView: View {
    @Bindable var viewModel: PackTemplatesViewModel
    @Binding var selectedId: String?
    var packsVM: PacksViewModel = PacksViewModel()

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
        .navigationDestination(for: String.self) { id in
            if let t = viewModel.templates.first(where: { $0.id == id }) {
                PackTemplateDetailView(template: t, viewModel: viewModel, packsVM: packsVM)
            }
        }
    }

    private func templateRow(_ template: PackTemplate) -> some View {
        NavigationLink(value: template.id) {
            TemplateRowView(template: template)
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
                }
                .padding(.horizontal)

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
            .padding(.vertical)
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
