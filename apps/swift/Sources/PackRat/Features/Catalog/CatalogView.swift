import SwiftUI
import NukeUI

struct CatalogView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        @Bindable var vm = appState.catalogVM

        return Group {
            if vm.isLoading && vm.items.isEmpty {
                ProgressView("Searching gear…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = vm.error {
                ErrorView(error, retry: { await vm.search(reset: true) })
            } else if vm.items.isEmpty && vm.hasSearched {
                UnavailableStateView(
                    title: "No Results",
                    subtitle: "No gear matched “\(vm.searchText)”. Try a brand, model, or category.",
                    systemImage: "magnifyingglass"
                )
                .accessibilityIdentifier("catalog_no_results")
            } else if !vm.hasSearched {
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
        .navigationTitle("Gear Catalog")
        #if os(iOS)
        .searchable(
            text: $vm.searchText,
            placement: .navigationBarDrawer(displayMode: .always),
            prompt: "Search tents, packs, sleeping bags…"
        )
        #else
        .searchable(text: $vm.searchText, prompt: "Search tents, packs, sleeping bags…")
        #endif
        .onChange(of: vm.searchText) { vm.onSearchTextChanged() }
        .onSubmit(of: .search) { Task { await vm.search(reset: true) } }
        .toolbar {
            if vm.isLoading && !vm.items.isEmpty {
                ToolbarItem(placement: .secondaryAction) {
                    ProgressView().controlSize(.small)
                }
            }
        }
    }

    private func itemGrid(vm: CatalogViewModel) -> some View {
        LazyVStack(spacing: 0) {
            ForEach(vm.items) { item in
                CatalogItemRow(item: item, packsViewModel: appState.packsVM)
                Divider().padding(.leading, 76)
                    .task {
                        if item.id == vm.items.last?.id {
                            await vm.loadMore()
                        }
                    }
            }
            if vm.isLoading {
                ProgressView().padding()
            }
        }
        .accessibilityIdentifier("catalog_results_list")
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }
}

// MARK: - Catalog item row with Add to Pack

struct CatalogItemRow: View {
    let item: CatalogItem
    let packsViewModel: PacksViewModel
    @State private var showingAddToPack = false
    @State private var showingDetail = false

    var body: some View {
        rowContent
            .contentShape(Rectangle())
            .onTapGesture { showingDetail = true }
            .accessibilityIdentifier("catalog_item_row_\(item.id)")
            .sheet(isPresented: $showingDetail) {
                CatalogItemDetailView(item: item, packsViewModel: packsViewModel)
            }
            .sheet(isPresented: $showingAddToPack) {
                AddCatalogItemToPackSheet(item: item, packsViewModel: packsViewModel)
            }
    }

    private var rowContent: some View {
        HStack(spacing: 12) {
            RemoteImage(url: item.primaryImage, contentMode: .fill, cornerRadius: 8) {
                RoundedRectangle(cornerRadius: 8)
                    .fill(.fill.secondary)
                    .overlay { Image(systemName: "photo").foregroundStyle(.tertiary) }
            }
            .frame(width: 56, height: 56)

            VStack(alignment: .leading, spacing: 4) {
                Text(item.displayName)
                    .font(.headline)
                    .lineLimit(2)
                HStack(spacing: 8) {
                    if let brand = item.displayBrand {
                        Text(brand).font(.caption.bold()).foregroundStyle(.tint)
                    }
                    if !item.displayWeight.isEmpty {
                        Label(item.displayWeight, systemImage: "scalemass")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    if let price = item.displayPrice {
                        Text(price).font(.caption.bold()).foregroundStyle(.green)
                    }
                }
                if let cats = item.categories, !cats.isEmpty {
                    Text(cats.prefix(2).joined(separator: " · "))
                        .font(.caption2).foregroundStyle(.tertiary)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                if let rating = item.ratingValue, rating > 0 {
                    HStack(spacing: 2) {
                        Image(systemName: "star.fill").font(.caption2).foregroundStyle(.yellow)
                        Text(String(format: "%.1f", rating))
                            .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                    }
                }
                if !item.isInStock {
                    Text("Out of Stock")
                        .font(.caption2).foregroundStyle(.red)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(.red.opacity(0.1), in: Capsule())
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
}

// MARK: - Add to Pack sheet

struct AddCatalogItemToPackSheet: View {
    let item: CatalogItem
    let packsViewModel: PacksViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var selectedPackId: String?
    @State private var quantity = 1
    @State private var error: String?
    @State private var success = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Item") {
                    LabeledContent("Name") { Text(item.displayName) }
                    if !item.displayWeight.isEmpty {
                        LabeledContent("Weight") { Text(item.displayWeight) }
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
        .formSheetSize(minWidth: 480, minHeight: 380)
    }

    private func addToPack() async {
        guard let packId = selectedPackId else { return }
        error = nil
        do {
            try await packsViewModel.addItem(
                to: packId,
                name: item.displayName,
                weight: item.weight,
                weightUnit: item.weightUnit.rawValue,
                quantity: quantity,
                category: item.categories?.first,
                consumable: false,
                worn: false,
                notes: nil
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
}
