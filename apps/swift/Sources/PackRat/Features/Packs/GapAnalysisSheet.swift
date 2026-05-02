import SwiftUI

struct GapAnalysisSheet: View {
    let pack: Pack
    let service: PackService

    @Environment(\.dismiss) private var dismiss
    @State private var destination = ""
    @State private var tripType = ""
    @State private var duration = ""
    @State private var result: GapAnalysisResult?
    @State private var isLoading = false
    @State private var error: String?

    private let tripTypes = ["hiking", "backpacking", "camping", "climbing", "winter", "desert"]

    var body: some View {
        NavigationStack {
            Group {
                if let result {
                    analysisResult(result)
                } else {
                    setupForm
                }
            }
            .navigationTitle("Gap Analysis")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
                if result != nil {
                    ToolbarItem(placement: .primaryAction) {
                        Button("Re-analyze") { self.result = nil }
                    }
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 400, minHeight: 480)
        #endif
    }

    // MARK: - Setup Form

    private var setupForm: some View {
        Form {
            Section("Trip Context (optional)") {
                TextField("Destination (e.g. Yosemite, Alps)", text: $destination)
                Picker("Trip Type", selection: $tripType) {
                    Text("Any").tag("")
                    ForEach(tripTypes, id: \.self) { type in
                        Text(type.capitalized).tag(type)
                    }
                }
                TextField("Duration (days)", text: $duration)
                    #if os(iOS)
                    .keyboardType(.numberPad)
                    #endif
            }

            Section {
                if let error {
                    InlineErrorView(message: error)
                }
                AsyncButton("Analyze \"\(pack.name)\"") {
                    await analyze()
                }
                .frame(maxWidth: .infinity, alignment: .center)
                .disabled(isLoading)
            } footer: {
                Text("AI will review your pack items and suggest missing gear based on trip context and ultralight principles.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Result

    private func analysisResult(_ result: GapAnalysisResult) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let summary = result.summary {
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Summary", systemImage: "sparkles")
                            .font(.headline)
                        Text(summary)
                            .font(.body)
                            .foregroundStyle(.secondary)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.fill.secondary, in: RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal)
                }

                if result.gaps.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 44))
                            .foregroundStyle(.green)
                        Text("Pack looks complete!")
                            .font(.headline)
                        Text("No significant gear gaps found for your trip.")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 40)
                } else {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Suggested Additions")
                            .font(.headline)
                            .padding(.horizontal)

                        ForEach(result.gaps) { gap in
                            GapSuggestionCard(gap: gap)
                        }
                    }
                }
            }
            .padding(.vertical)
        }
    }

    // MARK: - Action

    private func analyze() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let durationInt = Int(duration)
            result = try await service.analyzeGaps(
                packId: pack.id,
                destination: destination.isEmpty ? nil : destination,
                tripType: tripType.isEmpty ? nil : tripType,
                duration: durationInt
            )
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - Gap Suggestion Card

private struct GapSuggestionCard: View {
    let gap: GapSuggestion

    private var priorityColor: Color {
        switch gap.priority {
        case "must-have": return .red
        case "nice-to-have": return .orange
        default: return .secondary
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(gap.suggestion)
                        .font(.body.bold())
                    Text(gap.reason)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if let priority = gap.priority {
                    Text(priority.replacingOccurrences(of: "-", with: " ").capitalized)
                        .font(.caption2.bold())
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(priorityColor.opacity(0.12), in: Capsule())
                        .foregroundStyle(priorityColor)
                }
            }

            HStack(spacing: 10) {
                if gap.worn {
                    Label("Worn", systemImage: "person.fill")
                        .font(.caption2)
                        .foregroundStyle(.orange)
                }
                if gap.consumable {
                    Label("Consumable", systemImage: "flame")
                        .font(.caption2)
                        .foregroundStyle(.purple)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }
}
