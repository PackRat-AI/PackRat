import SwiftUI

// MARK: - Landscapes card

/// Trips by landscape, most first, each row opening its trips. Follows the
/// stats screen's year and activity filters. Hidden by the caller when no
/// trip has a place.
struct LandscapesCard: View {
    let landscapes: TripLandscapes
    let scope: TripStats.Scope

    var body: some View {
        StatsCard(title: "Landscapes") {
            let most = landscapes.buckets.first?.trips.count ?? 1
            VStack(spacing: 0) {
                ForEach(Array(landscapes.buckets.enumerated()), id: \.element.id) { index, bucket in
                    if index > 0 { Divider() }
                    NavigationLink {
                        LandscapeTripsView(landscape: bucket.landscape, scope: scope)
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: bucket.landscape.symbol)
                                .foregroundStyle(Color.accentColor)
                                .frame(width: 24)
                            Text(bucket.landscape.label)
                            Spacer(minLength: 8)
                            Capsule()
                                .fill(Color.accentColor.opacity(0.25))
                                .frame(width: 60 * CGFloat(bucket.trips.count) / CGFloat(most), height: 6)
                            Text("\(bucket.trips.count)")
                                .font(.subheadline.weight(.semibold))
                                .monospacedDigit()
                                .frame(minWidth: 20, alignment: .trailing)
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.tertiary)
                        }
                        .padding(.vertical, 10)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(bucket.landscape.label), \(bucket.trips.count) trip\(bucket.trips.count == 1 ? "" : "s")")
                    .accessibilityAddTraits(.isButton)
                    .accessibilityIdentifier("trip_stats_landscape_\(bucket.landscape.rawValue)")
                }
            }
        }
        .accessibilityIdentifier("trip_stats_landscapes_card")
    }
}

// MARK: - Trips in a landscape

struct LandscapeTripsView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext
    let landscape: TripLandscape
    let scope: TripStats.Scope

    private var trips: [TripStats.FinishedTrip] {
        let stats = TripStats(trips: appState.tripsVM.trips, packs: [], scope: scope)
        return TripLandscapes(finished: stats.finished).buckets.first { $0.landscape == landscape }?.trips ?? []
    }

    var body: some View {
        List {
            Section {
                ForEach(trips) { trip in
                    Button {
                        appState.selectedTripId = trip.id
                        appState.navItem = .trips
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(trip.trip.name).foregroundStyle(.primary)
                                Text(trip.trip.dateRange).font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .contextMenu { landscapeMenu(trip.trip) }
                }
            } footer: {
                VStack(alignment: .leading, spacing: 6) {
                    #if os(iOS)
                    Text("Touch and hold a trip to move it to another landscape.")
                    #else
                    Text("Control-click a trip to move it to another landscape.")
                    #endif
                    Text("Climate zones © Beck et al. 2023, CC BY 4.0.")
                }
            }
        }
        .navigationTitle(landscape.label)
        .overlay {
            if trips.isEmpty {
                ContentUnavailableView("No \(landscape.label) Trips", systemImage: landscape.symbol)
            }
        }
    }

    @ViewBuilder
    private func landscapeMenu(_ trip: Trip) -> some View {
        Picker("Landscape", selection: Binding(
            get: { trip.log?.landscape },
            set: { chosen in
                var log = trip.log ?? TripLog()
                log.landscape = chosen
                Task { await appState.tripsVM.saveLog(log, for: trip.id, context: modelContext) }
            }
        )) {
            Text("Automatic").tag(TripLandscape?.none)
            ForEach(TripLandscape.allCases) { option in
                Label(option.label, systemImage: option.symbol).tag(Optional(option))
            }
        }
    }
}
