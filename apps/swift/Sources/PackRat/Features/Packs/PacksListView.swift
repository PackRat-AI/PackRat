import SwiftUI
import SwiftData

struct PacksListView: View {
    @Bindable var viewModel: PacksViewModel
    @Binding var selectedId: String?
    @State private var showingCreateSheet = false
    @State private var showingRecentPacks = false
    @State private var needsRefresh = false
    @State private var isExplore = false
    @State private var selectedCategory: PackCategory? = nil
    @State private var publicPacks: [Pack] = []
    @State private var isLoadingPublic = false
    @State private var packPendingDeletion: Pack?
    @State private var showingDeleteConfirmation = false
    @Environment(\.modelContext) private var modelContext
    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    private var isCompact: Bool { horizontalSizeClass == .compact }
    #else
    private var isCompact: Bool { false }
    #endif

    private var displayedPacks: [Pack] {
        let base = isExplore ? publicPacks : viewModel.filteredPacks
        guard let cat = selectedCategory else { return base }
        return base.filter { $0.category == cat }
    }

    var body: some View {
        VStack(spacing: 0) {
            categoryFilterBar

            Group {
                if viewModel.isLoading && viewModel.packs.isEmpty && !viewModel.isCacheLoaded && !isExplore {
                    ProgressView("Loading packs…").frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error = viewModel.error, viewModel.packs.isEmpty, !isExplore {
                    ErrorView(error, retry: { await viewModel.load(context: modelContext) })
                } else if isLoadingPublic && publicPacks.isEmpty {
                    ProgressView("Loading…").frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if displayedPacks.isEmpty && !viewModel.searchText.isEmpty {
                    ContentUnavailableView.search(text: viewModel.searchText)
                        .accessibilityIdentifier("packs_search_empty_state")
                } else if displayedPacks.isEmpty && !isExplore {
                    EmptyStateView(
                        "No Packs Yet",
                        subtitle: "Create your first pack to start tracking gear weight",
                        systemImage: "backpack",
                        actionLabel: "New Pack",
                        accessibilityIdentifier: "packs_empty_state",
                        action: { showingCreateSheet = true }
                    )
                } else if displayedPacks.isEmpty && isExplore {
                    EmptyStateView(
                        "No Public Packs",
                        subtitle: "No packs match your filter",
                        systemImage: "globe",
                        accessibilityIdentifier: "packs_public_empty_state"
                    )
                } else {
                    packList
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(.background)
        .navigationTitle("Packs")
        .searchable(text: $viewModel.searchText, prompt: "Search packs")
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                if !isExplore {
                    Button("New Pack", systemImage: "plus") { showingCreateSheet = true }
                        .accessibilityIdentifier("packs_new_pack_button")
                        .keyboardShortcut("n", modifiers: .command)
                }
                if viewModel.isLoading || isLoadingPublic {
                    ProgressView().controlSize(.small)
                }
            }
            ToolbarItem(placement: .secondaryAction) {
                Button("Recent", systemImage: "clock") {
                    showingRecentPacks = true
                }
                .accessibilityIdentifier("packs_recent_button")
            }
        }
        .task { await viewModel.load(context: modelContext) }
        .refreshable {
            if isExplore { await loadPublic() }
            else { await viewModel.load(context: modelContext) }
        }
        .onChange(of: isExplore) { _, explore in
            selectedCategory = nil
            if explore && publicPacks.isEmpty { Task { await loadPublic() } }
        }
        .sheet(isPresented: $showingCreateSheet) {
            PackFormView(viewModel: viewModel)
        }
        .navigationDestination(isPresented: $showingRecentPacks) {
            RecentPacksView(packs: viewModel.packs)
        }
        .focusedSceneValue(\.newPackAction, $showingCreateSheet)
        .focusedSceneValue(\.refreshAction, $needsRefresh)
        .onChange(of: needsRefresh) { _, new in
            if new { Task { await viewModel.load(context: modelContext) }; needsRefresh = false }
        }
    }

    // MARK: - Category Filter Bar

    private var categoryFilterBar: some View {
        VStack(spacing: 8) {
            Picker("View", selection: $isExplore) {
                Label("My Packs", systemImage: "person.fill").tag(false)
                    .accessibilityIdentifier("packs_mode_my_packs")
                Label("Explore", systemImage: "globe").tag(true)
                    .accessibilityIdentifier("packs_mode_explore")
            }
            .pickerStyle(.segmented)
            .accessibilityIdentifier("packs_mode_picker")

            HStack {
                Picker("Category", selection: $selectedCategory) {
                    Label("All", systemImage: "line.3.horizontal.decrease.circle")
                        .tag(nil as PackCategory?)
                    ForEach(PackCategory.allCases, id: \.self) { cat in
                        Label(cat.label, systemImage: cat.symbol)
                            .tag(Optional(cat))
                    }
                }
                .pickerStyle(.menu)
                .accessibilityIdentifier("packs_category_filter")

                Spacer()

                Text(selectedCategory?.label ?? "All")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.bar)
    }

    // MARK: - Pack Row

    @ViewBuilder
    private func packRow(_ pack: Pack) -> some View {
        if isCompact {
            NavigationLink {
                PackDetailView(pack: pack, viewModel: viewModel)
            } label: {
                PackRowView(pack: pack)
            }
        } else {
            PackRowView(pack: pack)
        }
    }

    /// Compact iOS navigates by pushing from `packRow`'s `NavigationLink`, so the
    /// list must not also track a selection — the tapped row would stay rendered
    /// in its selected (gray) state after the pop back. Selection is only
    /// meaningful on the split-view layouts, where it drives the detail pane.
    private var listSelection: Binding<String?>? {
        isCompact ? nil : $selectedId
    }

    private var packList: some View {
        List(displayedPacks, selection: listSelection) { pack in
            packRow(pack)
                .contextMenu {
                    #if os(macOS)
                    OpenWindowButton(id: "pack", value: pack.id, label: "Open in New Window")
                    Divider()
                    #endif
                    if !isExplore {
                        Button("Delete", systemImage: "trash", role: .destructive) {
                            requestDelete(pack)
                        }
                    }
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    if !isExplore {
                        Button("Delete", systemImage: "trash", role: .destructive) {
                            requestDelete(pack)
                        }
                        .accessibilityIdentifier("pack_delete_button_\(pack.id)")
                    }
                }
                .task {
                    if pack.id == displayedPacks.last?.id, !isExplore {
                        await viewModel.loadMore()
                    }
                }
        }
        .accessibilityIdentifier(isExplore ? "packs_public_list" : "packs_list")
        // Buttons must be bare `Button`s: applying a modifier such as
        // `.accessibilityIdentifier` wraps one in `ModifiedContent`, which the
        // alert builder no longer treats as an alert action — the alert then
        // degrades into a clipped popover with the extra buttons dropped.
        // Matches the working sign-out alert in ProfileView.
        .alert(deletePackAlertTitle, isPresented: $showingDeleteConfirmation) {
            Button("Delete", role: .destructive) {
                if let pack = packPendingDeletion { deletePack(pack) }
            }
            Button("Cancel", role: .cancel) { packPendingDeletion = nil }
        } message: {
            Text(deletePackAlertMessage)
        }
    }

    private var deletePackAlertTitle: String {
        "Delete \(packPendingDeletion?.name ?? "Pack")?"
    }

    private var deletePackAlertMessage: String {
        guard let pack = packPendingDeletion else { return "" }
        let count = pack.itemCount
        return "\"\(pack.name)\" and its \(count) item\(count == 1 ? "" : "s") will be deleted. This cannot be undone."
    }

    /// Captures the row that requested deletion, then presents the alert.
    private func requestDelete(_ pack: Pack) {
        packPendingDeletion = pack
        showingDeleteConfirmation = true
    }

    // MARK: - Delete

    private func deletePack(_ pack: Pack) {
        packPendingDeletion = nil
        Task {
            // Deleting never fails at the call site — an unreachable server queues the
            // delete for replay. Failures surface via the pending-writes banner.
            await viewModel.deletePack(pack.id, context: modelContext)
            if selectedId == pack.id { selectedId = nil }
        }
    }

    // MARK: - Public Packs

    private func loadPublic() async {
        isLoadingPublic = true
        defer { isLoadingPublic = false }
        do {
            publicPacks = try await viewModel.service.listPacks(page: 1, limit: 30, includePublic: true)
                .activePacks
        } catch { }
    }
}

private struct PackRowView: View {
    let pack: Pack

    @Environment(\.weightUnit) private var weightUnit

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(pack.name)
                    .font(.headline)
                    .lineLimit(2)
                    .layoutPriority(1)
                Spacer()
                if let total = pack.totalWeight, total > 0 {
                    Text(pack.formattedWeight(total, in: weightUnit))
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(.fill.tertiary, in: Capsule())
                        .fixedSize(horizontal: true, vertical: false)
                }
            }
            HStack(spacing: 8) {
                if let cat = pack.category {
                    Label(cat.label, systemImage: cat.symbol)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Text("\(pack.itemCount) item\(pack.itemCount == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                if pack.isPublic == true {
                    Image(systemName: "globe").font(.caption2).foregroundStyle(.tint)
                }
            }
            .lineLimit(1)
        }
        .padding(.vertical, 2)
    }
}
