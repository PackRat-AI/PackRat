import SwiftUI
import Charts

struct PackWeightChart: View {
    let pack: Pack

    private var categoryData: [CategoryWeight] {
        let groups = Dictionary(grouping: pack.activeItems, by: { $0.category ?? "Other" })
        return groups.compactMap { key, items -> CategoryWeight? in
            let grams = items.reduce(0.0) { $0 + $1.weightInGrams * Double($1.effectiveQuantity) }
            guard grams > 0 else { return nil }
            return CategoryWeight(category: key.capitalized, grams: grams)
        }
        .sorted { $0.grams > $1.grams }
    }

    private var totalGrams: Double {
        // Prefer server-computed totalWeight (already in grams)
        if let t = pack.totalWeight, t > 0 { return t }
        return categoryData.reduce(0) { $0 + $1.grams }
    }

    var body: some View {
        if !categoryData.isEmpty {
            chartContent
        }
    }

    private var chartContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Weight Breakdown")
                .font(.headline)
                .padding(.horizontal)

            // Donut + legend side by side
            GeometryReader { geo in
                HStack(alignment: .center, spacing: 16) {
                    donutChart
                        .frame(width: min(geo.size.width * 0.42, 160),
                               height: min(geo.size.width * 0.42, 160))

                    legend
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .frame(height: 160)
            .padding(.horizontal)

            if categoryData.count > 1 {
                Divider().padding(.horizontal)
                barChart
                    .frame(height: CGFloat(categoryData.prefix(6).count) * 28 + 16)
                    .padding(.horizontal)
            }
        }
        .padding(.vertical, 14)
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal)
    }

    private var donutChart: some View {
        Chart(categoryData) { item in
            SectorMark(
                angle: .value("Weight", item.grams),
                innerRadius: .ratio(0.54),
                angularInset: 1.5
            )
            .foregroundStyle(item.color)
            .cornerRadius(3)
        }
        .chartLegend(.hidden)
        .overlay {
            VStack(spacing: 2) {
                Text(formattedGrams(totalGrams))
                    .font(.caption.monospacedDigit().bold())
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                Text("total")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding(4)
        }
    }

    private var legend: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(categoryData.prefix(6)) { item in
                HStack(spacing: 6) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(item.color)
                        .frame(width: 10, height: 10)
                    Text(item.category)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                    Text(item.percentage(of: totalGrams))
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(.tertiary)
                }
            }
        }
    }

    private var barChart: some View {
        Chart(categoryData.prefix(6)) { item in
            BarMark(
                x: .value("Weight", item.grams),
                y: .value("Category", item.category)
            )
            .foregroundStyle(item.color)
            .cornerRadius(3)
        }
        .chartXAxis {
            AxisMarks(values: .automatic(desiredCount: 4)) { value in
                AxisGridLine()
                AxisValueLabel {
                    if let g = value.as(Double.self) {
                        Text(formattedGrams(g))
                            .font(.caption2)
                    }
                }
            }
        }
        .chartYAxis {
            AxisMarks { _ in
                AxisValueLabel().font(.caption)
            }
        }
    }

    private func formattedGrams(_ g: Double) -> String {
        if g >= 1_000 { return String(format: "%.2f kg", g / 1_000) }
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
        Self.palette[abs(category.hashValue) % Self.palette.count]
    }

    func percentage(of total: Double) -> String {
        guard total > 0 else { return "" }
        return String(format: "%.0f%%", grams / total * 100)
    }
}
