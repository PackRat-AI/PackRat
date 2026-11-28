import SwiftUI

struct GapAnalysisSheet: View {
    let pack: Pack
    let service: PackService
    let packsViewModel: PacksViewModel
    /// Called on close with how many suggested items were added, so the pack
    /// page can confirm it.
    var onClose: ((_ added: Int) -> Void)?

    @Environment(\.dismiss) private var dismiss
    @State private var destination = ""
    @State private var tripType = ""
    @State private var duration = ""
    @State private var result: GapAnalysisResult?
    @State private var isLoading = false
    @State private var error: String?
    @FocusState private var isInputFocused: Bool
    /// Catalog matches per suggestion, best first. Absent while loading.
    @State private var matches: [String: [CatalogItem]] = [:]
    /// The match chosen per suggestion when the hiker swapped away from the first.
    @State private var chosen: [String: Int] = [:]
    @State private var added: Set<String> = []
    @State private var adding: Set<String> = []
    @State private var addFailed = false

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
                    Button("Close") { close() }
                }
                if result != nil {
                    ToolbarItem(placement: .primaryAction) {
                        Button("Re-analyze") { reset() }
                    }
                }
            }
            .alert("Couldn't Add Item", isPresented: $addFailed) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Check your connection and try again.")
            }
        }
        .formSheetSize(minWidth: 520, minHeight: 560)
    }

    // MARK: - Setup Form

    private var setupForm: some View {
        Form {
            Section("Trip Context") {
                TextField("Destination", text: $destination)
                    .focused($isInputFocused)
                    .submitLabel(.done)
                    .onSubmit { isInputFocused = false }
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
                    .focused($isInputFocused)
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
        .packRatFormStyle()
        .dismissesKeyboardOnScroll()
        .keyboardDoneButton(isFocused: $isInputFocused)
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
                            GapSuggestionCard(
                                gap: gap,
                                matches: matches[gap.id],
                                chosenIndex: chosen[gap.id] ?? 0,
                                isAdded: added.contains(gap.id),
                                isAdding: adding.contains(gap.id),
                                onSwap: { chosen[gap.id] = $0 },
                                onAdd: { item in Task { await add(item, for: gap) } }
                            )
                        }
                    }
                }
            }
            .padding(.vertical)
        }
        .task(id: result.gaps.map(\.id)) { await loadMatches(for: result.gaps) }
    }

    // MARK: - Action

    private func close() {
        onClose?(added.count)
        dismiss()
    }

    private func reset() {
        result = nil
        matches = [:]
        chosen = [:]
        added = []
    }

    /// Finds catalog gear for every suggestion at once, as Android does.
    private func loadMatches(for gaps: [GapSuggestion]) async {
        await withTaskGroup(of: (String, [CatalogItem]).self) { group in
            for gap in gaps where matches[gap.id] == nil {
                group.addTask {
                    let found = (try? await CatalogService.shared.semanticSearch(query: gap.suggestion, limit: 6)) ?? []
                    return (gap.id, found)
                }
            }
            for await (id, found) in group {
                matches[id] = found
            }
        }
    }

    private func add(_ item: CatalogItem, for gap: GapSuggestion) async {
        adding.insert(gap.id)
        defer { adding.remove(gap.id) }
        do {
            try await packsViewModel.addItem(
                to: pack.id,
                name: item.name,
                weight: item.weight,
                weightUnit: item.weightUnit?.rawValue,
                quantity: 1,
                category: item.categories?.first,
                consumable: gap.consumable,
                worn: gap.worn,
                notes: nil,
                catalogItemId: item.id,
                image: item.primaryImage
            )
            added.insert(gap.id)
        } catch {
            addFailed = true
        }
    }

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
            let msg = error.localizedDescription
            if msg.contains("500") || msg.contains("Internal Server Error") {
                self.error = "AI analysis is temporarily unavailable on the server. Please try again later."
            } else {
                self.error = msg
            }
        }
    }
}

// MARK: - Gap Suggestion Card

private struct GapSuggestionCard: View {
    let gap: GapSuggestion
    /// Nil while the catalog search is running.
    let matches: [CatalogItem]?
    let chosenIndex: Int
    let isAdded: Bool
    let isAdding: Bool
    let onSwap: (Int) -> Void
    let onAdd: (CatalogItem) -> Void

    @Environment(\.weightUnit) private var weightUnit

    private var priorityColor: Color {
        switch gap.priority {
        case "must-have": return .red
        case "nice-to-have": return .orange
        default: return .secondary
        }
    }

    private var match: CatalogItem? {
        guard let matches, matches.indices.contains(chosenIndex) else { return matches?.first }
        return matches[chosenIndex]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
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

            if gap.worn || gap.consumable {
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

            matchRow
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }

    @ViewBuilder
    private var matchRow: some View {
        if matches == nil {
            HStack(spacing: 8) {
                ProgressView().controlSize(.small)
                Text("Finding gear in the catalog…")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(minHeight: 44)
        } else if let match {
            HStack(spacing: 12) {
                RemoteImage(url: match.primaryImage, contentMode: .fill, cornerRadius: 8) {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(.fill.secondary)
                        .overlay { Image(systemName: "photo").foregroundStyle(.tertiary) }
                }
                .frame(width: 44, height: 44)

                VStack(alignment: .leading, spacing: 3) {
                    Text(match.displayName)
                        .font(.subheadline.weight(.medium))
                        .lineLimit(1)
                    HStack(spacing: 8) {
                        if !match.displayWeight.isEmpty {
                            Text(match.displayWeight(in: weightUnit))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        if let price = match.displayPrice {
                            Text(price).font(.caption2.bold()).foregroundStyle(.green)
                        }
                    }
                }

                Spacer(minLength: 0)

                if !isAdded, let matches, matches.count > 1 {
                    Menu("Swap") {
                        ForEach(Array(matches.enumerated()), id: \.element.id) { index, item in
                            Button {
                                onSwap(index)
                            } label: {
                                if index == chosenIndex {
                                    Label(item.displayName, systemImage: "checkmark")
                                } else {
                                    Text(item.displayName)
                                }
                            }
                        }
                    }
                    .menuStyle(.borderlessButton)
                    .fixedSize()
                    .accessibilityIdentifier("gap_swap_\(gap.id)")
                }

                if isAdded {
                    Label("Added", systemImage: "checkmark.circle.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.green)
                } else if isAdding {
                    ProgressView().controlSize(.small)
                } else {
                    Button("Add") { onAdd(match) }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.small)
                        .accessibilityIdentifier("gap_add_\(gap.id)")
                }
            }
            .padding(10)
            .background(.background, in: RoundedRectangle(cornerRadius: 10))
        } else {
            Text("No matching gear in the catalog.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}
