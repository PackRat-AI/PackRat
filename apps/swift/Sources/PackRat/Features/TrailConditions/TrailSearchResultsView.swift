import MapKit
import SwiftUI

/// What searching Trail conditions finds: trails by name, and places, each
/// opening somewhere to read conditions. Never a filter over report text: a
/// hiker searching "Half Dome" wants the trail, not notes that mention it.
struct TrailSearchResultsView: View {
    let query: String
    let location: TrailReportLocationProvider

    @State private var trails: [TrailSummary] = []
    @State private var places: [LocationSearchResult] = []
    @State private var isLoading = false
    @State private var trailsFailed = false

    private let service = TrailConditionsService.shared

    private var trimmedQuery: String { query.trimmingCharacters(in: .whitespaces) }

    /// Re-runs when the query changes, or when a fix arrives to rank by.
    private var searchKey: String {
        let fix = location.coordinate.map { "\(($0.latitude * 100).rounded()),\(($0.longitude * 100).rounded())" }
        return "\(trimmedQuery)|\(fix ?? "-")"
    }

    var body: some View {
        List {
            if trailsFailed && trails.isEmpty {
                Section {
                    HStack {
                        Text("Couldn't search trails.")
                            .foregroundStyle(.secondary)
                        Spacer()
                        Button("Try Again") { Task { await search() } }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                    }
                }
            } else if !trails.isEmpty {
                Section {
                    ForEach(trails) { trail in
                        NavigationLink {
                            TrailPageView(trail: trail)
                        } label: {
                            TrailPickerRow(trail: trail, isSelected: false)
                        }
                        .accessibilityIdentifier("trail_search_trail_\(trail.id)")
                    }
                } header: {
                    HStack {
                        Text("Trails")
                        if isLoading {
                            Spacer()
                            ProgressView().controlSize(.small)
                        }
                    }
                }
            }
            if !places.isEmpty {
                Section("Places") {
                    ForEach(places) { place in
                        NavigationLink {
                            TrailsNearPlaceView(place: place)
                        } label: {
                            PlaceRow(place: place)
                        }
                        .accessibilityIdentifier("trail_search_place_\(place.name)")
                    }
                }
            }
            if trails.isEmpty && places.isEmpty && !trailsFailed {
                if isLoading {
                    HStack(spacing: 10) {
                        ProgressView()
                        Text("Searching…").foregroundStyle(.secondary)
                    }
                } else {
                    ContentUnavailableView(
                        "No Trails or Places",
                        systemImage: "magnifyingglass",
                        description: Text("Nothing matches “\(trimmedQuery)”. Try part of the trail's name, or the park it's in.")
                    )
                }
            }
        }
        .task { location.startIfAllowed() }
        .task(id: searchKey) { await search() }
    }

    private func search() async {
        let query = trimmedQuery
        guard !query.isEmpty else { return }
        // Debounce typing; a cancelled task means a newer query took over.
        try? await Task.sleep(for: .milliseconds(300))
        guard !Task.isCancelled else { return }
        isLoading = true
        defer { isLoading = false }
        let near = location.coordinate.map { ($0.latitude, $0.longitude) }
        async let foundPlaces = Self.searchPlaces(query)
        do {
            let found = try await service.searchTrails(query: query, near: near)
            guard !Task.isCancelled else { return }
            trails = found
            trailsFailed = false
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled else { return }
            trails = []
            trailsFailed = true
        }
        let placesFound = await foundPlaces
        guard !Task.isCancelled else { return }
        places = placesFound
    }

    /// Parks, peaks, towns: places a hiker names when they don't know the trail.
    private static func searchPlaces(_ query: String) async -> [LocationSearchResult] {
        guard query.count >= 2 else { return [] }
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = query
        request.resultTypes = [.pointOfInterest, .address]
        guard let response = try? await MKLocalSearch(request: request).start() else { return [] }
        return response.mapItems.prefix(5).compactMap { item in
            guard let name = item.name else { return nil }
            let subtitle = [item.placemark.locality, item.placemark.administrativeArea, item.placemark.country]
                .compactMap { $0 }
                .filter { $0 != name }
                .joined(separator: ", ")
            return LocationSearchResult(
                name: name,
                subtitle: subtitle,
                latitude: item.placemark.coordinate.latitude,
                longitude: item.placemark.coordinate.longitude
            )
        }
    }
}

private struct PlaceRow: View {
    let place: LocationSearchResult

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "mappin.and.ellipse")
                .font(.body)
                .foregroundStyle(.red)
                .frame(width: 32, height: 32)
                .background(.red.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(place.name)
                    .foregroundStyle(.primary)
                if !place.subtitle.isEmpty {
                    Text(place.subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

/// The trails around a place, nearest first, each opening its trail page.
struct TrailsNearPlaceView: View {
    let place: LocationSearchResult

    @State private var trails: [TrailSummary]?
    @State private var loadFailed = false

    private let service = TrailConditionsService.shared

    var body: some View {
        List {
            if let trails {
                if trails.isEmpty {
                    ContentUnavailableView(
                        "No Trails Nearby",
                        systemImage: "map",
                        description: Text("PackRat doesn't have trails mapped around \(place.name) yet.")
                    )
                } else {
                    Section("Nearest First") {
                        ForEach(trails) { trail in
                            NavigationLink {
                                TrailPageView(trail: trail)
                            } label: {
                                TrailPickerRow(trail: trail, isSelected: false)
                            }
                            .accessibilityIdentifier("trail_near_place_\(trail.id)")
                        }
                    }
                }
            } else if loadFailed {
                HStack {
                    Text("Couldn't load trails.").foregroundStyle(.secondary)
                    Spacer()
                    Button("Try Again") { Task { await load() } }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                }
            } else {
                HStack(spacing: 10) {
                    ProgressView()
                    Text("Finding trails…").foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle(place.name)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .task { await load() }
    }

    private func load() async {
        do {
            trails = try await service.searchTrails(query: nil, near: (place.latitude, place.longitude), limit: 50)
            loadFailed = false
        } catch is CancellationError {
            return
        } catch {
            if trails == nil { loadFailed = true }
        }
    }
}
