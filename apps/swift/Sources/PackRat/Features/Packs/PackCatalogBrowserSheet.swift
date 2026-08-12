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
    /// Catalog id → the selected item and how many of it. Presence means
    /// selected.
    ///
    /// The item is held here, not looked up in `items`, because searching or
    /// changing category replaces `items` wholesale. Resolving against the
    /// visible list would silently drop anything selected under a previous
    /// query — you would tick three things, search again, tap Add, and get one.
    var selection: [Int: (item: CatalogItem, quantity: Int)] = [:]
    var isLoading = false
    /// True from the keystroke until fresh results land, spanning the debounce.
    /// Distinct from `isLoading`, which only covers the request itself and so
    /// leaves the first 400ms with no feedback at all.
    var isSearching = false
    var isAdding = false
    var error: String?
    var hasLoadedOnce = false

    private let service: any CatalogBrowsing
    private let pageSize = 20
    private var page = 1
    private var hasMore = true
    private var searchTask: Task<Void, Never>?

    init(service: any CatalogBrowsing = CatalogService.shared) {
        self.service = service
    }

    var selectedCount: Int { selection.count }

    var canAdd: Bool { !selection.isEmpty && !isAdding }

    func isSelected(_ item: CatalogItem) -> Bool { selection[item.id] != nil }

    func toggleSelection(_ item: CatalogItem) {
        if selection[item.id] == nil {
            selection[item.id] = (item: item, quantity: 1)
        } else {
            selection.removeValue(forKey: item.id)
        }
    }

    func setQuantity(_ quantity: Int, for item: CatalogItem) {
        guard let existing = selection[item.id] else { return }
        selection[item.id] = (item: existing.item, quantity: max(1, quantity))
    }

    func quantity(for item: CatalogItem) -> Int {
        selection[item.id]?.quantity ?? 1
    }

    func clearSelection() { selection.removeAll() }

    /// Debounced search. Unlike the catalog tab, an empty query is a valid
    /// browse (show popular gear) rather than a no-op, so the pack flow always
    /// has something on screen to pick from.
    ///
    /// `isSearching` flips immediately rather than when the request starts, so
    /// the debounce window is covered too — otherwise typing looks like nothing
    /// is happening for 400ms and then the list silently swaps underneath you.
    func onSearchTextChanged() {
        searchTask?.cancel()
        isSearching = true
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            await load(reset: true)
        }
    }

    func selectCategory(_ category: String?) {
        // Cancel any in-flight debounce or reset load and take over `searchTask`.
        // Otherwise a pending search can land after the category change and
        // overwrite its results — whichever response finishes last wins, which
        // is not necessarily the request the user made last.
        searchTask?.cancel()
        selectedCategory = category
        isSearching = true
        searchTask = Task { await load(reset: true) }
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
        defer {
            isLoading = false
            // Only a reset (search / category change) ends a search — paging
            // to the next page must not clear it.
            if reset { isSearching = false }
        }
        do {
            let results = try await service.browse(
                query: searchText.isEmpty ? nil : searchText,
                category: selectedCategory,
                page: page,
                limit: pageSize
            )
            // A superseded request must not commit. Without this a cancelled
            // search or category change still assigns its results when it
            // finally returns, replacing whatever the user actually asked for.
            guard !Task.isCancelled else { return }
            if reset {
                items = results
            } else {
                // The API paginates without dedup guarantees across pages; drop
                // ids already on screen so SwiftUI's ForEach never sees a
                // duplicate Identifiable and drops rows.
                let known = Set(items.map(\.id))
                items.append(contentsOf: results.filter { !known.contains($0.id) })
            }
            hasMore = results.count == pageSize
        } catch {
            // Give the page number back on a failed append, or the next scroll
            // asks for page + 2 and that page's results are never fetched.
            if !reset, page > 1 { page -= 1 }
            self.error = error.localizedDescription
        }
    }

    func loadMoreIfNeeded(currentItem: CatalogItem) async {
        guard !isLoading, hasMore, currentItem.id == items.last?.id else { return }
        page += 1
        await load(reset: false)
    }

    /// Every selected item, including ones no longer in the visible list because
    /// the query or category changed after they were ticked.
    ///
    /// Ordered by the on-screen list first so a normal add lands predictably,
    /// then anything selected under an earlier query, so nothing is lost.
    func resolvedSelection() -> [(item: CatalogItem, quantity: Int)] {
        var remaining = selection
        var ordered: [(item: CatalogItem, quantity: Int)] = []
        for item in items {
            if let picked = remaining.removeValue(forKey: item.id) {
                ordered.append(picked)
            }
        }
        // Stable order for the off-screen remainder, which a dictionary cannot
        // give on its own.
        ordered.append(contentsOf: remaining.values.sorted { $0.item.id < $1.item.id })
        return ordered
    }
}

struct PackCatalogBrowserSheet: View {
    let packId: String
    let packsViewModel: PacksViewModel
    /// Called with how many items were added and how many failed, so the caller
    /// can surface a toast that admits a partial failure rather than reporting
    /// only the successes.
    var onAdded: ((_ added: Int, _ failed: Int) -> Void)?

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
        if (viewModel.isLoading || viewModel.isSearching) && viewModel.items.isEmpty {
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
                        quantity: viewModel.quantity(for: item),
                        onToggle: { viewModel.toggleSelection(item) },
                        onQuantityChange: { viewModel.setQuantity($0, for: item) }
                    )
                    .task { await viewModel.loadMoreIfNeeded(currentItem: item) }
                }
                // Paging spinner at the foot of the list. Only while appending —
                // a search replaces the list, and its spinner belongs on top of
                // the stale results, not below the fold.
                if viewModel.isLoading && !viewModel.isSearching {
                    HStack {
                        Spacer()
                        ProgressView()
                        Spacer()
                    }
                }
            }
            .listStyle(.plain)
            .accessibilityIdentifier("pack_catalog_results_list")
            // While a new search is in flight the visible rows are stale, so
            // fade them and float a spinner over the top. Without this, typing
            // looks like nothing happened until the list silently swaps.
            .opacity(viewModel.isSearching ? 0.35 : 1)
            .allowsHitTesting(!viewModel.isSearching)
            .overlay {
                if viewModel.isSearching {
                    ProgressView()
                        .controlSize(.large)
                        .accessibilityIdentifier("pack_catalog_searching")
                }
            }
            .animation(.easeInOut(duration: 0.15), value: viewModel.isSearching)
        }
    }

    /// The confirm action lives here as well as in the toolbar. The toolbar copy
    /// competes with the always-visible search drawer for the navigation bar on
    /// iPhone and gets collapsed, which left the selection bar showing only
    /// "N selected" and "Clear" — no way to finish the flow.
    private var selectionBar: some View {
        HStack(spacing: 12) {
            Text("\(viewModel.selectedCount) selected")
                .font(.callout.bold())
            Spacer()
            Button("Clear") { viewModel.clearSelection() }
                .font(.callout)
                .accessibilityIdentifier("pack_catalog_clear")
            Button {
                Task { await addSelected() }
            } label: {
                if viewModel.isAdding {
                    ProgressView().controlSize(.small)
                } else {
                    Text("Add (\(viewModel.selectedCount))")
                        .font(.callout.bold())
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(!viewModel.canAdd)
            .accessibilityIdentifier("pack_catalog_confirm_add_bar")
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
        onAdded?(result.added, result.failed)
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

    @Environment(\.weightUnit) private var weightUnit

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
                            Text(item.displayWeight(in: weightUnit))
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
