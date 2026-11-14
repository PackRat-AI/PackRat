#if os(iOS)
import CoreLocation
import SwiftUI

/// A place with a known outline that can be saved by name: a national park,
/// a state or province, or a country.
struct OfflineNamedRegion: Identifiable, Sendable {
    enum Kind: Sendable {
        case park, region, country
    }

    let id: String
    let name: String
    let subtitle: String
    let kind: Kind
    let rings: [[CLLocationCoordinate2D]]

    /// Every park, state, province and country the app carries an outline for.
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
        return (parks + regions + countries).sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }()

    /// The ones small enough to save whole at Standard detail. Big states and
    /// countries are left out rather than offered and then refused.
    static func saveable() async -> [OfflineNamedRegion] {
        await Task.detached(priority: .userInitiated) {
            all.filter { OfflineTilePacks.packs(for: $0.rings, detail: .standard).count <= OfflineTilePacks.limit }
        }.value
    }
}

/// Find a park, state or country by name, then save the map inside its outline.
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
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Park, state or country")
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
