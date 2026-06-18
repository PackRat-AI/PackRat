import SwiftUI
import MapKit

struct LocationSearchResult: Identifiable {
    let id = UUID()
    let name: String
    let subtitle: String
    let latitude: Double
    let longitude: Double
}

struct LocationSearchView: View {
    let onSelect: (LocationSearchResult) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var results: [LocationSearchResult] = []
    @State private var isSearching = false
    @State private var searchTask: Task<Void, Never>?

    var body: some View {
        NavigationStack {
            List {
                if results.isEmpty && !query.isEmpty && !isSearching {
                    ContentUnavailableView.search(text: query)
                }
                ForEach(results) { result in
                    Button {
                        onSelect(result)
                        dismiss()
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(result.name).font(.body).foregroundStyle(.primary)
                            if !result.subtitle.isEmpty {
                                Text(result.subtitle).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.plain)
                }
            }
            .listStyle(.plain)
            .navigationTitle("Search Location")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .searchable(text: $query, prompt: "City, address, or landmark")
            .onChange(of: query) { search() }
            .overlay {
                if isSearching {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(.background.opacity(0.3))
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .formSheetSize(minWidth: 520, minHeight: 460)
    }

    private func search() {
        searchTask?.cancel()
        guard query.count >= 2 else { results = []; return }
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }
            await performSearch(query: query)
        }
    }

    @MainActor
    private func performSearch(query: String) async {
        isSearching = true
        defer { isSearching = false }
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = query
        request.resultTypes = [.pointOfInterest, .address]
        guard let response = try? await MKLocalSearch(request: request).start() else { return }
        results = response.mapItems.compactMap { item in
            guard let name = item.name else { return nil }
            let subtitle = [item.placemark.locality, item.placemark.administrativeArea, item.placemark.country]
                .compactMap { $0 }
                .joined(separator: ", ")
            return LocationSearchResult(
                name: name, subtitle: subtitle,
                latitude: item.placemark.coordinate.latitude,
                longitude: item.placemark.coordinate.longitude
            )
        }
    }
}
