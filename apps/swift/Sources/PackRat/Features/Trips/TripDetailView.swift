import SwiftUI
import MapKit
import CoreLocation

struct TripDetailView: View {
    /// The trip as it was when this screen opened. Read `trip` instead: a pushed
    /// destination keeps its original value, so an edit made from this screen
    /// (linking a pack, moving the dates) would otherwise never show here.
    private let openedTrip: Trip
    let viewModel: TripsViewModel

    init(trip: Trip, viewModel: TripsViewModel) {
        openedTrip = trip
        self.viewModel = viewModel
    }

    private var trip: Trip {
        viewModel.trips.first { $0.id == openedTrip.id } ?? openedTrip
    }

    /// Over once its last day has passed, the point a trip can be logged.
    private var isFinished: Bool {
        guard let end = (trip.endDate ?? trip.startDate)?.toDate() else { return false }
        return Calendar.current.startOfDay(for: end) < Calendar.current.startOfDay(for: .now)
    }

    private var route: [CLLocationCoordinate2D] {
        trip.log?.route.map(Polyline.decode) ?? []
    }

    @State private var showingEditSheet = false
    /// The trip's pack pushed on top of the trip; `true` opens it in packing mode.
    @State private var pushedPack: PackRoute?

    struct PackRoute: Hashable {
        let packId: String
        let packing: Bool
    }
    @State private var mapPosition: MapCameraPosition = .automatic
    @Environment(AppState.self) private var appState
    @Environment(\.weightUnit) private var weightUnit

    private var coordinate: CLLocationCoordinate2D? {
        guard let lat = trip.location?.latitude, let lon = trip.location?.longitude,
              lat != 0 || lon != 0
        else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    private var hasOverviewDetails: Bool {
        !trip.dateRange.isEmpty
        || trip.location?.name?.isEmpty == false
        || trip.description?.isEmpty == false
        || trip.notes?.isEmpty == false
    }

    private var remindersEnabled: Bool {
        FeatureFlagStore.shared.isEnabled(TripReminderPlanner.flagKey)
    }

    private var safetyEnabled: Bool { SafetyCheckInStore.isEnabled }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                #if os(iOS)
                if safetyEnabled {
                    TripSafetySection(trip: trip, viewModel: viewModel)
                        .padding(.top, 8)
                }
                #endif

                if remindersEnabled, TripReminderPlanner.isDepartureNear(trip, now: Date()) {
                    TripReadinessCard(
                        trip: trip,
                        onLinkPack: { showingEditSheet = true },
                        onStartPacking: { pushedPack = PackRoute(packId: $0, packing: true) }
                    )
                        .padding(.top, 8)
                }

                metaCards
                    .padding(.top, 8)

                if isFinished, NavItem.tripStats.isFeatureEnabled {
                    TripLogSection(trip: trip, viewModel: viewModel)
                }

                // Map — shown when the trip has coordinates
                if let coord = coordinate {
                    tripMap(coord: coord)
                        .frame(height: 220)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .padding(.horizontal)
                }

                if let desc = trip.description, !desc.isEmpty {
                    labeledSection("Description") {
                        Text(desc).font(.body)
                    }
                }

                if let notes = trip.notes, !notes.isEmpty {
                    labeledSection("Notes") {
                        Text(notes)
                            .font(.body)
                            .foregroundStyle(.secondary)
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(.fill.secondary, in: RoundedRectangle(cornerRadius: 10))
                    }
                }

                if !hasOverviewDetails {
                    ContentUnavailableView {
                        Label("No Trip Details", systemImage: "map")
                            .symbolRenderingMode(.hierarchical)
                    } description: {
                        Text("Add dates, a location, notes, and a linked pack to make this trip easier to plan.")
                    } actions: {
                        Button("Edit Trip") { showingEditSheet = true }
                            .buttonStyle(.borderedProminent)
                    }
                    .padding(.horizontal)
                    .frame(maxWidth: .infinity, minHeight: 220)
                }

                packSection

                #if os(iOS)
                if safetyEnabled {
                    PlannedRouteSection(trip: trip, viewModel: viewModel)
                }
                #endif

                if remindersEnabled {
                    TripChecklistSection(trip: trip, viewModel: viewModel)
                }

                #if os(iOS)
                if remindersEnabled {
                    TripRemindersRow(trip: trip)
                }
                #endif
            }
            .padding(.bottom)
        }
        .navigationTitle(trip.name)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.large)
        #endif
        .toolbar {
            #if os(iOS)
            if safetyEnabled, SafetyCheckInStore.shared.checkIn(forTrip: trip.id) != nil {
                ToolbarItem(placement: .primaryAction) {
                    Image(systemName: "shield.lefthalf.filled")
                        .foregroundStyle(.green)
                        .accessibilityLabel("Safety check-in active")
                        .accessibilityIdentifier("trip_safety_shield")
                }
            }
            #endif
            ToolbarItem(placement: .primaryAction) {
                Button("Edit", systemImage: "pencil") { showingEditSheet = true }
                    .accessibilityIdentifier("trip_detail_edit_button")
            }
        }
        .sheet(isPresented: $showingEditSheet) {
            TripFormView(viewModel: viewModel, existingTrip: trip)
        }
        .navigationDestination(item: $pushedPack) { route in
            if let pack = appState.packsVM.packs.first(where: { $0.id == route.packId }) {
                PackDetailView(pack: pack, viewModel: appState.packsVM, startInPackingMode: route.packing)
            }
        }
        .onAppear {
            if route.count >= 2 {
                mapPosition = .automatic
            } else if let coord = coordinate {
                mapPosition = .region(MKCoordinateRegion(
                    center: coord,
                    span: MKCoordinateSpan(latitudeDelta: 0.5, longitudeDelta: 0.5)
                ))
            }
        }
    }

    @ViewBuilder
    private var packSection: some View {
        let linkedPack = appState.packsVM.packs.first(where: { $0.id == trip.packId })
        labeledSection("Pack") {
            if let pack = linkedPack {
                let packing = packingState(pack)
                VStack(spacing: 10) {
                    Button {
                        pushedPack = PackRoute(packId: pack.id, packing: false)
                    } label: {
                        HStack(spacing: 12) {
                            RoundedRectangle(cornerRadius: 7, style: .continuous)
                                .fill(Color.blue.gradient)
                                .frame(width: 30, height: 30)
                                .overlay {
                                    Image(systemName: "backpack.fill")
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundStyle(.white)
                                }

                            VStack(alignment: .leading, spacing: 2) {
                                Text(pack.name).font(.callout.bold())
                                packStatus(packing)
                            }
                            Spacer()
                            if let total = pack.totalWeight {
                                Text(pack.formattedWeight(total, in: weightUnit))
                                    .font(.callout.monospacedDigit().bold())
                                    .foregroundStyle(.tint)
                            }
                            Image(systemName: "chevron.right")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(.secondary)
                        }
                    }
                    .buttonStyle(.plain)
                    .padding(14)
                    .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                    Button {
                        pushedPack = PackRoute(packId: pack.id, packing: true)
                    } label: {
                        Label(packingButtonTitle(packing), systemImage: packing.progress == .done ? "checkmark.circle" : "checklist")
                            .font(.callout.weight(.semibold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                    .accessibilityIdentifier("trip_detail_start_packing")
                }
            } else {
                Button {
                    showingEditSheet = true
                } label: {
                    Label("Link a Pack", systemImage: "plus.circle")
                        .font(.callout)
                }
                .buttonStyle(.bordered)
            }
        }
    }

    private func packingState(_ pack: Pack) -> TripReminderPlanner.PackState {
        let packed = Set(PackingModeStore.shared.packedItems(in: pack.id).filter(\.value).keys)
        return TripReminderPlanner.PackState(pack: pack, packedItemIds: packed)
    }

    /// Item count, or how far packing has got once it has started — so "All
    /// packed" shows on the trip whether or not the readiness card is up.
    @ViewBuilder
    private func packStatus(_ state: TripReminderPlanner.PackState) -> some View {
        switch state.progress {
        case .done:
            Label("All packed", systemImage: "checkmark.circle.fill")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.green)
                .accessibilityIdentifier("trip_detail_all_packed")
        case .partial(let packed, let total) where packed > 0:
            Text("\(packed) of \(total) packed")
                .font(.caption)
                .foregroundStyle(.secondary)
        case .partial(_, let total):
            Text("\(total) items")
                .font(.caption)
                .foregroundStyle(.secondary)
        case .empty, .noPack:
            Text("0 items")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private func packingButtonTitle(_ state: TripReminderPlanner.PackState) -> String {
        switch state.progress {
        case .done: "Review Packing"
        case .partial(let packed, _) where packed > 0: "Continue Packing"
        default: "Start Packing"
        }
    }

    @ViewBuilder
    private var metaCards: some View {
        if !trip.dateRange.isEmpty || trip.location?.name?.isEmpty == false {
            HStack(spacing: 10) {
                if !trip.dateRange.isEmpty {
                    metaCard("Dates", trip.dateRange, symbol: "calendar", color: .blue)
                }
                if let loc = trip.location?.name, !loc.isEmpty {
                    metaCard("Location", loc, symbol: "mappin.circle.fill", color: .red)
                }
            }
            .padding(.horizontal)
        }
    }

    private func metaCard(_ label: String, _ value: String, symbol: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(label, systemImage: symbol).font(.caption).foregroundStyle(color)
            Text(value).font(.callout.bold()).lineLimit(2)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }

    private func tripMap(coord: CLLocationCoordinate2D) -> some View {
        Map(position: $mapPosition) {
            // The route they meant to follow, dashed, under the one they logged.
            if let planned = trip.plannedRoute, planned.count >= 2 {
                MapPolyline(coordinates: planned.map {
                    CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude)
                })
                .stroke(.orange, style: StrokeStyle(lineWidth: 3, dash: [6, 4]))
            }
            if route.count >= 2 {
                MapPolyline(coordinates: route)
                    .stroke(.orange, style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
            }
            Annotation(trip.location?.name ?? trip.name, coordinate: coord) {
                ZStack {
                    Circle().fill(.red).frame(width: 36, height: 36)
                    Image(systemName: "mappin.circle.fill")
                        .font(.title3)
                        .foregroundStyle(.white)
                }
                .shadow(radius: 4)
            }
        }
        .mapStyle(.standard(elevation: .realistic))
        .mapControls {
            #if os(macOS)
            MapZoomStepper()
            #endif
            MapCompass()
        }
        .overlay(alignment: .bottomTrailing) {
            Button {
                openInMaps(coord: coord)
            } label: {
                Label("Open in Maps", systemImage: "map.fill")
                    .font(.caption.bold())
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(.regularMaterial, in: Capsule())
            }
            .buttonStyle(.plain)
            .padding(10)
        }
    }

    private func openInMaps(coord: CLLocationCoordinate2D) {
        let placemark = MKPlacemark(coordinate: coord)
        let item = MKMapItem(placemark: placemark)
        item.name = trip.location?.name ?? trip.name
        item.openInMaps(launchOptions: [
            MKLaunchOptionsMapTypeKey: MKMapType.standard.rawValue
        ])
    }

    private func labeledSection(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased())
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            content()
        }
        .padding(.horizontal)
    }
}
