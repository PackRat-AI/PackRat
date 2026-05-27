import SwiftUI
import NukeUI

struct PackItemDetailView: View {
    let item: PackItem
    let packId: String
    let viewModel: PacksViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showingEdit = false
    @State private var similarItems: [CatalogItem] = []
    @State private var isLoadingSimilar = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    metadataSection
                    if let notes = item.notes, !notes.isEmpty {
                        notesSection(notes)
                    }
                    if isLoadingSimilar || !similarItems.isEmpty {
                        similarSection
                    }
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
            .sheet(isPresented: $showingEdit) {
                PackItemFormView(packId: packId, viewModel: viewModel, existingItem: item)
            }
        }
        #if os(macOS)
        .frame(minWidth: 400, minHeight: 480)
        #endif
        .task { await loadSimilar() }
    }

    // MARK: - Metadata

    private var metadataSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Weight + quantity row
            HStack(spacing: 12) {
                if item.weight > 0 {
                    metaChip(
                        value: item.displayWeight,
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
                    let formatted = total >= 1000
                        ? String(format: "%.2f kg", total / 1000)
                        : String(format: "%.0f g", total)
                    metaChip(value: formatted, label: "Total", symbol: "sum", color: .teal)
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

    private var similarSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Similar Gear")
                .font(.headline)
                .padding(.horizontal)

            if isLoadingSimilar {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding()
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(similarItems) { catalogItem in
                            SimilarItemCard(item: catalogItem)
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

    var body: some View {
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
                    Text(item.displayWeight)
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
