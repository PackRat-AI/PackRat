import SwiftUI
import NukeUI
import SwiftData

struct CatalogView: View {
    @Environment(AppState.self) private var appState
    @Environment(AuthManager.self) private var authManager

    var body: some View {
        @Bindable var vm = appState.catalogVM

        return Group {
            if !authManager.isAuthenticated {
                GuestLimitedView(
                    "Sign In to Search Gear",
                    subtitle: "Search thousands of products for weights, prices, and specs. Your own packs and trips stay on this device and keep working without an account.",
                    systemImage: "magnifyingglass"
                )
            } else if vm.isLoading && vm.items.isEmpty {
                ProgressView("Searching gear…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = vm.error, vm.items.isEmpty {
                ErrorView(error, retry: { await vm.search(reset: true) })
            } else if vm.items.isEmpty && vm.hasSearched && (!vm.searchText.isEmpty || vm.selectedCategory != nil) {
                UnavailableStateView(
                    title: "No Results",
                    subtitle: vm.searchText.isEmpty
                        ? "No gear in this category yet."
                        : "No gear matched “\(vm.searchText)”. Try a brand, model, or category.",
                    systemImage: "magnifyingglass"
                )
                .accessibilityIdentifier("catalog_no_results")
            } else if vm.items.isEmpty {
                EmptyStateView(
                    "Search the Gear Catalog",
                    subtitle: "Find weight specs, prices, and reviews for thousands of outdoor products",
                    systemImage: "magnifyingglass"
                )
            } else {
                ScrollView {
                    itemGrid(vm: vm)
                        .padding(.bottom)
                }
            }
        }
        // The active category becomes the title, the way Mail titles a mailbox.
        .navigationTitle(vm.selectedCategory?.catalogCategoryDisplayName ?? "Gear Catalog")
        // Guests get no search field at all: catalog search is server-backed, so
        // an editable field above "Catalog Requires an Account" is a dead input
        // that accepts a query it can never answer.
        .catalogSearchable(text: $vm.searchText, enabled: authManager.isAuthenticated)
        .onChange(of: vm.searchText) {
            if authManager.isAuthenticated {
                vm.onSearchTextChanged()
            }
        }
        .task {
            if authManager.isAuthenticated {
                await vm.loadIfNeeded()
            }
        }
        .onSubmit(of: .search) {
            if authManager.isAuthenticated {
                Task { await vm.search(reset: true) }
            }
        }
        .toolbar {
            // Search spans every category, so the filter only shows while browsing.
            if authManager.isAuthenticated && !vm.categories.isEmpty && vm.searchText.isEmpty {
                ToolbarItem(placement: .primaryAction) {
                    categoryMenu(vm: vm)
                }
            }
            // A re-search over an already-populated list: the footer belongs to
            // paging, so this reports the refresh instead.
            if vm.isLoading && !vm.items.isEmpty {
                if #available(iOS 26, macOS 26, *) {
                    // A status indicator, not a control: without this it sits in a
                    // button-sized glass pill of its own and reads as oversized.
                    ToolbarItem(placement: Self.refreshSpinnerPlacement) {
                        ProgressView().controlSize(.small)
                    }
                    .sharedBackgroundVisibility(.hidden)
                } else {
                    ToolbarItem(placement: Self.refreshSpinnerPlacement) {
                        ProgressView().controlSize(.small)
                    }
                }
            }
        }
    }

    // Mac centres secondary items in the toolbar; status reads best beside the search field.
    private static var refreshSpinnerPlacement: ToolbarItemPlacement {
        #if os(macOS)
        .primaryAction
        #else
        .secondaryAction
        #endif
    }

    private func categoryMenu(vm: CatalogViewModel) -> some View {
        Menu {
            Picker("Category", selection: Binding(
                get: { vm.selectedCategory },
                set: { vm.selectCategory($0) }
            )) {
                Text("All Gear").tag(String?.none)
                ForEach(vm.categories, id: \.self) { category in
                    Text(category.catalogCategoryDisplayName).tag(String?.some(category))
                }
            }
        } label: {
            Label(
                "Filter",
                systemImage: vm.selectedCategory == nil
                    ? "line.3.horizontal.decrease.circle"
                    : "line.3.horizontal.decrease.circle.fill"
            )
        }
        .accessibilityIdentifier("catalog_category_filter")
    }

    private func itemGrid(vm: CatalogViewModel) -> some View {
        LazyVStack(spacing: 0) {
            ForEach(vm.items) { item in
                CatalogItemRow(item: item, packsViewModel: appState.packsVM)
                    // Paging is driven by the row, not the divider below it: the
                    // divider is a zero-height view that LazyVStack may never
                    // consider on-screen. An unstructured Task, not `.task`, so
                    // the page fetch survives the row scrolling away instead of
                    // being cancelled mid-request.
                    .onAppear {
                        if item.id == vm.items.last?.id {
                            Task { await vm.loadMore() }
                        }
                    }
                Divider().padding(.leading, 76)
            }

            // The footer stays in the layout for the whole page fetch, so the
            // spinner is on screen where the user is already looking — at the
            // bottom of the list they just scrolled to. Reserving the height
            // when idle also stops the list jumping as each page arrives.
            if vm.isLoadingMore {
                ProgressView()
                    .controlSize(.small)
                    .padding(.vertical, 16)
                    .frame(maxWidth: .infinity)
                    .accessibilityIdentifier("catalog_loading_more")
            } else if vm.hasMore {
                Color.clear.frame(height: 44)
            }
        }
        .accessibilityIdentifier("catalog_results_list")
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }
}

private extension View {
    /// Attaches the catalog search field only when it can actually search.
    ///
    /// `.searchable` cannot be applied conditionally inline — the two branches
    /// are different opaque types — so the choice happens here instead.
    @ViewBuilder
    func catalogSearchable(text: Binding<String>, enabled: Bool) -> some View {
        if enabled {
            #if os(iOS)
            searchable(
                text: text,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: "Search tents, packs, sleeping bags…"
            )
            #else
            searchable(text: text, prompt: "Search tents, packs, sleeping bags…")
            #endif
        } else {
            self
        }
    }
}

// MARK: - Catalog item row with Add to Pack

struct CatalogItemRow: View {
    let item: CatalogItem
    let packsViewModel: PacksViewModel
    @State private var showingAddToPack = false
    @Environment(\.weightUnit) private var weightUnit

    var body: some View {
        NavigationLink {
            CatalogItemDetailView(item: item, packsViewModel: packsViewModel, isPushed: true)
        } label: {
            rowContent.contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("catalog_item_row_\(item.id)")
        .sheet(isPresented: $showingAddToPack) {
                AddCatalogItemToPackSheet(item: item, packsViewModel: packsViewModel)
            }
    }

    private var rowContent: some View {
        HStack(spacing: 12) {
            RemoteImage(url: item.primaryImage, contentMode: .fill, cornerRadius: 8) {
                CatalogArtwork(item: item)
            }
            .frame(width: 56, height: 56)

            VStack(alignment: .leading, spacing: 4) {
                Text(item.displayName)
                    .font(.headline)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                ViewThatFits(in: .horizontal) {
                    metadataRow
                    metadataFlow
                }
                if let cats = item.categories, !cats.isEmpty {
                    Text(cats.prefix(2).joined(separator: " · "))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }
            }
            .layoutPriority(1)

            Spacer(minLength: 8)

            VStack(alignment: .trailing, spacing: 4) {
                if let rating = item.ratingValue, rating > 0 {
                    HStack(spacing: 2) {
                        Image(systemName: "star.fill").font(.caption2).foregroundStyle(.yellow)
                        Text(String(format: "%.1f", rating))
                            .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                    }
                    .fixedSize(horizontal: true, vertical: false)
                }
                if !item.isInStock {
                    Text("Out of Stock")
                        .font(.caption2).foregroundStyle(.red)
                        .lineLimit(1)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(.red.opacity(0.1), in: Capsule())
                        .fixedSize(horizontal: true, vertical: false)
                }

                Button {
                    showingAddToPack = true
                } label: {
                    Label("Add to Pack", systemImage: "plus.circle")
                        .font(.caption)
                        .labelStyle(.iconOnly)
                        .foregroundStyle(.tint)
                }
                .buttonStyle(.plain)
                .help("Add to pack")
                .accessibilityIdentifier("catalog_item_add_to_pack_\(item.id)")
                .accessibilityLabel("Add to Pack")
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private var metadataRow: some View {
        HStack(spacing: 8) {
            metadataItems
        }
        .lineLimit(1)
    }

    private var metadataFlow: some View {
        VStack(alignment: .leading, spacing: 2) {
            metadataItems
        }
    }

    @ViewBuilder
    private var metadataItems: some View {
        if let brand = item.displayBrand {
            Text(brand)
                .font(.caption.bold())
                .foregroundStyle(.tint)
                .lineLimit(1)
        }
        if !item.displayWeight.isEmpty {
            Label(item.displayWeight(in: weightUnit), systemImage: "scalemass")
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        if let price = item.displayPrice {
            Text(price)
                .font(.caption.bold())
                .foregroundStyle(.green)
                .lineLimit(1)
        }
    }
}

struct CatalogArtwork: View {
    let item: CatalogItem
    var iconSize: CGFloat = 22

    var body: some View {
        RoundedRectangle(cornerRadius: 8, style: .continuous)
            .fill(tint.opacity(0.14))
            .overlay {
                Image(systemName: symbol)
                    .font(.system(size: iconSize, weight: .semibold))
                    .foregroundStyle(tint)
            }
            .accessibilityHidden(true)
    }

    private var symbol: String {
        let category = item.categories?.first?.lowercased() ?? ""
        if category.contains("tent") || category.contains("shelter") { return "tent" }
        if category.contains("pack") || category.contains("backpack") { return "backpack" }
        if category.contains("sleep") || category.contains("bag") || category.contains("quilt") { return "moon.zzz" }
        if category.contains("water") || category.contains("filter") || category.contains("hydration") { return "drop" }
        if category.contains("cook") || category.contains("food") || category.contains("kitchen") { return "fork.knife" }
        if category.contains("cloth") || category.contains("jacket") || category.contains("rain") { return "tshirt" }
        if category.contains("light") || category.contains("lamp") { return "flashlight.on.fill" }
        if category.contains("safety") || category.contains("first aid") { return "cross.case" }
        return "mountain.2"
    }

    private var tint: Color {
        let category = item.categories?.first?.lowercased() ?? ""
        if category.contains("water") || category.contains("filter") || category.contains("hydration") { return .cyan }
        if category.contains("cook") || category.contains("food") || category.contains("kitchen") { return .orange }
        if category.contains("safety") || category.contains("first aid") { return .red }
        if category.contains("sleep") || category.contains("bag") || category.contains("quilt") { return .indigo }
        if category.contains("cloth") || category.contains("jacket") || category.contains("rain") { return .teal }
        return .blue
    }
}

// MARK: - Add to Pack sheet

struct AddCatalogItemToPackSheet: View {
    let item: CatalogItem
    let packsViewModel: PacksViewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Environment(\.weightUnit) private var weightUnit

    @State private var selectedPackId: String?
    @State private var quantity = 1
    @State private var category: String
    @State private var error: String?
    @State private var success = false

    init(item: CatalogItem, packsViewModel: PacksViewModel) {
        self.item = item
        self.packsViewModel = packsViewModel
        _category = State(initialValue: item.categories?.first ?? "")
    }

    private var categorySuggestions: [String] {
        let packItems = packsViewModel.packs.first { $0.id == selectedPackId }?.items ?? []
        return CatalogCategorySuggestions.make(
            catalogCategories: item.categories ?? [],
            packCategories: packItems.filter { !$0.deleted }.map(\.category)
        )
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Item") {
                    LabeledContent("Name") { Text(item.displayName) }
                    if !item.displayWeight.isEmpty {
                        LabeledContent("Weight") { Text(item.displayWeight(in: weightUnit)) }
                    }
                    if let brand = item.displayBrand {
                        LabeledContent("Brand") { Text(brand) }
                    }
                }

                Section("Add to") {
                    Picker("Pack", selection: $selectedPackId) {
                        Text("Select a pack…").tag(nil as String?)
                        ForEach(packsViewModel.packs) { pack in
                            Text(pack.name).tag(pack.id as String?)
                        }
                    }
                    Stepper("Quantity: \(quantity)", value: $quantity, in: 1...99)
                }

                Section("Category") {
                    TextField("Category", text: $category)
                        .accessibilityIdentifier("catalog_add_category_field")
                    if !categorySuggestions.isEmpty {
                        categoryChips
                    }
                }

                if let error { Section { InlineErrorView(message: error) } }

                if success {
                    Section {
                        Label("Added to pack!", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    }
                }
            }
            .packRatFormStyle()
            .navigationTitle("Add to Pack")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    AsyncButton("Add") {
                        await addToPack()
                    }
                    .disabled(selectedPackId == nil)
                }
            }
        }
        .formSheetSize(minWidth: 480, minHeight: 460)
    }

    private var categoryChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(categorySuggestions, id: \.self) { suggestion in
                    let isSelected = CatalogCategorySuggestions.matches(suggestion, category)
                    Button {
                        category = suggestion
                    } label: {
                        Text(suggestion)
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
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                    .accessibilityIdentifier("catalog_add_category_chip_\(suggestion)")
                }
            }
            .padding(.vertical, 2)
        }
        .accessibilityIdentifier("catalog_add_category_chips")
    }

    private func addToPack() async {
        guard let packId = selectedPackId else { return }
        error = nil
        do {
            try await packsViewModel.addItem(
                to: packId,
                name: item.displayName,
                weight: item.weight ?? 0,
                weightUnit: item.weightUnit?.rawValue ?? WeightUnit.g.rawValue,
                quantity: quantity,
                category: trimmedCategory.isEmpty ? nil : trimmedCategory,
                consumable: false,
                worn: false,
                notes: nil,
                context: modelContext
            )
            success = true
            Task {
                try? await Task.sleep(for: .seconds(1.5))
                dismiss()
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    private var trimmedCategory: String {
        category.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

/// Category suggestions for the Add to Pack sheet: the catalog item's own
/// categories first, then the groups already used in the target pack, so a
/// familiar group is one tap away. Matches Android's ordering and cap.
enum CatalogCategorySuggestions {
    static let limit = 8

    static func make(catalogCategories: [String], packCategories: [String?]) -> [String] {
        var seen = Set<String>()
        var result: [String] = []
        for raw in catalogCategories.map(Optional.some) + packCategories {
            guard let value = raw?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !value.isEmpty,
                  seen.insert(value.lowercased()).inserted
            else { continue }
            result.append(value)
        }
        return Array(result.prefix(limit))
    }

    static func matches(_ suggestion: String, _ category: String) -> Bool {
        suggestion.lowercased() == category.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}
