import SwiftUI

struct PackWeightAnalysisView: View {
    let pack: Pack

    private var items: [PackItem] { pack.activeItems }

    private var categoryGroups: [(name: String, items: [PackItem])] {
        let groups = Dictionary(grouping: items, by: { $0.category ?? "Uncategorized" })
        return groups.keys.sorted().map { ($0, groups[$0] ?? []) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    weightCard("Base Weight", value: pack.baseWeight, denominator: pack.totalWeight, color: .green)
                    weightCard("Consumable", value: pack.consumableWeight, denominator: pack.totalWeight, color: .purple)
                    weightCard("Worn", value: pack.wornWeight, denominator: pack.totalWeight, color: .orange)
                    weightCard("Total Weight", value: pack.totalWeight, denominator: nil, color: .blue)
                }
                .padding(.horizontal)

                if categoryGroups.isEmpty {
                    ContentUnavailableView(
                        "No Items",
                        systemImage: "archivebox",
                        description: Text("Add items to see weight analysis")
                    )
                    .padding(.top, 40)
                } else {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Weight Breakdown")
                            .font(.headline)
                            .padding(.horizontal)
                            .padding(.bottom, 8)

                        ForEach(categoryGroups, id: \.name) { group in
                            CategoryWeightSection(name: group.name, items: group.items, pack: pack)
                                .padding(.bottom, 12)
                        }
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Weight Analysis")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.large)
        #endif
    }

    private func weightCard(_ label: String, value: Double?, denominator: Double?, color: Color) -> some View {
        let pct: Int? = {
            guard let v = value, let d = denominator, d > 0 else { return nil }
            return Int((v / d) * 100)
        }()
        return VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(pack.formattedWeight(value))
                .font(.title3.bold().monospacedDigit())
                .foregroundStyle(color)
            if let pct {
                Text("\(pct)% of total")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
    }
}

private struct CategoryWeightSection: View {
    let name: String
    let items: [PackItem]
    let pack: Pack

    private var totalGrams: Double {
        items.reduce(0) { acc, item in
            let w = item.weight
            guard w > 0 else { return acc }
            let qty = Double(item.effectiveQuantity)
            switch item.weightUnit {
            case .g:  return acc + w * qty
            case .kg: return acc + w * 1_000 * qty
            case .oz: return acc + w * 28.3495 * qty
            case .lb: return acc + w * 453.592 * qty
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(name.capitalized)
                        .font(.subheadline.bold())
                    Text(pack.formattedWeight(totalGrams))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text("\(items.count) item\(items.count == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal)
            .padding(.vertical, 10)
            .background(.background)

            Divider()

            ForEach(Array(items.enumerated()), id: \.element.id) { idx, item in
                if idx > 0 { Divider().padding(.leading) }
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.name).font(.body)
                        if let notes = item.notes {
                            Text(notes).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    Text(item.displayWeight)
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal)
                .padding(.vertical, 10)
            }
        }
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }
}
