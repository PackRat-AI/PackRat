import SwiftUI

struct GlobalSearchView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var query = ""
    @FocusState private var isFocused: Bool

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
        VStack(spacing: 0) {
            searchBar
            Divider()
            resultsList
        }
        .frame(width: 560, height: 440)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.25), radius: 20, y: 10)
        .onAppear { isFocused = true }
    }

    private var searchBar: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
                .font(.title3)
            TextField("Search packs, trips, trails…", text: $query)
                .textFieldStyle(.plain)
                .font(.title3)
                .focused($isFocused)
                .onSubmit { dismiss() }
            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .keyboardShortcut(.escape, modifiers: [])
            }
        }
        .padding(16)
    }

    @ViewBuilder
    private var resultsList: some View {
        if query.count < 2 {
            VStack {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 36))
                    .foregroundStyle(.tertiary)
                    .padding(.bottom, 8)
                Text("Type at least 2 characters to search")
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if results.isEmpty {
            ContentUnavailableView.search(text: query)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(results) { result in
                        SearchResultRow(result: result) {
                            navigate(to: result)
                            dismiss()
                        }
                        Divider().padding(.leading, 44)
                    }
                }
                .padding(.vertical, 8)
            }
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

// MARK: - Search result row

private struct SearchResultRow: View {
    let result: SearchResult
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: result.symbol)
                    .font(.callout)
                    .foregroundStyle(.tint)
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text(result.title)
                        .font(.body)
                    if let subtitle = result.subtitle {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                Text(result.typeName)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(.fill.tertiary, in: Capsule())
                Image(systemName: "arrow.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(.clear)
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
        case .pack(let p): return p.category?.capitalized
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
