import SwiftUI

struct GlobalSearchView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var query = ""

    private var results: [SearchResult] {
        guard query.count >= 2 else { return [] }
        let q = query.lowercased()
        var out: [SearchResult] = []

        // Packs
        out += appState.packsVM.packs
            .filter { $0.name.lowercased().contains(q) || ($0.description?.lowercased().contains(q) ?? false) }
            .map { .pack($0) }

        // Trips
        out += appState.tripsVM.trips
            .filter { $0.name.lowercased().contains(q)
                || ($0.location?.name?.lowercased().contains(q) ?? false)
                || ($0.description?.lowercased().contains(q) ?? false) }
            .map { .trip($0) }

        // Trail conditions
        out += appState.trailConditionsVM.reports
            .filter { $0.trailName.lowercased().contains(q)
                || ($0.trailRegion?.lowercased().contains(q) ?? false) }
            .map { .trailCondition($0) }

        return out
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Search")
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                #endif
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") { dismiss() }
                    }
                }
                .globalSearchField(text: $query)
        }
        #if os(iOS)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        #else
        .frame(minWidth: 680, idealWidth: 720, minHeight: 460, idealHeight: 500)
        #endif
        .accessibilityIdentifier("global_search_view")
    }

    @ViewBuilder
    private var content: some View {
        resultsContent
    }

    @ViewBuilder
    private var resultsContent: some View {
        if query.count < 2 {
            SearchPromptView()
        } else if results.isEmpty {
            ContentUnavailableView.search(text: query)
        } else {
            List(results) { result in
                Button {
                    navigate(to: result)
                    dismiss()
                } label: {
                    SearchResultRow(result: result)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("global_search_result_\(result.id)")
                .accessibilityLabel("\(result.title), \(result.typeName)")
            }
            .listStyle(.inset)
        }
    }

    private func navigate(to result: SearchResult) {
        switch result {
        case .pack(let p):
            appState.navItem = .packs
            appState.selectedPackId = p.id
        case .trip(let t):
            appState.navItem = .trips
            appState.selectedTripId = t.id
        case .trailCondition(let r):
            appState.navItem = .trailConditions
            appState.selectedReportId = r.id
        }
    }
}

private extension View {
    @ViewBuilder
    func globalSearchField(text: Binding<String>) -> some View {
        #if os(iOS)
        self.searchable(
            text: text,
            placement: .navigationBarDrawer(displayMode: .always),
            prompt: "Search packs, trips, trails…"
        )
        #else
        self.searchable(text: text, prompt: "Search packs, trips, trails…")
        #endif
    }
}

// MARK: - Search result row

private struct SearchResultRow: View {
    let result: SearchResult

    var body: some View {
        Label {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(result.title)
                        .lineLimit(1)

                    if let subtitle = result.subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }

                Spacer()

                Text(result.typeName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        } icon: {
            Image(systemName: result.symbol)
                .foregroundStyle(.tint)
        }
        .contentShape(Rectangle())
    }
}

private struct SearchPromptView: View {
    var body: some View {
        ContentUnavailableView(
            "Search PackRat",
            systemImage: "magnifyingglass",
            description: Text("Find packs, trips, and trail condition reports.")
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Search result model

enum SearchResult: Identifiable {
    case pack(Pack)
    case trip(Trip)
    case trailCondition(TrailConditionReport)

    var id: String {
        switch self {
        case .pack(let p): return "pack-\(p.id)"
        case .trip(let t): return "trip-\(t.id)"
        case .trailCondition(let r): return "trail-\(r.id)"
        }
    }

    var title: String {
        switch self {
        case .pack(let p): return p.name
        case .trip(let t): return t.name
        case .trailCondition(let r): return r.trailName
        }
    }

    var subtitle: String? {
        switch self {
        case .pack(let p): return p.category?.label
        case .trip(let t): return t.location?.name
        case .trailCondition(let r): return r.trailRegion
        }
    }

    var symbol: String {
        switch self {
        case .pack: return "backpack"
        case .trip: return "map"
        case .trailCondition: return "figure.hiking"
        }
    }

    var typeName: String {
        switch self {
        case .pack: return "Pack"
        case .trip: return "Trip"
        case .trailCondition: return "Trail"
        }
    }
}
