import SwiftUI
import SwiftData

// MARK: - Model

@Model
final class ShoppingItem {
    var id: String
    var name: String
    var notes: String?
    var category: String?
    var estimatedPrice: Double?
    var isPurchased: Bool
    var addedAt: Date

    init(name: String, notes: String? = nil, category: String? = nil, estimatedPrice: Double? = nil) {
        self.id = UUID().uuidString
        self.name = name
        self.notes = notes
        self.category = category
        self.estimatedPrice = estimatedPrice
        self.isPurchased = false
        self.addedAt = Date()
    }
}

// MARK: - View

struct ShoppingListView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \ShoppingItem.addedAt, order: .reverse) private var items: [ShoppingItem]

    @State private var showingAddSheet = false
    @State private var searchText = ""
    @State private var showPurchased = false

    private var filteredItems: [ShoppingItem] {
        items.filter { item in
            let matchesSearch = searchText.isEmpty ||
                item.name.localizedCaseInsensitiveContains(searchText) ||
                (item.category?.localizedCaseInsensitiveContains(searchText) == true)
            let matchesPurchased = showPurchased ? true : !item.isPurchased
            return matchesSearch && matchesPurchased
        }
    }

    private var unpurchasedCount: Int { items.filter { !$0.isPurchased }.count }

    var body: some View {
        NavigationStack {
            Group {
                if items.isEmpty {
                    EmptyStateView(
                        "Shopping List Empty",
                        subtitle: "Add gear you want to buy to track your wishlist",
                        systemImage: "cart"
                    )
                } else {
                    shoppingList
                }
            }
            .navigationTitle(unpurchasedCount > 0 ? "Shopping List (\(unpurchasedCount))" : "Shopping List")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.large)
            #endif
            .searchable(text: $searchText, prompt: "Search items")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .accessibilityIdentifier("shopping_done")
                }
                ToolbarItem(placement: .primaryAction) {
                    Button { showingAddSheet = true } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityIdentifier("shopping_add_item")
                }
                if !items.isEmpty {
                    ToolbarItem(placement: .secondaryAction) {
                        Button(showPurchased ? "Hide Purchased" : "Show Purchased") {
                            withAnimation { showPurchased.toggle() }
                        }
                        .accessibilityIdentifier("shopping_toggle_purchased_visibility")
                    }
                    if items.contains(where: { $0.isPurchased }) {
                        ToolbarItem(placement: .secondaryAction) {
                            Button("Clear Purchased", role: .destructive) { clearPurchased() }
                                .accessibilityIdentifier("shopping_clear_purchased")
                        }
                    }
                }
            }
            .sheet(isPresented: $showingAddSheet) {
                AddShoppingItemSheet()
            }
        }
        #if os(macOS)
        .frame(minWidth: 380, minHeight: 480)
        #endif
    }

    private var shoppingList: some View {
        List {
            ForEach(filteredItems) { item in
                ShoppingItemRow(item: item)
            }
            .onDelete(perform: deleteItems)
        }
    }

    private func deleteItems(at offsets: IndexSet) {
        for index in offsets {
            modelContext.delete(filteredItems[index])
        }
    }

    private func clearPurchased() {
        items.filter { $0.isPurchased }.forEach { modelContext.delete($0) }
    }
}

// MARK: - Row

private struct ShoppingItemRow: View {
    @Bindable var item: ShoppingItem

    var body: some View {
        HStack(spacing: 12) {
            Button {
                withAnimation { item.isPurchased.toggle() }
            } label: {
                Image(systemName: item.isPurchased ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(item.isPurchased ? .green : .secondary)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("shopping_toggle_\(item.id)")

            VStack(alignment: .leading, spacing: 3) {
                Text(item.name)
                    .font(.body)
                    .strikethrough(item.isPurchased)
                    .foregroundStyle(item.isPurchased ? .secondary : .primary)
                HStack(spacing: 8) {
                    if let cat = item.category {
                        Label(cat.capitalized, systemImage: "tag")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    if let price = item.estimatedPrice {
                        Text(String(format: "$%.2f", price))
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                }
                if let notes = item.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer()
        }
        .padding(.vertical, 2)
        .opacity(item.isPurchased ? 0.6 : 1)
    }
}

// MARK: - Add Sheet

private struct AddShoppingItemSheet: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var category = ""
    @State private var notes = ""
    @State private var priceText = ""

    private let categories = ["Shelter", "Sleep", "Clothing", "Navigation", "Food", "Water", "Safety", "Tools", "Electronics", "Other"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Item") {
                    TextField("Name (required)", text: $name)
                        .accessibilityIdentifier("shopping_item_name")
                    Picker("Category", selection: $category) {
                        Text("None").tag("")
                        ForEach(categories, id: \.self) { cat in
                            Text(cat).tag(cat)
                        }
                    }
                    .accessibilityIdentifier("shopping_item_category")
                }
                Section("Details") {
                    TextField("Estimated price ($)", text: $priceText)
                        .accessibilityIdentifier("shopping_item_price")
                        #if os(iOS)
                        .keyboardType(.decimalPad)
                        #endif
                    TextField("Notes", text: $notes, axis: .vertical)
                        .lineLimit(3)
                        .accessibilityIdentifier("shopping_item_notes")
                }
            }
            .navigationTitle("Add Item")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .accessibilityIdentifier("shopping_item_cancel")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { save() }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                        .accessibilityIdentifier("shopping_item_add")
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 340, minHeight: 320)
        #endif
    }

    private func save() {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        let item = ShoppingItem(
            name: trimmed,
            notes: notes.isEmpty ? nil : notes,
            category: category.isEmpty ? nil : category,
            estimatedPrice: Double(priceText)
        )
        modelContext.insert(item)
        dismiss()
    }
}
