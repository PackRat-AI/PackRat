import SwiftUI

// How a report looks wherever it's shown: one colour, one plain-language
// meaning and one symbol per condition and hazard, so a row, the trail page and
// the report screen never disagree.

extension TrailConditionReport {
    var conditionTint: Color {
        switch overallCondition {
        case "excellent": .green
        case "good": .blue
        case "fair": .orange
        case "poor": .red
        default: .secondary
        }
    }

    /// What the rating means for someone deciding whether to go.
    var conditionMeaning: String {
        switch overallCondition {
        case "excellent": "In great shape"
        case "good": "Good to go"
        case "fair": "Passable with care"
        case "poor": "Tough going"
        default: "Condition not rated"
        }
    }

    /// Past the window where a report still describes today's trail.
    var isOlder: Bool {
        guard let written = writtenAt?.toDate() else { return false }
        return Date().timeIntervalSince(written) > TripTrailConditionsSection.recentWindow
    }

    /// The exact day and time, for when "5 hours ago" isn't enough.
    var writtenDateText: String? {
        writtenAt?.toDate()?.formatted(.dateTime.month(.abbreviated).day().hour().minute())
    }

    var surfaceStyle: TrailSurface? { TrailSurface(rawValue: surface) }
}

enum HazardStyle {
    static func symbol(for hazard: String) -> String {
        switch hazard.lowercased() {
        case "downed trees": "tree"
        case "muddy sections": "drop"
        case "ice": "snowflake"
        case "high water": "water.waves"
        case "rock slides": "mountain.2"
        case "wildlife": "pawprint"
        case "washed out trail": "road.lanes"
        default: "exclamationmark.triangle"
        }
    }
}

/// The rating as a small tinted capsule: "Fair" with its symbol.
struct ConditionPill: View {
    let report: TrailConditionReport

    var body: some View {
        // An HStack, not a Label: inside a List row a Label takes the row's
        // icon-column spacing, which left a wide gap between icon and word.
        HStack(spacing: 4) {
            Image(systemName: report.conditionSymbol)
            Text(report.overallCondition.capitalized)
        }
        .accessibilityElement(children: .combine)
        .font(.caption.bold())
        .foregroundStyle(report.conditionTint)
        .padding(.horizontal, 8).padding(.vertical, 3)
        .background(report.conditionTint.opacity(0.12), in: Capsule())
    }
}

/// "Older": the report predates the recent window, so readers weigh it less.
struct OlderPill: View {
    var body: some View {
        Text("Older")
            .font(.caption2.weight(.semibold))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(.fill.tertiary, in: Capsule())
    }
}

/// "New": a report on one of the hiker's upcoming trips they hadn't read yet.
struct NewReportPill: View {
    var body: some View {
        Text("New")
            .font(.caption2.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(.tint, in: Capsule())
            .accessibilityIdentifier("trail_report_new")
    }
}

/// A report saved on the device that goes out once there's signal.
struct WaitingToSendPill: View {
    var body: some View {
        Label("Waiting to send", systemImage: "icloud.slash")
            .font(.caption2.weight(.semibold))
            .foregroundStyle(.orange)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(.orange.opacity(0.12), in: Capsule())
            .accessibilityIdentifier("trail_report_waiting_to_send")
    }
}

/// A row's hazards on one line, so a list can be scanned for what would turn
/// someone back before opening anything.
struct HazardLine: View {
    let hazards: [String]

    var body: some View {
        if !hazards.isEmpty {
            Label {
                Text(hazards.map { $0.capitalized }.joined(separator: ", "))
                    .lineLimit(1)
            } icon: {
                Image(systemName: "exclamationmark.triangle.fill")
            }
            .labelStyle(TightLabelStyle())
            .font(.caption.weight(.semibold))
            .foregroundStyle(.orange)
            .accessibilityLabel("Hazards: \(hazards.joined(separator: ", "))")
        }
    }
}

/// Icon and title with a fixed small gap, unaffected by List row spacing.
struct TightLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 4) {
            configuration.icon
            configuration.title
        }
    }
}
