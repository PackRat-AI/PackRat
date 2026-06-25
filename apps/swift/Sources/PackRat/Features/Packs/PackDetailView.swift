import SwiftUI
import Charts
import Collections

struct PackDetailView: View {
    let pack: Pack
    @Bindable var viewModel: PacksViewModel

    @State private var showingEditSheet = false
    @State private var showingAddItemSheet = false
    @State private var showingGapAnalysis = false
    @State private var showingWeightAnalysis = false
    @State private var editingItem: PackItem?
    @State private var detailItem: PackItem?
    @State private var error: String?
    @State private var dropTargetCategory: String?
    @State private var triggerShare = false

    private var currentPack: Pack {
        viewModel.packs.first { $0.id == pack.id } ?? pack
    }

    private var items: [PackItem] { currentPack.activeItems }

    private var packShareURL: URL? {
        URL(string: "https://packrat.world/packs/\(currentPack.id)")
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                weightSummary
                    .padding(.horizontal)

                PackWeightChart(pack: currentPack)

                if let error {
                    InlineErrorView(message: error)
                        .padding(.horizontal)
                }

                LazyVStack(alignment: .leading, spacing: 0, pinnedViews: .sectionHeaders) {
                    let groups = OrderedDictionary(grouping: items, by: { $0.category ?? "Uncategorized" })
                    ForEach(groups.keys.elements, id: \.self) { category in
                        Section {
                            ForEach(groups[category] ?? []) { item in
                                PackItemRow(item: item) {
                                    editingItem = item
                                } onDelete: {
                                    Task {
                                        do {
                                    try await viewModel.deleteItem(item.id, from: currentPack.id)
                                        } catch {
                                            self.error = error.localizedDescription
                                        }
                                    }
                                } onDetail: {
                                    detailItem = item
                                }
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
            ToolbarItem(placement: .primaryAction) {
                Button("Add Item", systemImage: "plus") {
                    showingAddItemSheet = true
                }
                .accessibilityIdentifier("pack_detail_add_item_button")
                .keyboardShortcut("i", modifiers: .command)
            }
            ToolbarItem(placement: .primaryAction) {
                Menu {
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
        .navigationDestination(isPresented: $showingWeightAnalysis) {
            PackWeightAnalysisView(pack: currentPack)
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
        // Drop target: dragged item IDs get re-categorized here
        .dropDestination(for: String.self) { itemIds, _ in
            guard let itemId = itemIds.first,
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
                        notes: item.notes
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
            weightCard("Total", value: pack.totalWeight, color: .blue)
            weightCard("Base", value: pack.baseWeight, color: .green)
            weightCard("Worn", value: pack.wornWeight, color: .orange)
            weightCard("Consumable", value: pack.consumableWeight, color: .purple)
        }
    }

    private func weightCard(_ label: String, value: Double?, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(currentPack.formattedWeight(value))
                .font(.callout.monospacedDigit().bold())
                .foregroundStyle(color)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }
}
