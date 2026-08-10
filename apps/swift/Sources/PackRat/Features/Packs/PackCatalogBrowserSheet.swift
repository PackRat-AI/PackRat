import SwiftUI

/// Multi-select catalog browser for adding gear to a pack.
///
/// The Swift app already had a single-item "Add to Pack" path from the catalog
/// tab (`AddCatalogItemToPackSheet`), which works the other way round: start at
/// an item, pick a pack. This is the pack-first flow Expo has
/// (`CatalogBrowserModal`) — you are already in a pack, so you search, tick
/// several items, and add them all at once.
@MainActor
@Observable
final class PackCatalogBrowserViewModel {
    var searchText = ""
    var items: [CatalogItem] = []
    var categories: [String] = []
    var selectedCategory: String?
    /// Catalog id → quantity. Presence means selected.
    var selection: [Int: Int] = [:]
    var isLoading = false
    var isAdding = false
    var error: String?
    var hasLoadedOnce = false

    private let service: CatalogService
    private var page = 1
    private var hasMore = true
    private var searchTask: Task<Void, Never>?

    init(service: CatalogService = .shared) {
        self.service = service
    }

    var selectedCount: Int { selection.count }

    var canAdd: Bool { !selection.isEmpty && !isAdding }

    func isSelected(_ item: CatalogItem) -> Bool { selection[item.id] != nil }

    func toggleSelection(_ item: CatalogItem) {
        if selection[item.id] == nil {
            selection[item.id] = 1
        } else {
            selection.removeValue(forKey: item.id)
        }
    }

    func setQuantity(_ quantity: Int, for item: CatalogItem) {
        guard selection[item.id] != nil else { return }
        selection[item.id] = max(1, quantity)
    }

    func clearSelection() { selection.removeAll() }

    /// Debounced search. Unlike the catalog tab, an empty query is a valid
    /// browse (show popular gear) rather than a no-op, so the pack flow always
    /// has something on screen to pick from.
    func onSearchTextChanged() {
        searchTask?.cancel()
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            await load(reset: true)
        }
    }

    func selectCategory(_ category: String?) {
        selectedCategory = category
        Task { await load(reset: true) }
    }

    func loadInitialIfNeeded() async {
        guard !hasLoadedOnce else { return }
        hasLoadedOnce = true
        async let cats: Void = loadCategories()
        async let items: Void = load(reset: true)
        _ = await (cats, items)
    }

    private func loadCategories() async {
        categories = (try? await service.categories(limit: 20)) ?? []
    }

    func load(reset: Bool) async {
        if reset {
            page = 1
            hasMore = true
        }
        guard hasMore || reset else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let results = try await service.browse(
                query: searchText.isEmpty ? nil : searchText,
                category: selectedCategory,
                page: page,
                limit: 20
            )
            if reset {
                items = results
            } else {
                // The API paginates without dedup guarantees across pages; drop
                // ids already on screen so SwiftUI's ForEach never sees a
                // duplicate Identifiable and drops rows.
                let known = Set(items.map(\.id))
                items.append(contentsOf: results.filter { !known.contains($0.id) })
            }
            hasMore = results.count == 20
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadMoreIfNeeded(currentItem: CatalogItem) async {
        guard !isLoading, hasMore, currentItem.id == items.last?.id else { return }
        page += 1
        await load(reset: false)
    }

    /// Resolves the current selection to (item, quantity) pairs in the order
    /// they appear on screen, so the added items land in a predictable order.
    func resolvedSelection() -> [(item: CatalogItem, quantity: Int)] {
        items.compactMap { item in
            guard let quantity = selection[item.id] else { return nil }
            return (item, quantity)
        }
    }
}

struct PackCatalogBrowserSheet: View {
    let packId: String
    let packsViewModel: PacksViewModel
    /// Called with the number of items added, so the caller can surface a toast.
    var onAdded: ((Int) -> Void)?

    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = PackCatalogBrowserViewModel()

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Add from Catalog")
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                .searchable(
                    text: $viewModel.searchText,
                    placement: .navigationBarDrawer(displayMode: .always),
                    prompt: "Search tents, packs, sleeping bags…"
                )
                #else
                .searchable(text: $viewModel.searchText, prompt: "Search gear…")
                #endif
                .onChange(of: viewModel.searchText) { viewModel.onSearchTextChanged() }
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                            .accessibilityIdentifier("pack_catalog_cancel")
                    }
                    ToolbarItem(placement: .primaryAction) {
                        addButton
                    }
                }
                .task { await viewModel.loadInitialIfNeeded() }
                .safeAreaInset(edge: .bottom) {
                    if viewModel.selectedCount > 0 {
                        selectionBar
                    }
                }
        }
        #if os(macOS)
        .frame(minWidth: 520, minHeight: 600)
        #endif
    }

    private var addButton: some View {
        Button {
            Task { await addSelected() }
        } label: {
            if viewModel.isAdding {
                ProgressView().controlSize(.small)
            } else {
                Text("Add\(viewModel.selectedCount > 0 ? " (\(viewModel.selectedCount))" : "")")
                    .bold()
            }
        }
        .disabled(!viewModel.canAdd)
        .accessibilityIdentifier("pack_catalog_confirm_add")
    }

    @ViewBuilder
    private var content: some View {
        VStack(spacing: 0) {
            if !viewModel.categories.isEmpty {
                categoryChips
            }
            Divider()
            resultsList
        }
    }

    private var categoryChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                chip(label: "All", isSelected: viewModel.selectedCategory == nil) {
                    viewModel.selectCategory(nil)
                }
                ForEach(viewModel.categories, id: \.self) { category in
                    chip(label: category.catalogCategoryDisplayName, isSelected: viewModel.selectedCategory == category) {
                        viewModel.selectCategory(
                            viewModel.selectedCategory == category ? nil : category
                        )
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .accessibilityIdentifier("pack_catalog_categories")
    }

    private func chip(label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.caption.bold())
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(
                    isSelected ? Color.accentColor : Color.accentColor.opacity(0.1),
                    in: Capsule()
                )
                .foregroundStyle(isSelected ? .white : Color.accentColor)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var resultsList: some View {
        if viewModel.isLoading && viewModel.items.isEmpty {
            ProgressView("Loading gear…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let error = viewModel.error, viewModel.items.isEmpty {
            ErrorView(error, retry: { await viewModel.load(reset: true) })
        } else if viewModel.items.isEmpty {
            UnavailableStateView(
                title: "No Gear Found",
                subtitle: viewModel.searchText.isEmpty
                    ? "No catalog items are available right now."
                    : "Nothing matched “\(viewModel.searchText)”. Try a brand, model, or category.",
                systemImage: "magnifyingglass"
            )
            .accessibilityIdentifier("pack_catalog_no_results")
        } else {
            List {
                ForEach(viewModel.items) { item in
                    PackCatalogItemRow(
                        item: item,
                        isSelected: viewModel.isSelected(item),
                        quantity: viewModel.selection[item.id] ?? 1,
                        onToggle: { viewModel.toggleSelection(item) },
                        onQuantityChange: { viewModel.setQuantity($0, for: item) }
                    )
                    .task { await viewModel.loadMoreIfNeeded(currentItem: item) }
                }
                if viewModel.isLoading {
                    HStack {
                        Spacer()
                        ProgressView()
                        Spacer()
                    }
                }
            }
            .listStyle(.plain)
            .accessibilityIdentifier("pack_catalog_results_list")
        }
    }

    private var selectionBar: some View {
        HStack {
            Text("\(viewModel.selectedCount) selected")
                .font(.callout.bold())
            Spacer()
            Button("Clear") { viewModel.clearSelection() }
                .font(.callout)
                .accessibilityIdentifier("pack_catalog_clear")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.bar)
    }

    private func addSelected() async {
        let selections = viewModel.resolvedSelection()
        guard !selections.isEmpty else { return }
        viewModel.isAdding = true
        let result = await packsViewModel.addCatalogItems(selections, to: packId)
        viewModel.isAdding = false

        if result.failed > 0 && result.added == 0 {
            viewModel.error = "Couldn't add \(result.failed == 1 ? "the item" : "those items"). Check your connection and try again."
            return
        }
        onAdded?(result.added)
        dismiss()
    }
}

// MARK: - Row

private struct PackCatalogItemRow: View {
    let item: CatalogItem
    let isSelected: Bool
    let quantity: Int
    let onToggle: () -> Void
    let onQuantityChange: (Int) -> Void

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 12) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(isSelected ? Color.accentColor : Color.secondary)
                    .accessibilityHidden(true)

                RemoteImage(url: item.primaryImage, contentMode: .fill, cornerRadius: 8) {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(.fill.secondary)
                        .overlay { Image(systemName: "photo").foregroundStyle(.tertiary) }
                }
                .frame(width: 48, height: 48)

                VStack(alignment: .leading, spacing: 3) {
                    Text(item.displayName)
                        .font(.subheadline.weight(.medium))
                        .lineLimit(2)
                    HStack(spacing: 8) {
                        if let brand = item.displayBrand {
                            Text(brand).font(.caption2.bold()).foregroundStyle(.tint)
                        }
                        if !item.displayWeight.isEmpty {
                            Text(item.displayWeight)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        if let price = item.displayPrice {
                            Text(price).font(.caption2.bold()).foregroundStyle(.green)
                        }
                    }
                }

                Spacer(minLength: 0)
            }
            .contentShape(Rectangle())
            .onTapGesture(perform: onToggle)

            if isSelected {
                Stepper(
                    "Quantity: \(quantity)",
                    value: Binding(get: { quantity }, set: onQuantityChange),
                    in: 1...99
                )
                .font(.caption)
                .padding(.leading, 32)
                .accessibilityIdentifier("pack_catalog_quantity_\(item.id)")
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("pack_catalog_item_\(item.id)")
    }
}
