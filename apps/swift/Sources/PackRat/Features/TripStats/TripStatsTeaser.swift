import Charts
import SwiftUI

/// A preview of Trip Stats that links to the full screen: this year's trips and
/// nights, a gain on last year when there is one, and a twelve-month sparkline.
///
/// The whole card is the link, with a chevron, so it reads as tappable — the
/// count chips it replaces as the entry point looked like static text. A
/// quieter year than last is left unsaid rather than shown as a drop.
struct TripStatsTeaser: View {
    let stats: TripStats
    /// Off inside a `NavigationLink` row, which draws its own.
    var showsChevron = true

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Label("Trip Stats", systemImage: "chart.bar.xaxis")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.accentColor)
                Text(summary)
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                if let gain {
                    Text(gain)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Chart(stats.months) { bucket in
                BarMark(
                    x: .value("Month", bucket.month, unit: .month),
                    y: .value("Nights", bucket.nights)
                )
                .foregroundStyle(Color.accentColor.opacity(bucket.nights > 0 ? 0.9 : 0.2))
                .cornerRadius(1.5)
            }
            .chartXAxis(.hidden)
            .chartYAxis(.hidden)
            .frame(width: 84, height: 36)
            .accessibilityHidden(true)

            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint("Opens Trip Stats")
    }

    /// This year when there is anything in it, otherwise the lifetime record,
    /// so January doesn't open on "0 trips".
    private var summary: String {
        if stats.thisYear.trips > 0 {
            return "\(Self.trips(stats.thisYear.trips)) · \(Self.nights(stats.thisYear.nights)) this year"
        }
        return "\(Self.trips(stats.totals.trips)) · \(Self.nights(stats.totals.nights)) all time"
    }

    private var gain: String? {
        guard stats.thisYear.trips > 0, let last = stats.lastYearToDate else { return nil }
        let more = stats.thisYear.trips - last.trips
        guard more > 0 else { return nil }
        return "\(more) more than this time last year"
    }

    private static func trips(_ n: Int) -> String { "\(n) trip\(n == 1 ? "" : "s")" }
    private static func nights(_ n: Int) -> String { "\(n) night\(n == 1 ? "" : "s")" }
}
