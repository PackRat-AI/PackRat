import SwiftUI
import Charts

struct PackWeightChart: View {
    let pack: Pack

    private var categoryData: [CategoryWeight] {
        let items = pack.activeItems
        let groups = Dictionary(grouping: items, by: { $0.category ?? "Other" })
        return groups.map { key, items in
            let total = items.reduce(0.0) { $0 + (($1.weight ?? 0) * Double($1.effectiveQuantity)) }
            return CategoryWeight(category: key.capitalized, grams: total)
        }
        .filter { $0.grams > 0 }
        .sorted { $0.grams > $1.grams }
    }

    private var totalGrams: Double {
        pack.totalWeight ?? categoryData.reduce(0) { $0 + $1.grams }
    }

    private var weightBreakdown: [(label: String, value: Double?, color: Color)] {
        [
            ("Base", pack.baseWeight, .blue),
            ("Worn", pack.wornWeight, .orange),
            ("Consumable", pack.consumableWeight, .green),
        ]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            if categoryData.isEmpty { return AnyView(EmptyView()) }

            Text("Weight Breakdown")
                .font(.headline)
                .padding(.horizontal)

            HStack(alignment: .top, spacing: 24) {
                donutChart
                    .frame(width: 160, height: 160)

                VStack(alignment: .leading, spacing: 8) {
                    ForEach(categoryData.prefix(6)) { item in
                        HStack(spacing: 8) {
                            Circle()
                                .fill(item.color)
                                .frame(width: 8, height: 8)
                            Text(item.category)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text(formattedGrams(item.grams))
                                .font(.caption.monospacedDigit())
                        }
                    }
                    if totalGrams > 0 {
                        Divider()
                        HStack {
                            Text("Total")
                                .font(.caption.bold())
                            Spacer()
                            Text(formattedGrams(totalGrams))
                                .font(.caption.monospacedDigit().bold())
                        }
                    }
                }
                .frame(maxWidth: .infinity)
            }
            .padding(.horizontal)

            if categoryData.count > 1 {
                categoryBarChart
                    .frame(height: 120)
                    .padding(.horizontal)
            }
        }
        .padding(.vertical, 12)
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal)
    }

    private var donutChart: some View {
        Chart(categoryData) { item in
            SectorMark(
                angle: .value("Weight", item.grams),
                innerRadius: .ratio(0.55),
                angularInset: 1.5
            )
            .foregroundStyle(item.color)
            .cornerRadius(3)
        }
        .chartLegend(.hidden)
        .overlay {
            VStack(spacing: 2) {
                Text(formattedGrams(totalGrams))
                    .font(.callout.monospacedDigit().bold())
                Text("total")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var categoryBarChart: some View {
        Chart(categoryData) { item in
            BarMark(
                x: .value("Weight", item.grams),
                y: .value("Category", item.category)
            )
            .foregroundStyle(item.color)
            .cornerRadius(4)
            .annotation(position: .trailing) {
                Text(formattedGrams(item.grams))
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        }
        .chartXAxis(.hidden)
        .chartYAxis {
            AxisMarks { _ in
                AxisValueLabel().font(.caption)
            }
        }
    }

    private func formattedGrams(_ g: Double) -> String {
        if g >= 1000 { return String(format: "%.2f kg", g / 1000) }
        return String(format: "%.0f g", g)
    }
}

// MARK: - Model

private struct CategoryWeight: Identifiable {
    let id = UUID()
    let category: String
    let grams: Double

    static let palette: [Color] = [.blue, .green, .orange, .purple, .pink, .teal, .indigo, .cyan]

    var color: Color {
        let idx = abs(category.hashValue) % Self.palette.count
        return Self.palette[idx]
    }
}
