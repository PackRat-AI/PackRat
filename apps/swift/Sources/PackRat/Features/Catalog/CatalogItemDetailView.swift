import SwiftUI
import NukeUI

struct CatalogItemDetailView: View {
    let item: CatalogItem
    let packsViewModel: PacksViewModel
    @State private var showingAddToPack = false
    @State private var selectedImageIndex = 0
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    imageCarousel
                    infoSection
                    if let desc = item.description, !desc.isEmpty {
                        descriptionSection(desc)
                    }
                    detailsGrid
                }
                .padding(.bottom, 20)
            }
            .navigationTitle(item.displayName)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Add to Pack", systemImage: "plus.circle") {
                        showingAddToPack = true
                    }
                }
            }
            .sheet(isPresented: $showingAddToPack) {
                AddCatalogItemToPackSheet(item: item, packsViewModel: packsViewModel)
            }
        }
        #if os(macOS)
        .frame(minWidth: 480, minHeight: 560)
        #endif
    }

    @ViewBuilder
    private var imageCarousel: some View {
        let images = item.images ?? []
        if images.isEmpty {
            Rectangle()
                .fill(.fill.secondary)
                .frame(height: 260)
                .overlay { Image(systemName: "photo").font(.largeTitle).foregroundStyle(.tertiary) }
        } else {
            TabView(selection: $selectedImageIndex) {
                ForEach(Array(images.enumerated()), id: \.offset) { index, url in
                    RemoteImage(url: url, contentMode: .fit) {
                        Rectangle().fill(.fill.secondary)
                    }
                    .frame(height: 260)
                    .tag(index)
                }
            }
            .frame(height: 260)
            #if os(iOS)
            .tabViewStyle(.page(indexDisplayMode: images.count > 1 ? .always : .never))
            #endif
        }
    }

    private var infoSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.displayName).font(.title2.bold()).lineLimit(3)
                    if let brand = item.displayBrand {
                        Text(brand).font(.callout).foregroundStyle(.tint)
                    }
                    if let model = item.model {
                        Text(model).font(.caption).foregroundStyle(.secondary)
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    if let price = item.displayPrice {
                        Text(price).font(.title3.bold()).foregroundStyle(.green)
                    }
                    if !item.isInStock {
                        Text("Out of Stock")
                            .font(.caption).foregroundStyle(.red)
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(.red.opacity(0.1), in: Capsule())
                    }
                }
            }

            HStack(spacing: 12) {
                if !item.displayWeight.isEmpty {
                    Label(item.displayWeight, systemImage: "scalemass")
                        .font(.callout).foregroundStyle(.secondary)
                }
                if let rating = item.ratingValue, rating > 0 {
                    HStack(spacing: 3) {
                        Image(systemName: "star.fill").font(.callout).foregroundStyle(.yellow)
                        Text(String(format: "%.1f", rating)).font(.callout.monospacedDigit())
                        if let count = item.reviewCount, count > 0 {
                            Text("(\(count))").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }

            if let cats = item.categories, !cats.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(cats, id: \.self) { cat in
                            Text(cat)
                                .font(.caption)
                                .padding(.horizontal, 10).padding(.vertical, 4)
                                .background(.tint.opacity(0.1), in: Capsule())
                                .foregroundStyle(.tint)
                        }
                    }
                }
            }

            if !item.productUrl.isEmpty, let url = URL(string: item.productUrl) {
                Link(destination: url) {
                    Label("View Product Page", systemImage: "arrow.up.right.square")
                        .font(.callout)
                }
            }
        }
        .padding(.horizontal)
    }

    private func descriptionSection(_ desc: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Description")
                .font(.headline)
                .padding(.horizontal)
            Text(desc)
                .font(.body)
                .foregroundStyle(.secondary)
                .padding(.horizontal)
        }
    }

    private var detailsGrid: some View {
        let pairs: [(String, String)] = [
            item.color.map { ("Color", $0) },
            item.size.map { ("Size", $0) },
            item.seller.map { ("Seller", $0) },
        ].compactMap { $0 }

        guard !pairs.isEmpty else { return AnyView(EmptyView()) }

        return AnyView(
            VStack(alignment: .leading, spacing: 8) {
                Text("Details")
                    .font(.headline)
                    .padding(.horizontal)
                VStack(spacing: 0) {
                    ForEach(pairs, id: \.0) { label, value in
                        HStack {
                            Text(label).foregroundStyle(.secondary)
                            Spacer()
                            Text(value).fontWeight(.medium)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(.background.secondary)
                        if pairs.last?.0 != label { Divider().padding(.leading, 16) }
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal)
            }
        )
    }
}
