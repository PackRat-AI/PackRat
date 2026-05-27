import SwiftUI
import MapKit
import CoreLocation

struct TripDetailView: View {
    let trip: Trip
    let viewModel: TripsViewModel

    @State private var showingEditSheet = false
    @State private var mapPosition: MapCameraPosition = .automatic
    @Environment(AppState.self) private var appState

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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                metaCards

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
            }
            .padding(.bottom)
        }
        .navigationTitle(trip.name)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.large)
        #endif
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Edit", systemImage: "pencil") { showingEditSheet = true }
                    .accessibilityIdentifier("trip_detail_edit_button")
            }
        }
        .sheet(isPresented: $showingEditSheet) {
            TripFormView(viewModel: viewModel, existingTrip: trip)
        }
        .onAppear {
            if let coord = coordinate {
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
                Button {
                    appState.navItem = .packs
                    appState.selectedPackId = pack.id
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
                            Text("\(pack.itemCount) items")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        if let total = pack.totalWeight {
                            Text(pack.formattedWeight(total))
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
