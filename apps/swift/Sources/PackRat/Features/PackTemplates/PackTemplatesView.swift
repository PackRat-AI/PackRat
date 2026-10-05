import SwiftUI
import Charts
import SwiftData

// MARK: - List Column (shown in content pane of 3-column nav)

struct PackTemplatesListView: View {
    @Bindable var viewModel: PackTemplatesViewModel
    @Binding var selectedId: String?
    var packsVM: PacksViewModel = PacksViewModel()
    var showsGuestLimitInList = true
    @Environment(AuthManager.self) private var authManager
    @State private var showingNewTemplate = false
    /// Last segment the user picked, restored next visit. Empty until they pick
    /// one, so the default can follow what they have (see `scope`).
    @AppStorage("packTemplates.scope") private var storedScope = ""
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
                        "Sign In to Use Templates",
                        subtitle: "Start from a ready-made pack list instead of a blank one, and keep your own for next time. Building packs by hand works without an account.",
                        systemImage: "doc.on.doc"
                    )
                } else {
                    Color.clear
                }
            } else if viewModel.isLoading && viewModel.templates.isEmpty {
                ProgressView("Loading templates…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.error, viewModel.templates.isEmpty {
                ErrorView(error, retry: { await viewModel.load() })
            } else {
                templateList
            }
        }
        .navigationTitle("Pack Templates")
        .packTemplateSearchable(text: $viewModel.searchText)
        .task { if authManager.isAuthenticated && viewModel.templates.isEmpty { await viewModel.load() } }
        .refreshable { if authManager.isAuthenticated { await viewModel.load() } }
        .toolbar {
            if authManager.isAuthenticated {
                ToolbarItem(placement: .primaryAction) {
                    Button("New Template", systemImage: "plus") {
                        showingNewTemplate = true
                    }
                    .accessibilityIdentifier("templates_new_template_button")
                }
            }
        }
        .sheet(isPresented: $showingNewTemplate) {
            PackTemplateFormView(viewModel: viewModel) { saved in
                // A new template is the user's own — switch to Mine so it's
                // on screen rather than hidden behind the Featured segment.
                storedScope = TemplateScope.mine.rawValue
                selectedId = saved.id
            }
        }
    }

    /// Mine vs Featured, as a segmented control — HIG's pattern for switching
    /// between closely related views of one screen (Shortcuts keeps its Gallery
    /// apart from My Shortcuts the same way). Replaces stacked sections, which
    /// made people scroll past every featured template to reach their own.
    /// Defaults to Mine once the user has any, otherwise Featured.
    private var scope: Binding<TemplateScope> {
        Binding(
            get: {
                TemplateScope(rawValue: storedScope)
                    ?? (viewModel.myTemplates.isEmpty && viewModel.searchText.isEmpty ? .featured : .mine)
            },
            set: { storedScope = $0.rawValue }
        )
    }

    private func templates(in scope: TemplateScope) -> [PackTemplate] {
        scope == .mine ? viewModel.myTemplates : viewModel.officialTemplates
    }

    private var scopePicker: some View {
        Picker("Templates", selection: scope) {
            ForEach(TemplateScope.allCases) { scope in
                Text(scope.title).tag(scope)
            }
        }
        .pickerStyle(.segmented)
        .labelsHidden()
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.bar)
        .accessibilityIdentifier("templates_scope_picker")
    }

    private var templateList: some View {
        let current = scope.wrappedValue
        let shown = templates(in: current)
        return List(selection: $selectedId) {
            if shown.isEmpty {
                Section {
                    emptyState(for: current)
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            } else {
                Section {
                    ForEach(shown) { t in
                        if current == .mine {
                            templateRow(t)
                                .contextMenu {
                                    Button("Delete", systemImage: "trash", role: .destructive) {
                                        Task { try? await viewModel.deleteTemplate(t.id) }
                                    }
                                }
                        } else {
                            templateRow(t)
                        }
                    }
                }
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) { scopePicker }
    }

    @ViewBuilder
    private func emptyState(for current: TemplateScope) -> some View {
        let other: TemplateScope = current == .mine ? .featured : .mine
        let otherCount = templates(in: other).count
        if !viewModel.searchText.isEmpty {
            // Search runs inside the selected segment; point at matches in the
            // other one rather than claiming there are none.
            if otherCount > 0 {
                ContentUnavailableView {
                    Label("No Results in \(current.title)", systemImage: "magnifyingglass")
                } description: {
                    Text("\(otherCount) \(otherCount == 1 ? "match" : "matches") in \(other.title).")
                } actions: {
                    Button("Show \(other.title)") { scope.wrappedValue = other }
                }
            } else {
                ContentUnavailableView.search(text: viewModel.searchText)
            }
        } else if current == .mine {
            ContentUnavailableView {
                Label("No Templates Yet", systemImage: "doc.on.doc")
            } description: {
                Text("Save a gear list you reuse, or start from a featured one.")
            } actions: {
                Button("New Template") { showingNewTemplate = true }
                    .buttonStyle(.borderedProminent)
                if !viewModel.officialTemplates.isEmpty {
                    Button("Browse Featured") { scope.wrappedValue = .featured }
                }
            }
        } else {
            ContentUnavailableView(
                "No Featured Templates",
                systemImage: "checkmark.seal",
                description: Text("Curated gear lists will appear here.")
            )
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
        .accessibilityIdentifier("template_row_\(template.id)")
    }
}

private extension View {
    @ViewBuilder
    func packTemplateSearchable(text: Binding<String>) -> some View {
        #if os(iOS)
        self.searchable(
            text: text,
            placement: .navigationBarDrawer(displayMode: .always),
            prompt: "Search templates"
        )
        #else
        self.searchable(text: text, prompt: "Search templates")
        #endif
    }
}

enum TemplateScope: String, CaseIterable, Identifiable {
    case mine, featured
    var id: String { rawValue }
    var title: String { self == .mine ? "Mine" : "Featured" }
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

    @Environment(\.modelContext) private var modelContext
    @Environment(\.weightUnit) private var weightUnit
    @Environment(AppState.self) private var appState
    @State private var showingApplySheet = false
    @State private var showingEditTemplate = false
    @State private var showingAddItem = false
    @State private var editingItem: PackTemplateItem?
    /// The pack a template was just applied to, pushed onto this stack on
    /// iPhone so the result is the confirmation (no toast).
    @State private var appliedPackId: String?
    @State private var applyCount = 0
    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    private var isCompact: Bool {
        horizontalSizeClass == .compact && UIDevice.current.userInterfaceIdiom == .phone
    }
    #else
    private var isCompact: Bool { false }
    #endif

    // Reactive: reads from viewModel so updates propagate live
    private var currentTemplate: PackTemplate {
        viewModel.templates.first { $0.id == template.id } ?? template
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let desc = currentTemplate.description {
                    Text(desc)
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal)
                }

                HStack(spacing: 10) {
                    if currentTemplate.isOfficial {
                        Label("Featured", systemImage: "checkmark.seal.fill")
                            .font(.callout)
                            .foregroundStyle(.tint)
                            .accessibilityIdentifier("template_detail_featured_badge")
                    }
                    if let cat = currentTemplate.category {
                        Label(cat.capitalized, systemImage: PackCategory(rawValue: cat)?.symbol ?? "backpack")
                            .font(.callout)
                    }
                    Spacer()
                    Text("\(currentTemplate.itemCount) items")
                        .font(.callout.bold())
                    if currentTemplate.totalWeightGrams > 0 {
                        Text("·").foregroundStyle(.secondary)
                        Text(currentTemplate.formattedTotalWeight(in: weightUnit))
                            .font(.callout.bold().monospacedDigit())
                            .foregroundStyle(.tint)
                    }
                }
                .padding(.horizontal)

                if currentTemplate.totalWeightGrams > 0 {
                    TemplateWeightChart(template: currentTemplate)
                }

                if let items = currentTemplate.items, !items.isEmpty {
                    itemsSection(items)
                } else if !currentTemplate.isOfficial {
                    Button("Add first item", systemImage: "plus.circle") {
                        showingAddItem = true
                    }
                    .padding(.horizontal)
                }
            }
            .padding(.bottom)
        }
        .navigationTitle(currentTemplate.name)
        .toolbar { toolbarContent }
        .sheet(isPresented: $showingApplySheet) {
            ApplyTemplateSheet(template: currentTemplate, packsVM: packsVM) { pack in
                showingApplySheet = false
                applyCount += 1
                openPack(pack)
            }
        }
        .navigationDestination(item: $appliedPackId) { id in
            if let pack = packsVM.packs.first(where: { $0.id == id }) {
                PackDetailView(pack: pack, viewModel: packsVM)
            }
        }
        .sensoryFeedback(.success, trigger: applyCount)
        .sheet(isPresented: $showingEditTemplate) {
            PackTemplateFormView(viewModel: viewModel, existingTemplate: currentTemplate)
        }
        .sheet(isPresented: $showingAddItem) {
            PackTemplateItemFormView(viewModel: viewModel, templateId: currentTemplate.id)
        }
        .sheet(item: $editingItem) { item in
            PackTemplateItemFormView(viewModel: viewModel, templateId: currentTemplate.id, existingItem: item)
        }
        .task { if packsVM.packs.isEmpty { await packsVM.load(context: modelContext) } }
    }

    /// Lands the user in the pack they just filled. iPhone pushes it onto the
    /// templates stack (Back returns here); the split layouts select it in the
    /// Packs column, the same way choosing it from the sidebar would.
    private func openPack(_ pack: Pack) {
        if isCompact {
            appliedPackId = pack.id
        } else {
            appState.selectedPackId = pack.id
            appState.navItem = .packs
        }
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        if !currentTemplate.isOfficial {
            ToolbarItem(placement: .primaryAction) {
                Button("Add Item", systemImage: "plus") {
                    showingAddItem = true
                }
                .accessibilityIdentifier("template_detail_add_item_button")
            }
            ToolbarItem(placement: .primaryAction) {
                Button("Edit", systemImage: "pencil") {
                    showingEditTemplate = true
                }
                .accessibilityIdentifier("template_detail_edit_button")
            }
        }
        ToolbarItem(placement: .primaryAction) {
            Button("Apply to Pack", systemImage: "plus.square.on.square") {
                showingApplySheet = true
            }
        }
    }

    private func itemsSection(_ items: [PackTemplateItem]) -> some View {
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
                        templateItemRow(item)
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

    @ViewBuilder
    private func templateItemRow(_ item: PackTemplateItem) -> some View {
        TemplateItemRow(item: item)
            .accessibilityIdentifier("template_item_row_\(item.id)")
            .contextMenu {
                if !currentTemplate.isOfficial {
                    Button("Edit", systemImage: "pencil") {
                        editingItem = item
                    }
                    Button("Delete", systemImage: "trash", role: .destructive) {
                        Task { try? await viewModel.deleteItem(inTemplate: currentTemplate.id, itemId: item.id) }
                    }
                }
            }
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

/// "Apply to Pack": add the template to an existing pack, or start a new one
/// from it. Modelled on Photos' "Add to Album" and Music's "Add to Playlist" —
/// "New Pack" is the first row, existing packs follow — with the new-pack name
/// step from Reminders' "Use Template" (prefilled with the template's name).
private struct ApplyTemplateSheet: View {
    let template: PackTemplate
    let packsVM: PacksViewModel
    let onApplied: (Pack) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @State private var path: [Route] = []
    /// Pack currently being filled; locks the sheet while set.
    @State private var applyingPackId: String?
    @State private var error: String?

    enum Route: Hashable { case newPack }

    private var itemCount: Int { template.itemCount }
    private var isWorking: Bool { applyingPackId != nil }

    var body: some View {
        NavigationStack(path: $path) {
            List {
                if let error {
                    Section { InlineErrorView(message: error) }
                }
                Section {
                    NavigationLink(value: Route.newPack) {
                        Label("New Pack", systemImage: "plus")
                            .foregroundStyle(.tint)
                    }
                    .disabled(isWorking)
                    .accessibilityIdentifier("apply_template_new_pack")
                } footer: {
                    Text("Adds \(itemCount) \(itemCount == 1 ? "item" : "items") from \u{201C}\(template.name)\u{201D}.")
                }
                if !packsVM.packs.isEmpty {
                    Section("Your Packs") {
                        ForEach(packsVM.packs) { pack in
                            existingPackRow(pack)
                        }
                    }
                }
            }
            .navigationTitle("Apply to Pack")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .disabled(isWorking)
                }
            }
            .navigationDestination(for: Route.self) { _ in
                NewPackFromTemplateForm(template: template) { name in
                    try await createPack(named: name)
                }
            }
        }
        .interactiveDismissDisabled(isWorking)
        .formSheetSize(minWidth: 480, minHeight: 420)
    }

    private func existingPackRow(_ pack: Pack) -> some View {
        Button {
            Task { await apply(to: pack) }
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(pack.name).foregroundStyle(.primary)
                    Text(applyingPackId == pack.id
                         ? "Adding \(itemCount) \(itemCount == 1 ? "item" : "items")\u{2026}"
                         : "\(pack.itemCount) \(pack.itemCount == 1 ? "item" : "items")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .contentTransition(.opacity)
                }
                Spacer()
                if applyingPackId == pack.id {
                    ProgressView()
                }
            }
            .contentShape(Rectangle())
        }
        .disabled(isWorking)
        .accessibilityIdentifier("apply_template_pack_\(pack.id)")
    }

    private func apply(to pack: Pack) async {
        error = nil
        applyingPackId = pack.id
        defer { applyingPackId = nil }
        do {
            let updated = try await packsVM.applyTemplate(
                template.id, toPack: pack.id, context: modelContext
            )
            onApplied(updated ?? pack)
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Returns normally on success (the sheet closes) and on a failed copy (the
    /// form pops back so the half-made pack, now first in "Your Packs", can be
    /// retried with one tap). Throws only when the pack itself wasn't created,
    /// so the form keeps the user's name for another try.
    private func createPack(named name: String) async throws {
        error = nil
        applyingPackId = ""
        defer { applyingPackId = nil }
        do {
            let pack = try await packsVM.createPack(
                fromTemplate: template, name: name, context: modelContext
            )
            onApplied(pack)
        } catch let failure as TemplateApplyError {
            error = failure.localizedDescription
            path.removeAll()
        }
    }
}

private struct NewPackFromTemplateForm: View {
    let template: PackTemplate
    let onCreate: (String) async throws -> Void

    @State private var name: String
    @State private var isCreating = false
    @State private var error: String?
    @FocusState private var nameFocused: Bool

    init(template: PackTemplate, onCreate: @escaping (String) async throws -> Void) {
        self.template = template
        self.onCreate = onCreate
        _name = State(initialValue: template.name)
    }

    private var trimmed: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        Form {
            if let error {
                Section { InlineErrorView(message: error) }
            }
            Section {
                TextField("Pack Name", text: $name)
                    .focused($nameFocused)
                    .submitLabel(.done)
                    .onSubmit { Task { await create() } }
                    .disabled(isCreating)
                    .accessibilityIdentifier("apply_template_new_pack_name")
            } footer: {
                Text("Starts with the \(template.itemCount) items from \u{201C}\(template.name)\u{201D}. You can change them anytime.")
            }
        }
        .navigationTitle("New Pack")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .navigationBarBackButtonHiddenIfAvailable(isCreating)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                if isCreating {
                    ProgressView()
                } else {
                    Button("Create") { Task { await create() } }
                        .disabled(trimmed.isEmpty)
                        .accessibilityIdentifier("apply_template_create_button")
                }
            }
        }
        .onAppear { nameFocused = true }
    }

    private func create() async {
        guard !trimmed.isEmpty, !isCreating else { return }
        error = nil
        isCreating = true
        defer { isCreating = false }
        do {
            try await onCreate(trimmed)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

private extension View {
    @ViewBuilder
    func navigationBarBackButtonHiddenIfAvailable(_ hidden: Bool) -> some View {
        #if os(iOS)
        self.navigationBarBackButtonHidden(hidden)
        #else
        self
        #endif
    }
}

// MARK: - Template Weight Chart

private struct TemplateWeightChart: View {
    let template: PackTemplate

    @Environment(\.weightUnit) private var weightUnit

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
                        Text(template.formattedTotalWeight(in: weightUnit))
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
