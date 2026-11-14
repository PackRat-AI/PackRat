import MapKit
import SwiftUI

// MARK: - Countries & States card

/// Countries and states counted, a strip of flags, and what's new or most
/// visited, opening the full list. Follows the stats screen's year and
/// activity filters. Hidden by the caller when no trip has a place.
struct PlacesCard: View {
    let places: TripPlaces
    let scope: TripStats.Scope

    var body: some View {
        NavigationLink {
            PlacesListView(scope: scope)
        } label: {
            StatsCard(title: "Countries & States") {
                HStack(alignment: .top, spacing: 20) {
                    figure(places.countries.count, places.countries.count == 1 ? "Country" : "Countries")
                    if places.regionCount > 0 {
                        figure(places.regionCount, places.regionLabel)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.tertiary)
                }
                FlagStrip(countries: places.countries)
                if let summary {
                    Text(summary)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityIdentifier("trip_stats_places_card")
    }

    private func figure(_ value: Int, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value, format: .number)
                .font(.title.weight(.bold))
                .monospacedDigit()
                .contentTransition(.numericText())
            Text(label).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
        }
    }

    /// Under a year filter, what was new that year; otherwise the most-visited place.
    private var summary: String? {
        if let year = scope.year, let window = Self.window(year) {
            let new = places.newCountries(from: window.start, to: window.end).map(\.name)
                + places.newRegions(from: window.start, to: window.end).map(\.name)
            guard !new.isEmpty else { return nil }
            let shown = new.prefix(3).map { $0 } + (new.count > 3 ? ["\(new.count - 3) more"] : [])
            return "New in \(String(year)): " + shown.formatted(.list(type: .and))
        }
        let regions = places.countries.flatMap(\.regions)
        if let top = regions.max(by: { ($0.trips, $1.name) < ($1.trips, $0.name) }), top.trips > 1 {
            return "Most visited: \(top.name) · \(top.trips) trips"
        }
        if let top = places.countries.first, top.trips > 1 {
            return "Most visited: \(top.name) · \(top.trips) trips"
        }
        return nil
    }

    private var accessibilityLabel: String {
        var label = "Countries and states, \(places.countries.count) countries"
        if places.regionCount > 0 { label += ", \(places.regionCount) \(places.regionLabel.lowercased())" }
        return label
    }

    static func window(_ year: Int) -> (start: Date, end: Date)? {
        let calendar = Calendar.current
        guard let start = calendar.date(from: DateComponents(year: year, month: 1, day: 1)),
              let next = calendar.date(byAdding: .year, value: 1, to: start),
              let end = calendar.date(byAdding: .second, value: -1, to: next)
        else { return nil }
        return (start, end)
    }
}

/// A row of flags, busiest country first, with "+N" past what fits.
private struct FlagStrip: View {
    let countries: [TripPlaces.CountryStatus]
    private let limit = 9

    var body: some View {
        let flags = countries.compactMap(\.flag)
        if !flags.isEmpty {
            HStack(spacing: 6) {
                ForEach(Array(flags.prefix(limit).enumerated()), id: \.offset) { _, flag in
                    Text(flag)
                        .font(.title2)
                        .frame(width: 34, height: 34)
                        .background(.background.secondary, in: Circle())
                }
                if flags.count > limit {
                    Text("+\(flags.count - limit)")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(height: 34)
                        .padding(.horizontal, 10)
                        .background(.background.secondary, in: Capsule())
                }
            }
            .accessibilityHidden(true)
        }
    }
}

// MARK: - Countries & States list

extension AppState {
    /// Countries and regions for the trips inside the scope, with first
    /// visits read from the whole record.
    func tripPlaces(scope: TripStats.Scope) -> TripPlaces {
        let stats = TripStats(trips: tripsVM.trips, packs: [], scope: scope)
        return TripPlaces(finished: stats.finished, lifetime: stats.allFinished)
    }
}

struct PlacesListView: View {
    @Environment(AppState.self) private var appState
    let scope: TripStats.Scope

    var body: some View {
        let places = appState.tripPlaces(scope: scope)
        List {
            Section {
                HStack(spacing: 24) {
                    figure(places.countries.count, places.countries.count == 1 ? "Country" : "Countries")
                    if places.regionCount > 0 {
                        figure(places.regionCount, places.regionLabel)
                    }
                }
                .padding(.vertical, 4)
            } footer: {
                if !scope.isAll {
                    Text("Trips in \(TripStatsScopeBar.title(scope)). First visits are from all your trips.")
                }
            }

            ForEach(places.countries) { country in
                Section {
                    NavigationLink {
                        PlaceDetailView(code: country.code, scope: scope)
                    } label: {
                        PlaceRow(
                            leading: country.flag ?? "🏳️",
                            name: country.name,
                            trips: country.trips,
                            firstVisit: country.firstVisit,
                            prominent: true
                        )
                    }
                    .accessibilityIdentifier("place_row_\(country.code)")
                    ForEach(country.regions) { region in
                        NavigationLink {
                            PlaceDetailView(code: region.code, scope: scope)
                        } label: {
                            PlaceRow(leading: nil, name: region.name, trips: region.trips, firstVisit: region.firstVisit, prominent: false)
                        }
                        .accessibilityIdentifier("place_row_\(region.code)")
                    }
                }
            }

            Section {
            } footer: {
                Text("A trip counts in every country and state its location or route passes through. States and provinces are listed for the United States, Canada and Australia.")
            }
        }
        .overlay {
            if places.isEmpty {
                ContentUnavailableView(
                    "No Places Yet",
                    systemImage: "globe.americas",
                    description: Text("Give a trip a location and it shows up here.")
                )
            }
        }
        .navigationTitle("Countries & States")
        .accessibilityIdentifier("places_list")
    }

    private func figure(_ value: Int, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value, format: .number).font(.title2.weight(.bold)).monospacedDigit()
            Text(label).font(.subheadline).foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
    }
}

private struct PlaceRow: View {
    /// A flag for a country; nil indents a region under it.
    let leading: String?
    let name: String
    let trips: Int
    let firstVisit: Date
    let prominent: Bool

    var body: some View {
        HStack(spacing: 12) {
            if let leading {
                Text(leading).font(.title2)
            } else {
                Color.clear.frame(width: 28, height: 1)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(prominent ? .body.weight(.semibold) : .body)
                Text("First visit \(firstVisit.formatted(.dateTime.month(.abbreviated).year()))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            Text(trips == 1 ? "1 trip" : "\(trips) trips")
                .font(.subheadline)
                .monospacedDigit()
                .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Place detail

/// One country or state: its outline (or, for a country listed by state, the
/// states visited), a pin per trip, and the trips themselves.
struct PlaceDetailView: View {
    @Environment(AppState.self) private var appState
    let code: String
    let scope: TripStats.Scope

    private var atlas: PlaceAtlas { Places.atlas }

    var body: some View {
        let places = appState.tripPlaces(scope: scope)
        let country = places.countries.first { $0.code == code }
        let regionParent = places.countries.first { $0.regions.contains { $0.code == code } }
        let region = regionParent?.regions.first { $0.code == code }
        let shapes = outlines(country: country, region: region)
        let visits = country?.visits ?? region?.visits ?? []
        let trips = appState.tripsVM.trips

        List {
            Section {
                placeMap(shapes: shapes, visits: visits, trips: trips)
                    .frame(height: 240)
                    .listRowInsets(EdgeInsets())
                    .accessibilityIdentifier("place_detail_map")
            }

            if let country, !country.regions.isEmpty {
                Section(Places.regionNoun(country: country.code)) {
                    ForEach(country.regions) { region in
                        NavigationLink {
                            PlaceDetailView(code: region.code, scope: scope)
                        } label: {
                            PlaceRow(leading: nil, name: region.name, trips: region.trips, firstVisit: region.firstVisit, prominent: false)
                        }
                    }
                }
            }

            Section {
                ForEach(visits) { visit in
                    Button {
                        appState.selectedTripId = visit.tripId
                        appState.navItem = .trips
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(visit.tripName)
                                Text(visit.date.formatted(date: .abbreviated, time: .omitted))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            } header: {
                Text("Trips")
            } footer: {
                if let first = country?.firstVisit ?? region?.firstVisit {
                    Text("First visit \(first.formatted(date: .long, time: .omitted)).")
                }
            }
        }
        .navigationTitle(country.map { "\($0.flag.map { "\($0) " } ?? "")\($0.name)" } ?? region?.name ?? "Place")
        .accessibilityIdentifier("place_detail")
    }

    @ViewBuilder
    private func placeMap(shapes: [PlaceBoundary], visits: [TripPlaces.Visit], trips: [Trip]) -> some View {
        #if os(iOS)
        if OfflineMapStore.isEnabled {
            MapboxOutlineMap(
                rings: shapes.flatMap(\.rings),
                pins: visits.compactMap { visit in
                    trips.first(where: { $0.id == visit.tripId })?.location.map { location in
                        MapboxOutlineMap.Pin(
                            id: visit.id,
                            title: visit.tripName,
                            systemImage: "tent.fill",
                            coordinate: CLLocationCoordinate2D(latitude: location.latitude, longitude: location.longitude)
                        )
                    }
                },
                tint: .tintColor
            )
        } else {
            placeMapKitMap(shapes: shapes, visits: visits, trips: trips)
        }
        #else
        placeMapKitMap(shapes: shapes, visits: visits, trips: trips)
        #endif
    }

    private func placeMapKitMap(shapes: [PlaceBoundary], visits: [TripPlaces.Visit], trips: [Trip]) -> some View {
        Map(initialPosition: Self.position(for: shapes), interactionModes: [.zoom, .pan]) {
            ForEach(shapes) { shape in
                ForEach(Array(shape.rings.enumerated()), id: \.offset) { _, ring in
                    MapPolygon(coordinates: ring)
                        .foregroundStyle(Color.accentColor.opacity(0.18))
                        .stroke(Color.accentColor, lineWidth: 1.2)
                }
            }
            ForEach(visits) { visit in
                if let location = trips.first(where: { $0.id == visit.tripId })?.location {
                    Marker(visit.tripName, systemImage: "tent.fill",
                           coordinate: CLLocationCoordinate2D(latitude: location.latitude, longitude: location.longitude))
                        .tint(Color.accentColor)
                }
            }
        }
        .mapStyle(.standard(elevation: .realistic, pointsOfInterest: .excludingAll))
    }

    /// A region's own outline; a country's, or for one listed by state, the
    /// states visited (the country carries no outline of its own then).
    private func outlines(country: TripPlaces.CountryStatus?, region: TripPlaces.RegionStatus?) -> [PlaceBoundary] {
        if let region { return atlas.region(region.code).map { [$0] } ?? [] }
        guard let country else { return [] }
        if let own = atlas.country(country.code), !own.rings.isEmpty { return [own] }
        return country.regions.compactMap { atlas.region($0.code) }
    }

    /// Fits the outlines; a shape spanning the antimeridian (Alaska, Fiji)
    /// falls back to the map's own framing.
    private static func position(for shapes: [PlaceBoundary]) -> MapCameraPosition {
        guard !shapes.isEmpty else { return .automatic }
        let minLat = shapes.map(\.minLatitude).min() ?? 0, maxLat = shapes.map(\.maxLatitude).max() ?? 0
        let minLon = shapes.map(\.minLongitude).min() ?? 0, maxLon = shapes.map(\.maxLongitude).max() ?? 0
        guard maxLon - minLon < 180 else { return .automatic }
        let corners = [
            MKMapPoint(CLLocationCoordinate2D(latitude: minLat, longitude: minLon)),
            MKMapPoint(CLLocationCoordinate2D(latitude: maxLat, longitude: maxLon)),
        ]
        let rect = MKMapRect(
            x: min(corners[0].x, corners[1].x),
            y: min(corners[0].y, corners[1].y),
            width: abs(corners[0].x - corners[1].x),
            height: abs(corners[0].y - corners[1].y)
        )
        return .rect(rect.insetBy(dx: -rect.width * 0.1, dy: -rect.height * 0.1))
    }
}

// MARK: - Not packed in a year

/// Gear in the user's packs that no finished trip has carried in twelve
/// months. Neutral: a record of what's resting, not a verdict on it.
struct IdleGearCard: View {
    let gear: IdleGear
    let unit: AppWeightUnit

    var body: some View {
        NavigationLink {
            IdleGearListView()
        } label: {
            StatsCard(
                title: "Not Packed in a Year",
                subtitle: "In your packs, not on a trip since \(gear.since.formatted(.dateTime.month(.wide).year()))"
            ) {
                HStack(alignment: .top, spacing: 20) {
                    figure("\(gear.items.count)", gear.items.count == 1 ? "Item" : "Items")
                    if gear.totalGrams > 0 {
                        figure(unit.display(grams: gear.totalGrams), "Combined Weight")
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.tertiary)
                }
                Text(preview)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("trip_stats_idle_gear_card")
    }

    private var preview: String {
        let names = gear.items.prefix(3).map(\.name)
        let rest = gear.items.count - names.count
        return (names + (rest > 0 ? ["\(rest) more"] : [])).formatted(.list(type: .and))
    }

    private func figure(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.title.weight(.bold)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
            Text(label).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
        }
    }
}

struct IdleGearListView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.weightUnit) private var weightUnit

    var body: some View {
        let stats = TripStats(trips: appState.tripsVM.trips, packs: [])
        let gear = IdleGear(finished: stats.allFinished, packs: appState.packsVM.packs)
        List {
            if !gear.neverTaken.isEmpty {
                Section {
                    ForEach(gear.neverTaken) { row($0) }
                } header: {
                    Text("Never on a Trip")
                } footer: {
                    Text("In your packs for over a year without going on a finished trip.")
                }
            }
            if !gear.takenBefore.isEmpty {
                Section("Last on a Trip") {
                    ForEach(gear.takenBefore) { row($0) }
                }
            }
            Section {
            } footer: {
                Text("Based on the packs linked to your trips. Food and other consumables aren't counted.")
            }
        }
        .overlay {
            if gear.isEmpty {
                ContentUnavailableView(
                    "Everything's Been Out",
                    systemImage: "checkmark.circle",
                    description: Text("Every item in your packs has been on a trip in the last year.")
                )
            }
        }
        .navigationTitle("Not Packed in a Year")
        .accessibilityIdentifier("idle_gear_list")
    }

    private func row(_ item: IdleGear.Item) -> some View {
        NavigationLink {
            if let pack = appState.packsVM.packs.first(where: { $0.id == item.packId }) {
                PackDetailView(pack: pack, viewModel: appState.packsVM)
            }
        } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.name)
                    Text(detail(item)).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                }
                Spacer(minLength: 8)
                if item.grams > 0 {
                    Text(weightUnit.display(grams: item.grams))
                        .font(.subheadline)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
            }
        }
        .accessibilityIdentifier("idle_gear_row_\(item.id)")
    }

    private func detail(_ item: IdleGear.Item) -> String {
        let packs = item.packNames.formatted(.list(type: .and))
        guard let last = item.lastTrip else { return packs }
        return "\(packs) · last \(last.name), \(last.date.formatted(.dateTime.month(.abbreviated).year()))"
    }
}
