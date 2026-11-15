#if os(iOS)
import CoreLocation
import SwiftUI

/// A place with a known outline that can be saved by name: a national park,
/// a national forest or grassland, a state or province, or a country.
struct OfflineNamedRegion: Identifiable, Sendable {
    enum Kind: Sendable {
        case park, forest, region, country
    }

    let id: String
    let name: String
    let subtitle: String
    let kind: Kind
    let rings: [[CLLocationCoordinate2D]]

    /// Every park, forest, state, province and country the app carries an outline for.
    static let all: [OfflineNamedRegion] = {
        let parks = NationalParks.all.map { park in
            OfflineNamedRegion(
                id: "park-\(park.code)",
                name: "\(park.name) National Park",
                subtitle: park.states.joined(separator: ", "),
                kind: .park,
                rings: park.rings
            )
        }
        let forests = loadForests().map { forest in
            OfflineNamedRegion(
                id: "forest-\(forest.code)",
                name: forest.name,
                subtitle: forest.states.joined(separator: ", "),
                kind: .forest,
                rings: forest.rings
            )
        }
        let atlas = Places.atlas
        let regions = atlas.regions.map { region in
            OfflineNamedRegion(
                id: "region-\(region.code)",
                name: region.name,
                subtitle: region.countryCode.map { Places.countryName($0, atlas: atlas) } ?? "",
                kind: .region,
                rings: region.rings
            )
        }
        let countries = atlas.countries.filter { !$0.rings.isEmpty }.map { country in
            OfflineNamedRegion(id: "country-\(country.code)", name: country.name, subtitle: "", kind: .country, rings: country.rings)
        }
        return (parks + forests + regions + countries).sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }()

    /// National forests and grasslands from the bundled `NationalForests.json`
    /// (built by `apps/swift/scripts/generate-national-forests.ts` from the
    /// Forest Service's boundaries). Same layout as `NationalParks.json`.
    private static func loadForests() -> [(code: String, name: String, states: [String], rings: [[CLLocationCoordinate2D]])] {
        struct Row: Decodable {
            let code: String
            let name: String
            let states: [String]
            /// Flat `[lng, lat, lng, lat, …]` per ring.
            let rings: [[Double]]
        }
        guard let url = Bundle.main.url(forResource: "NationalForests", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let rows = try? JSONDecoder().decode([Row].self, from: data)
        else { return [] }
        return rows.map { row in
            let rings = row.rings.map { flat in
                stride(from: 0, to: flat.count - 1, by: 2).map {
                    CLLocationCoordinate2D(latitude: flat[$0 + 1], longitude: flat[$0])
                }
            }
            return (row.code, row.name, row.states, rings)
        }
    }

    /// The ones small enough to save whole at Standard detail. Big states and
    /// countries are left out rather than offered and then refused.
    static func saveable() async -> [OfflineNamedRegion] {
        await Task.detached(priority: .userInitiated) {
            all.filter { OfflineTilePacks.packs(for: $0.rings, detail: .standard).count <= OfflineTilePacks.budget }
        }.value
    }
}

/// Find a park, forest, state or country by name, then save the map inside its outline.
struct OfflineRegionListView: View {
    /// Closes the whole flow once a download starts.
    var onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var regions: [OfflineNamedRegion]?

    private var matches: [OfflineNamedRegion] {
        let regions = regions ?? []
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return regions }
        return regions.filter {
            $0.name.localizedStandardContains(trimmed) || $0.subtitle.localizedStandardContains(trimmed)
        }
    }

    var body: some View {
        let matches = matches
        List {
            section("National Parks", matches.filter { $0.kind == .park })
            section("National Forests and Grasslands", matches.filter { $0.kind == .forest })
            section("States and Provinces", matches.filter { $0.kind == .region })
            section("Countries", matches.filter { $0.kind == .country })
        }
        .overlay {
            if regions == nil {
                ProgressView()
            } else if matches.isEmpty {
                ContentUnavailableView.search(text: query)
            }
        }
        .task { regions = await OfflineNamedRegion.saveable() }
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Park, forest, state or country")
        .navigationTitle("Parks and Regions")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
        .accessibilityIdentifier("offline_region_list")
    }

    @ViewBuilder
    private func section(_ title: String, _ regions: [OfflineNamedRegion]) -> some View {
        if !regions.isEmpty {
            Section(title) {
                ForEach(regions) { region in
                    NavigationLink {
                        OfflineAreaPickerView(region: region, onSaved: onSaved)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(region.name)
                            if !region.subtitle.isEmpty {
                                Text(region.subtitle)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .accessibilityIdentifier("offline_region_\(region.id)")
                }
            }
        }
    }
}
#endif
