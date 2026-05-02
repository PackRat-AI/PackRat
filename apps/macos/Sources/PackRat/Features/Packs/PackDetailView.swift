import SwiftUI

struct PackDetailView: View {
    let pack: Pack
    let viewModel: PacksViewModel

    @State private var showingEditSheet = false
    @State private var showingAddItemSheet = false
    @State private var editingItem: PackItem?
    @State private var error: String?

    private var items: [PackItem] { pack.activeItems }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                weightSummary
                    .padding(.horizontal)

                if let error {
                    InlineErrorView(message: error)
                        .padding(.horizontal)
                }

                LazyVStack(alignment: .leading, spacing: 0, pinnedViews: .sectionHeaders) {
                    let groups = Dictionary(grouping: items, by: { $0.category ?? "Uncategorized" })
                    ForEach(groups.keys.sorted(), id: \.self) { category in
                        Section {
                            ForEach(groups[category] ?? []) { item in
                                PackItemRow(item: item) {
                                    editingItem = item
                                } onDelete: {
                                    Task {
                                        do {
                                            try await viewModel.deleteItem(item.id, from: pack.id)
                                        } catch {
                                            self.error = error.localizedDescription
                                        }
                                    }
                                }
                                Divider().padding(.leading)
                            }
                        } header: {
                            Text(category.capitalized)
                                .font(.caption.uppercaseSmallCaps())
                                .foregroundStyle(.secondary)
                                .padding(.horizontal)
                                .padding(.vertical, 6)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(.background)
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
            .padding(.vertical)
        }
        .navigationTitle(pack.name)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.large)
        #endif
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                Button("Add Item", systemImage: "plus") {
                    showingAddItemSheet = true
                }
                Button("Edit", systemImage: "pencil") {
                    showingEditSheet = true
                }
            }
        }
        .sheet(isPresented: $showingEditSheet) {
            PackFormView(viewModel: viewModel, existingPack: pack)
        }
        .sheet(isPresented: $showingAddItemSheet) {
            PackItemFormView(packId: pack.id, viewModel: viewModel)
        }
        .sheet(item: $editingItem) { item in
            PackItemFormView(packId: pack.id, viewModel: viewModel, existingItem: item)
        }
    }

    private var weightSummary: some View {
        HStack(spacing: 16) {
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
            Text(pack.formattedWeight(value))
                .font(.callout.monospacedDigit().bold())
                .foregroundStyle(color)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }
}
