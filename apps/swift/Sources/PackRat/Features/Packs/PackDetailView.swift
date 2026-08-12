import SwiftUI
import Charts
import Collections
import SwiftData

struct PackDetailView: View {
    let pack: Pack
    @Bindable var viewModel: PacksViewModel

    init(pack: Pack, viewModel: PacksViewModel) {
        self.pack = pack
        self.viewModel = viewModel
    }

    @State private var showingEditSheet = false
    @State private var showingAddItemSheet = false
    @State private var showingGapAnalysis = false
    @State private var showingWeightAnalysis = false
    @State private var showingAskAI = false
    @State private var showingCatalogBrowser = false
    @State private var showingItemsScan = false
    @State private var editingItem: PackItem?
    @State private var detailItem: PackItem?
    @State private var error: String?
    @State private var dropTargetCategory: String?
    @State private var triggerShare = false
    @State private var itemPendingDeletion: PackItem?
    @State private var showingDeleteConfirmation = false
    @Environment(\.modelContext) private var modelContext
    @Environment(\.weightUnit) private var weightUnit
    @State private var statusMessage: String?

    // MARK: Packing mode

    @State private var isPackingMode = false
    @State private var packingFilter: PackingFilter = .all
    private var packingStore = PackingModeStore.shared

    enum PackingFilter: String, CaseIterable, Identifiable {
        case all, unpacked, packed
        var id: String { rawValue }
        var label: String {
            switch self {
            case .all:      return "All"
            case .unpacked: return "Unpacked"
            case .packed:   return "Packed"
            }
        }
    }

    private var currentPack: Pack {
        viewModel.packs.first { $0.id == pack.id } ?? pack
    }

    private var items: [PackItem] { currentPack.activeItems }

    /// Items after the packing-mode filter. Outside packing mode this is every
    /// item, so the normal browsing view is unaffected.
    private var visibleItems: [PackItem] {
        guard isPackingMode else { return items }
        switch packingFilter {
        case .all:
            return items
        case .packed:
            return items.filter { packingStore.isPacked($0.id, in: currentPack.id) }
        case .unpacked:
            return items.filter { !packingStore.isPacked($0.id, in: currentPack.id) }
        }
    }

    private var packedCount: Int {
        packingStore.packedCount(in: currentPack.id, among: items.map(\.id))
    }

    private var packingProgress: Double {
        guard !items.isEmpty else { return 0 }
        return Double(packedCount) / Double(items.count)
    }

    private var progressTint: Color {
        switch packingProgress {
        case 1...:      return .green
        case 0.5..<1:   return .blue
        default:        return .orange
        }
    }

    private var packShareURL: URL? {
        URL(string: "https://packrat.world/packs/\(currentPack.id)")
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if isPackingMode {
                    packingHeader
                        .padding(.horizontal)
                } else {
                    weightSummary
                        .padding(.horizontal)

                    PackWeightChart(pack: currentPack)

                    if packedCount > 0 {
                        packingResumeSummary
                            .padding(.horizontal)
                    }
                }

                if let error {
                    InlineErrorView(message: error)
                        .padding(.horizontal)
                }

                LazyVStack(alignment: .leading, spacing: 0, pinnedViews: .sectionHeaders) {
                    let groups = OrderedDictionary(grouping: visibleItems, by: { $0.category ?? "Uncategorized" })
                    ForEach(groups.keys.elements, id: \.self) { category in
                        Section {
                            ForEach(groups[category] ?? []) { item in
                                PackItemRow(
                                    item: item,
                                    onEdit: { editingItem = item },
                                    // Keep the confirmation flow from
                                    // development rather than deleting inline.
                                    onDelete: { requestDelete(item) },
                                    onDetail: { detailItem = item },
                                    packingState: isPackingMode
                                        ? PackItemRow.PackingRowState(
                                            isPacked: packingStore.isPacked(item.id, in: currentPack.id),
                                            onTogglePacked: {
                                                packingStore.toggle(itemId: item.id, in: currentPack.id)
                                            }
                                          )
                                        : nil
                                )
                                Divider().padding(.leading)
                            }
                        } header: {
                            categoryHeader(category, groups: groups)
                        }
                    }

                    if items.isEmpty {
                        EmptyStateView(
                            "No Items Yet",
                            subtitle: "Add gear to build your pack",
                            systemImage: "archivebox",
                            actionLabel: "Add Item",
                            action: { showingAddItemSheet = true }
                        )
                        .frame(minHeight: 200)
                    } else if visibleItems.isEmpty {
                        // Packing filter matched nothing — distinct from an
                        // empty pack, so don't offer "Add Item" here.
                        EmptyStateView(
                            packingFilter == .packed ? "Nothing Packed Yet" : "Everything's Packed",
                            subtitle: packingFilter == .packed
                                ? "Check items off as you put them in your bag."
                                : "Every item in this pack is checked off. Nice.",
                            systemImage: packingFilter == .packed ? "circle" : "checkmark.circle.fill"
                        )
                        .frame(minHeight: 200)
                        .accessibilityIdentifier("pack_packing_filter_empty")
                    }
                }
            }
            .padding(.bottom)
        }
        .navigationTitle(currentPack.name)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.large)
        #endif
        .toolbar {
            if isPackingMode {
                ToolbarItem(placement: .primaryAction) {
                    Button("Done") { exitPackingMode() }
                        .bold()
                        .accessibilityIdentifier("pack_detail_done_packing")
                }
            } else {
                // One group rather than two separate ToolbarItems — these two
                // controls belong together and a group states that directly.
                ToolbarItemGroup(placement: .primaryAction) {
                    // A plain pull-down Menu: one tap opens it, every option is
                    // visible. Deliberately *not* a `primaryAction` menu — that
                    // variant hides the extra choices behind a long press, which
                    // nothing on screen advertises, so most users would only ever
                    // find "Add Manually". Expo shows the same three in a bottom
                    // sheet; a pull-down menu is the iOS-idiomatic equivalent
                    // (cf. AIPacksView, which swaps Expo's alert for
                    // .confirmationDialog on the same reasoning).
                    Menu {
                        Button("Add Manually", systemImage: "square.and.pencil") {
                            showingAddItemSheet = true
                        }
                        .accessibilityIdentifier("pack_detail_add_manually")

                        Button("Scan Items from Photo", systemImage: "camera.viewfinder") {
                            showingItemsScan = true
                        }
                        .accessibilityIdentifier("pack_detail_scan_photo")

                        Button("Add from Catalog", systemImage: "magnifyingglass") {
                            showingCatalogBrowser = true
                        }
                        .accessibilityIdentifier("pack_detail_add_from_catalog")
                    } label: {
                        // .iconOnly matches the More menu below, so the two
                        // toolbar controls are declared consistently.
                        Label("Add Item", systemImage: "plus")
                            .labelStyle(.iconOnly)
                    }
                    .accessibilityIdentifier("pack_detail_add_item_button")
                    .accessibilityLabel("Add Item")

                    Menu {
                        Button("Ask AI", systemImage: "sparkles") {
                            showingAskAI = true
                        }
                        .accessibilityIdentifier("pack_detail_ask_ai")

                        Button("Start Packing", systemImage: "checklist") {
                            startPackingMode()
                        }
                        .disabled(items.isEmpty)
                        .accessibilityIdentifier("pack_detail_start_packing")

                        Divider()

                        Button("Weight Analysis", systemImage: "chart.bar.fill") {
                            showingWeightAnalysis = true
                        }
                        .disabled(items.isEmpty)

                        Button("Gap Analysis", systemImage: "sparkles.magnifyingglass") {
                            showingGapAnalysis = true
                        }
                        .disabled(items.isEmpty)

                        if currentPack.isPublic == true, let shareURL = packShareURL {
                            ShareLink(item: shareURL, subject: Text(currentPack.name),
                                      message: Text("Check out my pack on PackRat")) {
                                Label("Share", systemImage: "square.and.arrow.up")
                            }
                        }

                        Divider()

                        Button("Edit Pack", systemImage: "pencil") {
                            showingEditSheet = true
                        }
                        .accessibilityIdentifier("pack_detail_edit_pack")
                        .keyboardShortcut("e", modifiers: .command)
                    } label: {
                        Label("More", systemImage: "ellipsis.circle")
                            .labelStyle(.iconOnly)
                    }
                    .accessibilityIdentifier("pack_detail_more_menu")
                    .accessibilityLabel("More")
                }
            }
        }
        .sheet(isPresented: $showingEditSheet) {
            PackFormView(viewModel: viewModel, existingPack: currentPack)
        }
        .sheet(isPresented: $showingAddItemSheet) {
            PackItemFormView(packId: currentPack.id, viewModel: viewModel)
        }
        .sheet(item: $editingItem) { item in
            PackItemFormView(packId: currentPack.id, viewModel: viewModel, existingItem: item)
        }
        .sheet(item: $detailItem) { item in
            PackItemDetailView(item: item, packId: currentPack.id, viewModel: viewModel)
        }
        .sheet(isPresented: $showingGapAnalysis) {
            GapAnalysisSheet(pack: currentPack, service: viewModel.service)
        }
        // See PacksListView: alert actions must be bare `Button`s — a modifier
        // on one wraps it in `ModifiedContent` and the alert degrades into a
        // clipped popover with buttons dropped.
        .alert(deleteItemAlertTitle, isPresented: $showingDeleteConfirmation) {
            Button("Delete", role: .destructive) {
                if let item = itemPendingDeletion { deleteItem(item) }
            }
            Button("Cancel", role: .cancel) { itemPendingDeletion = nil }
        } message: {
            Text(deleteItemAlertMessage)
        }
        .sheet(isPresented: $showingAskAI) {
            PackAskAISheet(pack: currentPack)
        }
        .sheet(isPresented: $showingCatalogBrowser) {
            PackCatalogBrowserSheet(
                packId: currentPack.id,
                packsViewModel: viewModel,
                onAdded: { added, failed in
                    statusMessage = addedStatusMessage(
                        added: added, failed: failed, source: "the catalog"
                    )
                }
            )
        }
        .sheet(isPresented: $showingItemsScan) {
            PackItemsScanSheet(
                packId: currentPack.id,
                packsViewModel: viewModel,
                onAdded: { added, failed in
                    statusMessage = addedStatusMessage(
                        added: added, failed: failed, source: "your photo"
                    )
                }
            )
        }
        .navigationDestination(isPresented: $showingWeightAnalysis) {
            PackWeightAnalysisView(pack: currentPack)
        }
        // ⌘I opens the manual add form directly. It can't live on the Add Item
        // toolbar Menu — the shortcut would merely open the menu — and a
        // `.hidden()` toolbar button still reserves its layout footprint. A
        // zero-size background button carries the shortcut without occupying
        // space in the bar.
        .background {
            Button("Add Item Manually") { showingAddItemSheet = true }
                .keyboardShortcut("i", modifiers: .command)
                .frame(width: 0, height: 0)
                .opacity(0)
                .accessibilityHidden(true)
        }
        .focusedSceneValue(\.sharePackAction, $triggerShare)
        .onChange(of: triggerShare) { _, new in
            if new, currentPack.isPublic == true, let url = packShareURL {
                #if os(macOS)
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(url.absoluteString, forType: .string)
                #endif
                triggerShare = false
            }
        }
        .safeAreaInset(edge: .bottom) {
            if isPackingMode {
                packingToolbar
            }
        }
        .overlay(alignment: .bottom) {
            if let statusMessage {
                Text(statusMessage)
                    .font(.callout.weight(.medium))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(.regularMaterial, in: Capsule())
                    .shadow(radius: 8, y: 2)
                    .padding(.bottom, 24)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .accessibilityIdentifier("pack_detail_status_toast")
                    .task(id: statusMessage) {
                        let shown = statusMessage
                        // `try?` would swallow the cancellation a replacing toast
                        // causes, and the old task would then clear the new
                        // message early. Bail on cancellation, and only clear
                        // what this task actually put up.
                        do {
                            try await Task.sleep(for: .seconds(2.5))
                        } catch {
                            return
                        }
                        if self.statusMessage == shown {
                            withAnimation { self.statusMessage = nil }
                        }
                    }
            }
        }
        .animation(.spring(duration: 0.3), value: statusMessage)
        .animation(.easeInOut(duration: 0.2), value: isPackingMode)
    }

    /// Toast copy for a bulk add. A partial failure has to say so — reporting
    /// only the successes leaves the user believing everything landed.
    ///
    /// Pluralized in Swift rather than with `^[…](inflect: true)` markup: that
    /// markup is only resolved for strings that go through a localization
    /// catalog, and this target ships no `.xcstrings`, so it rendered verbatim.
    private func addedStatusMessage(added: Int, failed: Int, source: String) -> String {
        if failed > 0 {
            return "Added \(Self.itemCountPhrase(added)), \(Self.itemCountPhrase(failed)) couldn't be added"
        }
        return "Added \(Self.itemCountPhrase(added)) from \(source)"
    }

    private static func itemCountPhrase(_ count: Int) -> String {
        "\(count) \(count == 1 ? "item" : "items")"
    }

    // MARK: - Packing mode

    private func startPackingMode() {
        packingFilter = .all
        isPackingMode = true
    }

    private func exitPackingMode() {
        isPackingMode = false
        packingFilter = .all
    }

    /// Shown at the top of the list while packing: how far along you are.
    private var packingHeader: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("\(packedCount) of \(items.count) packed")
                    .font(.headline.monospacedDigit())
                Spacer()
                Text("\(Int(packingProgress * 100))%")
                    .font(.subheadline.monospacedDigit().bold())
                    .foregroundStyle(progressTint)
            }

            ProgressView(value: packingProgress)
                .tint(progressTint)

            Picker("Filter", selection: $packingFilter) {
                ForEach(PackingFilter.allCases) { filter in
                    Text(filter.label).tag(filter)
                }
            }
            .pickerStyle(.segmented)
            .accessibilityIdentifier("pack_packing_filter")
        }
        .padding(14)
        .background(progressTint.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .accessibilityIdentifier("pack_packing_header")
    }

    /// Shown outside packing mode when a pass is already underway, so progress
    /// isn't invisible until you re-enter the mode.
    private var packingResumeSummary: some View {
        Button { startPackingMode() } label: {
            HStack(spacing: 12) {
                Image(systemName: packedCount == items.count ? "checkmark.circle.fill" : "checklist")
                    .font(.title3)
                    .foregroundStyle(progressTint)
                VStack(alignment: .leading, spacing: 3) {
                    Text(packedCount == items.count ? "Pack is fully packed" : "Packing in progress")
                        .font(.subheadline.weight(.medium))
                    Text("\(packedCount) of \(items.count) items checked off")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding(12)
            .background(progressTint.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("pack_packing_resume")
    }

    private var packingToolbar: some View {
        HStack {
            Button("Reset", systemImage: "arrow.counterclockwise") {
                packingStore.reset(packId: currentPack.id)
            }
            .disabled(packedCount == 0)
            .accessibilityIdentifier("pack_packing_reset")

            Spacer()

            Button("Mark All Packed", systemImage: "checkmark.circle") {
                for item in items {
                    packingStore.setPacked(true, itemId: item.id, in: currentPack.id)
                }
            }
            .disabled(packedCount == items.count)
            .accessibilityIdentifier("pack_packing_mark_all")
        }
        .font(.callout)
        .labelStyle(.titleAndIcon)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.bar)
    }

    private var deleteItemAlertTitle: String {
        "Delete \(itemPendingDeletion?.name ?? "Item")?"
    }

    private var deleteItemAlertMessage: String {
        guard let item = itemPendingDeletion else { return "" }
        return "\"\(item.name)\" will be removed from this pack. This cannot be undone."
    }

    /// Captures the row that requested deletion, then presents the alert.
    private func requestDelete(_ item: PackItem) {
        itemPendingDeletion = item
        showingDeleteConfirmation = true
    }

    private func deleteItem(_ item: PackItem) {
        itemPendingDeletion = nil
        Task {
            do {
                try await viewModel.deleteItem(item.id, from: currentPack.id, context: modelContext)
                error = nil
            } catch {
                self.error = error.localizedDescription
            }
        }
    }

    private func categoryHeader(_ category: String, groups: OrderedDictionary<String, [PackItem]>) -> some View {
        let isTarget = dropTargetCategory == category
        return HStack {
            Text(category.capitalized)
                .font(.caption.uppercaseSmallCaps())
                .foregroundStyle(.secondary)
            Spacer()
            Text("\(groups[category]?.count ?? 0) items")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(isTarget ? Color.accentColor.opacity(0.12) : Color.clear)
        .overlay(alignment: .bottom) {
            if isTarget {
                Rectangle().fill(Color.accentColor).frame(height: 2)
            }
        }
        // Drop target: dragged item IDs get re-categorized here. Disabled while
        // packing — rows aren't draggable in that mode, and a stray drop
        // shouldn't recategorize gear mid-checklist.
        .dropDestination(for: String.self) { itemIds, _ in
            guard !isPackingMode,
                  let itemId = itemIds.first,
                  let item = items.first(where: { $0.id == itemId }),
                  item.category != category else { return false }
            Task {
                do {
                    try await viewModel.updateItem(
                        itemId, in: currentPack.id,
                        name: item.name,
                        weight: item.weight,
                        weightUnit: item.weightUnit.rawValue,
                        quantity: item.effectiveQuantity,
                        category: category == "Uncategorized" ? nil : category,
                        consumable: item.consumable,
                        worn: item.worn,
                        notes: item.notes,
                        context: modelContext
                    )
                } catch {
                    self.error = error.localizedDescription
                }
            }
            return true
        } isTargeted: { targeted in
            dropTargetCategory = targeted ? category : nil
        }
    }

    private var weightSummary: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            // `currentPack`, not the captured `pack`: the latter is a stale snapshot
            // from when the view was pushed, so totals kept showing weights for items
            // the live pack no longer has (empty list next to a non-zero total).
            weightCard("Total", value: currentPack.totalWeight, color: .blue)
            weightCard("Base", value: currentPack.baseWeight, color: .green)
            weightCard("Worn", value: currentPack.wornWeight, color: .orange)
            weightCard("Consumable", value: currentPack.consumableWeight, color: .purple)
        }
    }

    private func weightCard(_ label: String, value: Double?, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(currentPack.formattedWeight(value, in: weightUnit))
                .font(.callout.monospacedDigit().bold())
                .foregroundStyle(color)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }
}
