import Accessibility
import Foundation
import SwiftUI

/// Audio Graph descriptors for the Trip Stats charts. VoiceOver users get the
/// chart's summary, axes and a playable tone graph from the rotor, as Apple
/// shows in WWDC21 "Bring accessibility to charts in your app".
enum TripStatsChartDescriptors {
    static func monthly(_ months: [TripStats.MonthBucket], metric: String, title: String) -> AXChartDescriptor {
        let values = months.map { Double(metric == "Trips" ? $0.trips : $0.nights) }
        let labels = months.map { $0.month.formatted(.dateTime.month(.abbreviated).year()) }
        let total = Int(values.reduce(0, +))
        var summary = "\(total) \(metric.lowercased()) in the last \(months.count) months."
        if let peak = values.indices.max(by: { values[$0] < values[$1] }), values[peak] > 0 {
            summary += " Most in \(labels[peak]), with \(Int(values[peak]))."
        }
        return AXChartDescriptor(
            title: title,
            summary: summary,
            xAxis: AXCategoricalDataAxisDescriptor(title: "Month", categoryOrder: labels),
            yAxis: numberAxis(metric, values),
            additionalAxes: [],
            series: [AXDataSeriesDescriptor(
                name: metric,
                isContinuous: false,
                dataPoints: zip(labels, values).map { AXDataPoint(x: $0, y: $1) }
            )]
        )
    }

    static func activities(_ buckets: [TripStats.ActivityBucket]) -> AXChartDescriptor {
        let labels = buckets.map(\.activity.label)
        let values = buckets.map { Double($0.trips) }
        var summary = "\(buckets.count) activit\(buckets.count == 1 ? "y" : "ies") across your logged trips."
        if let top = buckets.max(by: { $0.trips < $1.trips }) {
            summary += " \(top.activity.label) leads with \(top.trips) trip\(top.trips == 1 ? "" : "s")."
        }
        return AXChartDescriptor(
            title: "Activities",
            summary: summary,
            xAxis: AXCategoricalDataAxisDescriptor(title: "Activity", categoryOrder: labels),
            yAxis: numberAxis("Trips", values),
            additionalAxes: [],
            series: [AXDataSeriesDescriptor(
                name: "Trips",
                isContinuous: false,
                dataPoints: zip(labels, values).map { AXDataPoint(x: $0, y: $1) }
            )]
        )
    }

    static func weight(_ points: [TripStats.WeightPoint], unit: AppWeightUnit) -> AXChartDescriptor {
        let values = points.map { $0.grams / unit.gramsPerUnit }
        let dates = points.map { $0.date.timeIntervalSince1970 }
        var summary = "Base weight across \(points.count) trip\(points.count == 1 ? "" : "s")."
        if let first = points.first, let last = points.last, points.count > 1 {
            summary += " From \(unit.display(grams: first.grams)) to \(unit.display(grams: last.grams))."
        }
        let low = dates.min() ?? 0
        let high = max(dates.max() ?? 0, low + 1)
        return AXChartDescriptor(
            title: "Base Weight by Trip",
            summary: summary,
            xAxis: AXNumericDataAxisDescriptor(
                title: "Date",
                range: low...high,
                gridlinePositions: []
            ) { Date(timeIntervalSince1970: $0).formatted(date: .abbreviated, time: .omitted) },
            yAxis: numberAxis("Base weight in \(unit.label)", values),
            additionalAxes: [],
            series: [AXDataSeriesDescriptor(
                name: "Base weight",
                isContinuous: true,
                dataPoints: zip(dates, zip(values, points)).map { date, pair in
                    AXDataPoint(x: date, y: pair.0, label: pair.1.packName)
                }
            )]
        )
    }

    private static func numberAxis(_ title: String, _ values: [Double]) -> AXNumericDataAxisDescriptor {
        let low = min(values.min() ?? 0, 0)
        let high = max(values.max() ?? 0, low + 1)
        return AXNumericDataAxisDescriptor(title: title, range: low...high, gridlinePositions: []) { value in
            value.formatted(.number.precision(.fractionLength(0...1)))
        }
    }
}

/// Hands a prebuilt descriptor to `.accessibilityChartDescriptor`.
struct TripStatsChartDescriptor: AXChartDescriptorRepresentable {
    let descriptor: AXChartDescriptor

    func makeChartDescriptor() -> AXChartDescriptor { descriptor }
}
