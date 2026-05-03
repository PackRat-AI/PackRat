import SwiftUI

// MARK: - Models

struct SeasonSuggestion: Codable, Identifiable {
    let id: String
    let item: String
    let reason: String
    let category: String?
    let priority: String?
}

struct SeasonSuggestionsResponse: Codable {
    let suggestions: [SeasonSuggestion]?
    let location: String?
    let season: String?
    let data: [SeasonSuggestion]?

    var items: [SeasonSuggestion] { suggestions ?? data ?? [] }
}

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
            suggestions = response.items
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

            Section("\(viewModel.suggestions.count) suggestions") {
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

    private var priorityColor: Color {
        switch suggestion.priority {
        case "essential", "must-have": return .red
        case "recommended": return .orange
        default: return .secondary
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(suggestion.item)
                        .font(.body.bold())
                    Text(suggestion.reason)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if let priority = suggestion.priority {
                    Text(priority.capitalized)
                        .font(.caption2.bold())
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(priorityColor.opacity(0.12), in: Capsule())
                        .foregroundStyle(priorityColor)
                }
            }
            if let cat = suggestion.category {
                Label(cat.capitalized, systemImage: "tag")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}
