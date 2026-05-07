import SwiftUI

// MARK: - Models

struct GearItem: Identifiable {
    let id: String
    let name: String
    let category: String?
    let weightInGrams: Double
    let quantity: Int
    let packName: String
}

// MARK: - View

struct GearInventoryView: View {
    @Environment(AppState.self) private var appState
    @State private var searchText = ""
    @State private var sortOrder: SortOrder = .name

    enum SortOrder: String, CaseIterable {
        case name = "Name"
        case weight = "Weight"
        case category = "Category"
    }

    private var allItems: [GearItem] {
        appState.packsVM.packs.flatMap { pack in
            pack.activeItems.map { item in
                GearItem(
                    id: "\(pack.id)-\(item.id)",
                    name: item.name,
                    category: item.category,
                    weightInGrams: item.weightInGrams,
                    quantity: item.quantity,
                    packName: pack.name
                )
            }
        }
    }

    private var filteredItems: [GearItem] {
        let items = searchText.isEmpty ? allItems : allItems.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            ($0.category?.localizedCaseInsensitiveContains(searchText) == true)
        }
        switch sortOrder {
        case .name:     return items.sorted { $0.name < $1.name }
        case .weight:   return items.sorted { $0.weightInGrams > $1.weightInGrams }
        case .category: return items.sorted { ($0.category ?? "") < ($1.category ?? "") }
        }
    }

    private var totalWeight: Double {
        allItems.reduce(0) { $0 + $1.weightInGrams * Double($1.quantity) }
    }

    var body: some View {
        Group {
            if appState.packsVM.isLoading && appState.packsVM.packs.isEmpty {
                ProgressView("Loading inventory…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if allItems.isEmpty {
                EmptyStateView(
                    "No Gear Yet",
                    subtitle: "Add items to your packs to see them here",
                    systemImage: "shippingbox"
                )
            } else {
                inventoryList
            }
        }
        .navigationTitle("Gear Inventory")
        .searchable(text: $searchText, prompt: "Search gear")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Picker("Sort", selection: $sortOrder) {
                    ForEach(SortOrder.allCases, id: \.self) { order in
                        Text(order.rawValue).tag(order)
                    }
                }
                .pickerStyle(.menu)
            }
        }
        .task { await appState.packsVM.load() }
        .refreshable { await appState.packsVM.load() }
    }

    private var inventoryList: some View {
        List {
            Section {
                HStack(spacing: 16) {
                    statChip(value: "\(allItems.count)", label: "Items", symbol: "archivebox.fill")
                    statChip(value: formattedWeight(totalWeight), label: "Total", symbol: "scalemass.fill")
                    statChip(value: "\(appState.packsVM.packs.count)", label: "Packs", symbol: "backpack.fill")
                }
                .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                .listRowBackground(Color.clear)
            }

            ForEach(filteredItems) { item in
                GearItemRow(item: item)
            }
        }
        #if os(iOS)
        .listStyle(.insetGrouped)
        #endif
    }

    private func statChip(value: String, label: String, symbol: String) -> some View {
        VStack(spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: symbol)
                    .font(.caption2)
                    .foregroundStyle(Color.accentColor)
                Text(value)
                    .font(.subheadline.bold())
            }
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 10))
    }

    private func formattedWeight(_ grams: Double) -> String {
        if grams >= 1000 {
            return String(format: "%.1fkg", grams / 1000)
        }
        return String(format: "%.0fg", grams)
    }
}

// MARK: - Row

private struct GearItemRow: View {
    let item: GearItem

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(item.name)
                    .font(.body)
                Spacer()
                if item.weightInGrams > 0 {
                    Text(formattedWeight(item.weightInGrams * Double(item.quantity)))
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
            HStack(spacing: 8) {
                if let cat = item.category {
                    Label(cat.capitalized, systemImage: "tag")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Label(item.packName, systemImage: "backpack")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                if item.quantity > 1 {
                    Text("×\(item.quantity)")
                        .font(.caption2.bold())
                        .foregroundStyle(Color.accentColor)
                }
            }
        }
        .padding(.vertical, 2)
    }

    private func formattedWeight(_ grams: Double) -> String {
        if grams >= 1000 { return String(format: "%.1fkg", grams / 1000) }
        return String(format: "%.0fg", grams)
    }
}
