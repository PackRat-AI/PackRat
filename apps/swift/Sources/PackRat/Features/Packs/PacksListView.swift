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
        Group {
            if viewModel.isLoading && viewModel.packs.isEmpty && !isExplore {
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
        .navigationTitle("Packs")
        .searchable(text: $viewModel.searchText, prompt: "Search packs")
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                if !isExplore {
                    Button("New Pack", systemImage: "plus") { showingCreateSheet = true }
                        .accessibilityIdentifier("packs_new_pack_button")
                        .keyboardShortcut("n", modifiers: .command)
                        .accessibilityIdentifier("new_pack_button")
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
        .safeAreaInset(edge: .top, spacing: 0) {
            categoryFilterBar
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

    private var packList: some View {
        List(displayedPacks, selection: $selectedId) { pack in
            packRow(pack)
                .contextMenu {
                    #if os(macOS)
                    OpenWindowButton(id: "pack", value: pack.id, label: "Open in New Window")
                    Divider()
                    #endif
                    if !isExplore {
                        Button("Delete", systemImage: "trash", role: .destructive) {
                            Task { try? await viewModel.deletePack(pack.id) }
                        }
                    }
                }
                .task {
                    if pack.id == displayedPacks.last?.id, !isExplore {
                        await viewModel.loadMore()
                    }
                }
        }
        .accessibilityIdentifier(isExplore ? "packs_public_list" : "packs_list")
    }

    // MARK: - Public Packs

    private func loadPublic() async {
        isLoadingPublic = true
        defer { isLoadingPublic = false }
        do {
            publicPacks = try await viewModel.service.listPacks(page: 1, limit: 30, includePublic: true)
        } catch { }
    }
}

private struct PackRowView: View {
    let pack: Pack

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(pack.name).font(.headline)
                Spacer()
                if let total = pack.totalWeight, total > 0 {
                    Text(pack.formattedWeight(total))
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(.fill.tertiary, in: Capsule())
                }
            }
            HStack(spacing: 8) {
                if let cat = pack.category {
                    Label(cat.label, systemImage: cat.symbol)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Text("\(pack.itemCount) item\(pack.itemCount == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if pack.isPublic == true {
                    Image(systemName: "globe").font(.caption2).foregroundStyle(.tint)
                }
            }
        }
        .padding(.vertical, 2)
    }
}
