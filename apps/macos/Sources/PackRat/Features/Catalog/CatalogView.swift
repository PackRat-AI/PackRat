import SwiftUI
import NukeUI

struct CatalogView: View {
    @State private var viewModel = CatalogViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                searchBar

                if viewModel.isLoading && viewModel.items.isEmpty {
                    ProgressView("Searching gear…").padding(.top, 40)
                } else if let error = viewModel.error {
                    InlineErrorView(message: error).padding(.horizontal)
                } else if viewModel.items.isEmpty && viewModel.hasSearched {
                    ContentUnavailableView.search(text: viewModel.searchText).padding(.top, 20)
                } else if !viewModel.hasSearched {
                    EmptyStateView(
                        "Search the Gear Catalog",
                        subtitle: "Find weight specs, prices, and reviews for thousands of outdoor products",
                        systemImage: "magnifyingglass"
                    )
                    .padding(.top, 20)
                } else {
                    itemGrid
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Gear Catalog")
    }

    private var searchBar: some View {
        HStack {
            Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
            TextField("Search tents, packs, sleeping bags…", text: $viewModel.searchText)
                .onChange(of: viewModel.searchText) { viewModel.onSearchTextChanged() }
                .onSubmit { Task { await viewModel.search(reset: true) } }
            if viewModel.isLoading {
                ProgressView().controlSize(.small)
            } else if !viewModel.searchText.isEmpty {
                Button { viewModel.searchText = "" } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(10)
        .background(.fill.secondary, in: RoundedRectangle(cornerRadius: 10))
        .padding(.horizontal)
    }

    private var itemGrid: some View {
        LazyVStack(spacing: 0) {
            ForEach(viewModel.items) { item in
                CatalogItemRow(item: item)
                Divider().padding(.leading, 76)
            }
            Button("Load More") { Task { await viewModel.loadMore() } }
                .buttonStyle(.plain).foregroundStyle(.tint).padding()
                .disabled(viewModel.isLoading)
        }
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }
}

struct CatalogItemRow: View {
    let item: CatalogItem

    var body: some View {
        HStack(spacing: 12) {
            // Product thumbnail
            RemoteImage(url: item.primaryImage, contentMode: .fill, cornerRadius: 8) {
                RoundedRectangle(cornerRadius: 8)
                    .fill(.fill.secondary)
                    .overlay {
                        Image(systemName: "photo")
                            .foregroundStyle(.tertiary)
                    }
            }
            .frame(width: 56, height: 56)

            VStack(alignment: .leading, spacing: 4) {
                Text(item.displayName)
                    .font(.headline)
                    .lineLimit(2)
                HStack(spacing: 8) {
                    if let brand = item.displayBrand {
                        Text(brand)
                            .font(.caption.bold())
                            .foregroundStyle(.tint)
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
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }
}
