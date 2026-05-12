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
                ErrorView(error, retry: { await viewModel.load() })
            } else if isLoadingPublic && publicPacks.isEmpty {
                ProgressView("Loading…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if displayedPacks.isEmpty && !viewModel.searchText.isEmpty {
                ContentUnavailableView.search(text: viewModel.searchText)
            } else if displayedPacks.isEmpty && !isExplore {
                EmptyStateView(
                    "No Packs Yet",
                    subtitle: "Create your first pack to start tracking gear weight",
                    systemImage: "backpack",
                    actionLabel: "New Pack",
                    action: { showingCreateSheet = true }
                )
            } else if displayedPacks.isEmpty && isExplore {
                EmptyStateView(
                    "No Public Packs",
                    subtitle: "No packs match your filter",
                    systemImage: "globe"
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
                        .keyboardShortcut("n", modifiers: .command)
                        .accessibilityIdentifier("new_pack_button")
                }
                if viewModel.isLoading || isLoadingPublic {
                    ProgressView().controlSize(.small)
                }
            }
            ToolbarItem(placement: .secondaryAction) {
                Picker("View", selection: $isExplore) {
                    Label("My Packs", systemImage: "person.fill").tag(false)
                    Label("Explore", systemImage: "globe").tag(true)
                }
                .pickerStyle(.segmented)
            }
            ToolbarItem(placement: .secondaryAction) {
                Button("Recent", systemImage: "clock") {
                    showingRecentPacks = true
                }
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
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                categoryChip(nil, label: "All")
                ForEach(PackCategory.allCases, id: \.self) { cat in
                    categoryChip(cat, label: cat.label)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .background(.bar)
    }

    private func categoryChip(_ cat: PackCategory?, label: String) -> some View {
        let isSelected = selectedCategory == cat
        return Button {
            withAnimation(.spring(duration: 0.2)) { selectedCategory = cat }
        } label: {
            Text(label)
                .font(.caption.bold())
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? Color.accentColor : Color.accentColor.opacity(0.1), in: Capsule())
                .foregroundStyle(isSelected ? Color.white : Color.accentColor)
        }
        .buttonStyle(.plain)
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
