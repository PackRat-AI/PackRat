import SwiftUI

// MARK: - Danger badge

/// Renders a species' danger level.
///
/// `dangerous` is deliberately not a row among rows: it is filled rather than
/// tinted, and carries its own symbol. A user photographing a mushroom or a
/// snake is asking a safety question in the grammar of a naming question, and
/// the answer has to be legible at a glance in bright sunlight.
struct DangerBadge: View {
    let level: DangerLevel

    private var color: Color {
        switch level {
        case .safe: .green
        case .caution: .orange
        case .dangerous: .red
        }
    }

    private var symbol: String {
        switch level {
        case .safe: "checkmark.shield.fill"
        case .caution: "exclamationmark.triangle.fill"
        case .dangerous: "exclamationmark.octagon.fill"
        }
    }

    private var title: String {
        switch level {
        case .safe: "Safe"
        case .caution: "Caution"
        case .dangerous: "Dangerous"
        }
    }

    var body: some View {
        Label(title, systemImage: symbol)
            .font(.caption.bold())
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(level == .dangerous ? color : color.opacity(0.15), in: Capsule())
            .foregroundStyle(level == .dangerous ? .white : color)
            .accessibilityLabel("Safety rating: \(title)")
    }
}

// MARK: - Confidence

/// Shows how sure the app is, rounded down.
///
/// Paired with a qualifier rather than a bare number: below
/// `ConfidencePolicy.confident`, the result is presented as a possibility, not
/// an identification, so a weak guess cannot read as an answer.
struct IdentificationConfidenceLabel: View {
    let confidence: Double
    let isTopResult: Bool

    private var isConfident: Bool { confidence >= ConfidencePolicy.confident }

    private var text: String {
        let percent = ConfidencePolicy.displayPercentage(confidence)
        if isTopResult && !isConfident {
            return "Possible match · \(percent)%"
        }
        return "\(percent)% confident"
    }

    var body: some View {
        Text(text)
            .font(.caption2.bold())
            .foregroundStyle(isConfident ? Color.green : Color.secondary)
    }
}

// MARK: - Result row

/// One ranked candidate. Every row carries its own danger badge — a dangerous
/// species in second place is still a dangerous species, and a user scanning
/// the list must not have to open a row to learn that.
struct IdentificationResultRow: View {
    let result: IdentificationResult
    let isTopResult: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(result.species.commonName)
                        .font(isTopResult ? .headline : .subheadline.weight(.medium))
                    Text(result.species.scientificName)
                        .font(.caption)
                        .italic()
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 8)
                DangerBadge(level: result.species.dangerLevel)
            }

            HStack(spacing: 8) {
                IdentificationConfidenceLabel(confidence: result.confidence, isTopResult: isTopResult)
                Text("·")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                // Every result says who produced it. The user is entitled to
                // know whether the phone or the server named the thing.
                Label(result.source.displayName, systemImage: result.source == .offline ? "iphone" : "cloud")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            if isTopResult {
                Text(result.species.description)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Detail

/// The full field-guide entry, led by the name and the safety rating.
struct SpeciesDetailView: View {
    let result: IdentificationResult

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(result.species.commonName)
                        .font(.title2.bold())
                    Text(result.species.scientificName)
                        .font(.subheadline)
                        .italic()
                        .foregroundStyle(.secondary)
                    HStack(spacing: 8) {
                        DangerBadge(level: result.species.dangerLevel)
                        IdentificationConfidenceLabel(confidence: result.confidence, isTopResult: true)
                    }
                }

                section("About", symbol: "info.circle") {
                    Text(result.species.description)
                }

                if !result.species.characteristics.isEmpty {
                    section("How to tell", symbol: "eye") {
                        bulletList(result.species.characteristics)
                    }
                }

                if !result.species.habitat.isEmpty {
                    section("Habitat", symbol: "leaf") {
                        Text(result.species.habitat.joined(separator: ", "))
                    }
                }

                if let status = result.species.conservationStatus {
                    section("Conservation status", symbol: "shield") {
                        Text(status)
                    }
                }

                if let facts = result.species.interestingFacts, !facts.isEmpty {
                    section("Notable", symbol: "sparkles") {
                        bulletList(facts)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
        .navigationTitle(result.species.commonName)
    }

    @ViewBuilder
    private func section(_ title: String, symbol: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: symbol)
                .font(.caption.bold())
                .foregroundStyle(.secondary)
            content()
                .font(.body)
        }
    }

    private func bulletList(_ items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(items, id: \.self) { item in
                HStack(alignment: .top, spacing: 6) {
                    Text("•")
                    Text(item)
                }
            }
        }
    }
}
