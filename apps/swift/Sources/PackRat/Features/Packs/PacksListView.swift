import SwiftUI
import SwiftData

struct PacksListView: View {
    @Bindable var viewModel: PacksViewModel
    @Binding var selectedId: String?
    @State private var showingCreateSheet = false
    @State private var needsRefresh = false
    @Environment(\.modelContext) private var modelContext
    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    private var isCompact: Bool { horizontalSizeClass == .compact }
    #else
    private var isCompact: Bool { false }
    #endif

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.packs.isEmpty {
                ProgressView("Loading packs…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.error, viewModel.packs.isEmpty {
                ErrorView(error, retry: { await viewModel.load() })
            } else if viewModel.filteredPacks.isEmpty && !viewModel.searchText.isEmpty {
                ContentUnavailableView.search(text: viewModel.searchText)
            } else if viewModel.packs.isEmpty {
                EmptyStateView(
                    "No Packs Yet",
                    subtitle: "Create your first pack to start tracking gear weight",
                    systemImage: "backpack",
                    actionLabel: "New Pack",
                    action: { showingCreateSheet = true }
                )
            } else {
                packList
            }
        }
        .navigationTitle("Packs")
        .searchable(text: $viewModel.searchText, prompt: "Search packs")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("New Pack", systemImage: "plus") { showingCreateSheet = true }
                    .keyboardShortcut("n", modifiers: .command)
            }
            if viewModel.isLoading {
                ToolbarItem(placement: .automatic) {
                    ProgressView().controlSize(.small)
                }
            }
        }
        .task { await viewModel.load(context: modelContext) }
        .refreshable { await viewModel.load(context: modelContext) }
        .sheet(isPresented: $showingCreateSheet) {
            PackFormView(viewModel: viewModel)
        }
        .focusedSceneValue(\.newPackAction, $showingCreateSheet)
        .focusedSceneValue(\.refreshAction, $needsRefresh)
        .onChange(of: needsRefresh) { _, new in
            if new { Task { await viewModel.load(context: modelContext) }; needsRefresh = false }
        }
    }

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
        List(viewModel.filteredPacks, selection: $selectedId) { pack in
            packRow(pack)
                .contextMenu {
                    #if os(macOS)
                    OpenWindowButton(id: "pack", value: pack.id, label: "Open in New Window")
                    Divider()
                    #endif
                    Button("Delete", systemImage: "trash", role: .destructive) {
                        Task { try? await viewModel.deletePack(pack.id) }
                    }
                }
                .task {
                    if pack.id == viewModel.filteredPacks.last?.id {
                        await viewModel.loadMore()
                    }
                }
        }
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
