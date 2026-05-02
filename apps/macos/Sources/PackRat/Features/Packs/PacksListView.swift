import SwiftUI

struct PacksListView: View {
    @State private var viewModel = PacksViewModel()
    @State private var selectedPackId: String?
    @State private var showingCreateSheet = false

    var body: some View {
        NavigationSplitView {
            sidebarContent
        } detail: {
            if let id = selectedPackId, let pack = viewModel.packs.first(where: { $0.id == id }) {
                PackDetailView(pack: pack, viewModel: viewModel)
            } else {
                EmptyStateView(
                    "Select a Pack",
                    subtitle: "Choose a pack from the list or create a new one",
                    systemImage: "backpack",
                    actionLabel: "New Pack",
                    action: { showingCreateSheet = true }
                )
            }
        }
        .task { await viewModel.load() }
        .sheet(isPresented: $showingCreateSheet) {
            PackFormView(viewModel: viewModel)
        }
    }

    private var sidebarContent: some View {
        Group {
            if viewModel.isLoading && viewModel.packs.isEmpty {
                ProgressView("Loading packs...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.error {
                ErrorView(error, retry: { await viewModel.load() })
            } else if viewModel.filteredPacks.isEmpty && !viewModel.searchText.isEmpty {
                ContentUnavailableView.search(text: viewModel.searchText)
            } else if viewModel.packs.isEmpty {
                EmptyStateView(
                    "No Packs Yet",
                    subtitle: "Create your first pack to get started",
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
                Button("New Pack", systemImage: "plus") {
                    showingCreateSheet = true
                }
            }
            ToolbarItem(placement: .automatic) {
                if viewModel.isLoading {
                    ProgressView().controlSize(.small)
                }
            }
        }
        .refreshable { await viewModel.load() }
    }

    private var packList: some View {
        List(viewModel.filteredPacks, selection: $selectedPackId) { pack in
            PackRowView(pack: pack)
                .tag(pack.id)
                .contextMenu {
                    Button("Delete", role: .destructive, systemImage: "trash") {
                        Task { try? await viewModel.deletePack(pack.id) }
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
                Text(pack.name)
                    .font(.headline)
                Spacer()
                if let total = pack.totalWeight, total > 0 {
                    Text(pack.formattedWeight(total))
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(.fill.tertiary, in: Capsule())
                }
            }
            HStack(spacing: 8) {
                if let cat = pack.category {
                    Label(cat.capitalized, systemImage: PackCategory(rawValue: cat)?.symbol ?? "backpack")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Text("\(pack.itemCount) item\(pack.itemCount == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}
