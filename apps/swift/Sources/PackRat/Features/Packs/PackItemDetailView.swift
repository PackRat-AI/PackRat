import SwiftUI
import NukeUI

struct PackItemDetailView: View {
    private let initialItem: PackItem
    let packId: String
    @Bindable var viewModel: PacksViewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthManager.self) private var authManager
    @Environment(\.weightUnit) private var weightUnit
    @State private var showingEdit = false
    @State private var showingAskAI = false
    @State private var similarItems: [CatalogItem] = []
    @State private var isLoadingSimilar = false

    init(item: PackItem, packId: String, viewModel: PacksViewModel) {
        self.initialItem = item
        self.packId = packId
        self.viewModel = viewModel
    }

    /// Re-reads the item from the view model so edits made in the sheet are
    /// reflected here on dismiss. `initialItem` is only a snapshot from when
    /// this view was constructed, so rendering it directly left the detail
    /// screen showing the pre-edit weight after saving.
    private var item: PackItem {
        viewModel.packs
            .first { $0.id == packId }?
            .activeItems
            .first { $0.id == initialItem.id }
            ?? initialItem
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    summarySection
                    metadataSection
                    if let notes = item.notes, !notes.isEmpty {
                        notesSection(notes)
                    }
                    askAISection
                    similarSection
                }
                .padding(.bottom, 24)
            }
            .navigationTitle(item.name)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Edit", systemImage: "pencil") { showingEdit = true }
                        .accessibilityIdentifier("pack_item_detail_edit_button")
                }
            }
            .sheet(isPresented: $showingAskAI) {
                PackItemAskAISheet(item: item)
            }
            .sheet(isPresented: $showingEdit) {
                // `item`, not `initialItem`: re-opening Edit must prefill from the
                // latest values, not the snapshot this view was created with.
                PackItemFormView(packId: packId, viewModel: viewModel, existingItem: item)
            }
        }
        #if os(macOS)
        .frame(minWidth: 400, minHeight: 480)
        #endif
        .task { await loadSimilar() }
    }

    // MARK: - Metadata

    private var summarySection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 14) {
                itemImage

                VStack(alignment: .leading, spacing: 6) {
                    Text(item.name)
                        .font(.title2.bold())
                        .fixedSize(horizontal: false, vertical: true)
                    if let description = item.description, !description.isEmpty {
                        Text(description)
                            .font(.body)
                            .foregroundStyle(.secondary)
                    } else {
                        Text("Pack item")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer(minLength: 0)
            }

            VStack(spacing: 0) {
                detailRow("Weight", value: item.displayWeight.isEmpty ? "Not set" : item.displayWeight(in: weightUnit), symbol: "scalemass")
                detailRow("Quantity", value: "\(item.quantity)", symbol: "number")
                detailRow("Category", value: item.category?.capitalized ?? "Uncategorized", symbol: "tag")
                detailRow("Pack Weight", value: packWeightLabel, symbol: "backpack")
                if item.catalogItemId != nil {
                    detailRow("Catalog Match", value: "Linked", symbol: "link")
                }
                if item.isAIGenerated == true {
                    detailRow("Source", value: "AI generated", symbol: "sparkles")
                }
            }
            .background(.background, in: RoundedRectangle(cornerRadius: 12))
        }
        .padding(.horizontal)
    }

    private var itemImage: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 14)
                .fill(.fill.secondary)
                .frame(width: 72, height: 72)

            if let image = item.image, let url = URL(string: image) {
                LazyImage(url: url) { state in
                    if let image = state.image {
                        image.resizable().scaledToFill()
                    } else {
                        Image(systemName: categorySymbol)
                            .font(.title2)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(width: 72, height: 72)
                .clipShape(RoundedRectangle(cornerRadius: 14))
            } else {
                Image(systemName: categorySymbol)
                    .font(.title2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func detailRow(_ title: String, value: String, symbol: String) -> some View {
        LabeledContent {
            Text(value)
                .foregroundStyle(.primary)
        } label: {
            Label(title, systemImage: symbol)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .overlay(alignment: .bottom) {
            Divider().padding(.leading, 42)
        }
    }

    private var metadataSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Weight + quantity row
            HStack(spacing: 12) {
                if item.weight > 0 {
                    metaChip(
                        value: item.displayWeight(in: weightUnit),
                        label: "Weight",
                        symbol: "scalemass.fill",
                        color: .blue
                    )
                }
                if item.quantity > 1 {
                    metaChip(
                        value: "×\(item.quantity)",
                        label: "Quantity",
                        symbol: "number",
                        color: .indigo
                    )
                }
                if item.weight > 0 && item.quantity > 1 {
                    let total = item.weightInGrams * Double(item.quantity)
                    metaChip(
                        value: weightUnit.display(grams: total),
                        label: "Total",
                        symbol: "sum",
                        color: .teal
                    )
                }
            }

            // Flags row
            HStack(spacing: 8) {
                if item.worn {
                    flagBadge("Worn", symbol: "person.fill", color: .orange)
                }
                if item.consumable {
                    flagBadge("Consumable", symbol: "flame", color: .purple)
                }
                if let cat = item.category {
                    flagBadge(cat.capitalized, symbol: "tag", color: .accentColor)
                }
            }
        }
        .padding(.horizontal)
    }

    private var categorySymbol: String {
        switch item.category?.lowercased() {
        case "shelter": return "tent"
        case "sleep": return "moon.zzz"
        case "food", "kitchen": return "fork.knife"
        case "clothing": return "tshirt"
        case "water": return "drop"
        case "safety": return "cross.case"
        case "pack": return "backpack"
        default: return "archivebox"
        }
    }

    private var packWeightLabel: String {
        switch (item.worn, item.consumable) {
        case (true, true): return "Worn consumable"
        case (true, false): return "Worn on body"
        case (false, true): return "Consumable"
        case (false, false): return "Base weight"
        }
    }

    private func metaChip(value: String, label: String, symbol: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: symbol)
                    .font(.caption2)
                    .foregroundStyle(color)
                Text(value)
                    .font(.callout.bold().monospacedDigit())
            }
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }

    private func flagBadge(_ label: String, symbol: String, color: Color) -> some View {
        Label(label, systemImage: symbol)
            .font(.caption.bold())
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(color.opacity(0.1), in: Capsule())
            .foregroundStyle(color)
    }

    // MARK: - Notes

    private func notesSection(_ notes: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Notes", systemImage: "note.text")
                .font(.headline)
                .padding(.horizontal)
            Text(notes)
                .font(.body)
                .foregroundStyle(.secondary)
                .padding(.horizontal)
                .padding(.vertical, 12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.fill.secondary, in: RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal)
        }
    }

    // MARK: - Similar Items

    /// Opens a chat scoped to this item, mirroring the Expo app's "Ask AI about
    /// this item" action on `PackItemDetailScreen`.
    ///
    /// Hidden for guests: the chat API requires an account, so the sheet would
    /// only render `ChatView`'s guest placeholder.
    @ViewBuilder
    private var askAISection: some View {
        if authManager.isAuthenticated {
            Button {
                showingAskAI = true
            } label: {
                Label("Ask AI about this item", systemImage: "sparkles")
                    .font(.callout.bold())
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.accentColor.opacity(0.12), in: Capsule())
                    .foregroundStyle(Color.accentColor)
            }
            .buttonStyle(.plain)
            .padding(.horizontal)
            .accessibilityIdentifier("pack_item_detail_ask_ai_button")
        }
    }

    private var similarSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Similar Gear")
                .font(.headline)
                .padding(.horizontal)

            if isLoadingSimilar {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding()
            } else if similarItems.isEmpty {
                ContentUnavailableView(
                    "No Similar Gear",
                    systemImage: "magnifyingglass",
                    description: Text("Catalog suggestions will appear when matching gear is available.")
                )
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(similarItems) { catalogItem in
                            SimilarItemCard(item: catalogItem, packsViewModel: viewModel)
                        }
                    }
                    .padding(.horizontal)
                }
            }
        }
    }

    // MARK: - Load

    private func loadSimilar() async {
        isLoadingSimilar = true
        defer { isLoadingSimilar = false }
        similarItems = (try? await CatalogService.shared.semanticSearch(
            query: item.name,
            limit: 6
        )) ?? []
    }
}

// MARK: - Similar Item Card

private struct SimilarItemCard: View {
    let item: CatalogItem
    let packsViewModel: PacksViewModel
    @State private var showingDetail = false
    @Environment(\.weightUnit) private var weightUnit

    var body: some View {
        cardContent
            .contentShape(Rectangle())
            .onTapGesture { showingDetail = true }
            .accessibilityIdentifier("pack_item_similar_card_\(item.id)")
            .accessibilityAddTraits(.isButton)
            .sheet(isPresented: $showingDetail) {
                CatalogItemDetailView(item: item, packsViewModel: packsViewModel)
            }
    }

    private var cardContent: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(.fill.secondary)
                    .frame(width: 120, height: 90)

                if let imageURL = item.primaryImage, let url = URL(string: imageURL) {
                    LazyImage(url: url) { state in
                        if let image = state.image {
                            image.resizable().scaledToFill()
                        } else {
                            Image(systemName: "photo")
                                .font(.title3)
                                .foregroundStyle(.tertiary)
                        }
                    }
                    .frame(width: 120, height: 90)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                } else {
                    Image(systemName: "archivebox")
                        .font(.title3)
                        .foregroundStyle(.tertiary)
                }
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(item.displayName)
                    .font(.caption.bold())
                    .lineLimit(2)
                    .frame(width: 120, alignment: .leading)
                if !item.displayWeight.isEmpty {
                    Text(item.displayWeight(in: weightUnit))
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
                if let price = item.displayPrice {
                    Text(price)
                        .font(.caption2.bold())
                        .foregroundStyle(.green)
                }
            }
        }
        .frame(width: 120)
    }
}
