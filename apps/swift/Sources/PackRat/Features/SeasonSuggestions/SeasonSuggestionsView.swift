import SwiftUI

// MARK: - Service

final class SeasonSuggestionsService: Sendable {
    static let shared = SeasonSuggestionsService()
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    func getSuggestions(location: String, date: String) async throws -> SeasonSuggestionsResponse {
        let endpoint = Endpoint(
            .post,
            "/api/season-suggestions",
            body: ["location": location, "date": date]
        )
        return try await api.send(endpoint)
    }
}

// MARK: - ViewModel

@Observable
@MainActor
final class SeasonSuggestionsViewModel {
    var suggestions: [SeasonSuggestion] = []
    var location = ""
    var detectedSeason: String?
    var detectedLocation: String?
    var isLoading = false
    var error: String?
    var hasLoaded = false

    private let service = SeasonSuggestionsService.shared

    func load() async {
        guard !location.isEmpty else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let formatter = ISO8601DateFormatter()
            let dateStr = formatter.string(from: Date())
            let response = try await service.getSuggestions(location: location, date: dateStr)
            suggestions = response.suggestions
            detectedSeason = response.season
            detectedLocation = response.location
            hasLoaded = true
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - View

struct SeasonSuggestionsView: View {
    @State private var viewModel = SeasonSuggestionsViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading {
                    ProgressView("Getting suggestions…").frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.hasLoaded && viewModel.suggestions.isEmpty {
                    EmptyStateView(
                        "No Suggestions",
                        subtitle: "No seasonal gear suggestions found for this location",
                        systemImage: "leaf"
                    )
                } else if viewModel.hasLoaded {
                    suggestionsList
                } else {
                    locationForm
                }
            }
            .navigationTitle("Season Suggestions")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.large)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                if viewModel.hasLoaded {
                    ToolbarItem(placement: .primaryAction) {
                        Button("New Search") {
                            viewModel.hasLoaded = false
                            viewModel.suggestions = []
                        }
                    }
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 400, minHeight: 500)
        #endif
    }

    private var locationForm: some View {
        VStack(spacing: 24) {
            VStack(spacing: 8) {
                Image(systemName: "leaf.circle.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(.mint)
                Text("AI-Powered Packing Tips")
                    .font(.title2.bold())
                Text("Get seasonal gear recommendations based on your destination.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }
            .padding(.top, 32)

            VStack(alignment: .leading, spacing: 8) {
                Text("Where are you going?")
                    .font(.subheadline.bold())
                TextField("e.g. Yosemite, Pacific Crest Trail…", text: $viewModel.location)
                    .textFieldStyle(.roundedBorder)
                    .submitLabel(.go)
                    .onSubmit { Task { await viewModel.load() } }
            }
            .padding(.horizontal, 24)

            if let error = viewModel.error {
                InlineErrorView(message: error)
                    .padding(.horizontal, 24)
            }

            Button {
                Task { await viewModel.load() }
            } label: {
                Label("Get Suggestions", systemImage: "sparkles")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.accentColor, in: RoundedRectangle(cornerRadius: 12))
                    .foregroundStyle(.white)
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 24)
            .disabled(viewModel.location.isEmpty || viewModel.isLoading)

            Spacer()
        }
    }

    private var suggestionsList: some View {
        List {
            if let season = viewModel.detectedSeason, let loc = viewModel.detectedLocation {
                Section {
                    HStack(spacing: 12) {
                        Image(systemName: seasonSymbol(season))
                            .font(.title)
                            .foregroundStyle(seasonColor(season))
                            .frame(width: 44, height: 44)
                            .background(seasonColor(season).opacity(0.12), in: Circle())
                        VStack(alignment: .leading, spacing: 2) {
                            Text(season.capitalized)
                                .font(.headline)
                            Text(loc)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }

            Section("\(viewModel.suggestions.count) pack suggestion\(viewModel.suggestions.count == 1 ? "" : "s")") {
                ForEach(viewModel.suggestions) { suggestion in
                    SeasonSuggestionRow(suggestion: suggestion)
                }
            }
        }
        #if os(iOS)
        .listStyle(.insetGrouped)
        #endif
    }

    private func seasonSymbol(_ season: String) -> String {
        switch season.lowercased() {
        case "spring": return "leaf.fill"
        case "summer": return "sun.max.fill"
        case "fall", "autumn": return "wind"
        case "winter": return "snowflake"
        default: return "calendar"
        }
    }

    private func seasonColor(_ season: String) -> Color {
        switch season.lowercased() {
        case "spring": return .green
        case "summer": return .yellow
        case "fall", "autumn": return .orange
        case "winter": return .blue
        default: return .accentColor
        }
    }
}

// MARK: - Row

private struct SeasonSuggestionRow: View {
    let suggestion: SeasonSuggestion
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(suggestion.name)
                        .font(.body.bold())
                    if let desc = suggestion.description {
                        Text(desc)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(expanded ? nil : 2)
                    }
                }
                Spacer()
                Button {
                    withAnimation { expanded.toggle() }
                } label: {
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }

            HStack(spacing: 8) {
                if let cat = suggestion.category {
                    Label(cat, systemImage: "tag")
                        .font(.caption2)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(Color.accentColor.opacity(0.08), in: Capsule())
                        .foregroundStyle(.tint)
                }
                if let count = suggestion.items?.count, count > 0 {
                    Label("\(count) items", systemImage: "archivebox")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            if expanded, let items = suggestion.items, !items.isEmpty {
                Divider()
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(items) { item in
                        HStack(alignment: .top, spacing: 8) {
                            VStack(alignment: .leading, spacing: 1) {
                                Text(item.name)
                                    .font(.caption.bold())
                                if let notes = item.notes {
                                    Text(notes)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(2)
                                }
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 1) {
                                if !item.displayWeight.isEmpty {
                                    Text(item.displayWeight)
                                        .font(.caption2.monospacedDigit())
                                        .foregroundStyle(.secondary)
                                }
                                if item.worn == true {
                                    Text("worn")
                                        .font(.caption2)
                                        .foregroundStyle(.orange)
                                }
                            }
                        }
                    }
                }
                .padding(.top, 2)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(.vertical, 4)
    }
}
