import SwiftUI
import MapKit

struct TripDetailView: View {
    let trip: Trip
    let viewModel: TripsViewModel

    @State private var showingEditSheet = false
    @State private var mapPosition: MapCameraPosition = .automatic

    private var coordinate: CLLocationCoordinate2D? {
        guard let lat = trip.location?.latitude, let lon = trip.location?.longitude,
              lat != 0 || lon != 0
        else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                metaCards.padding(.horizontal)

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

                if let pack = trip.pack {
                    labeledSection("Pack") {
                        HStack {
                            Image(systemName: "backpack").foregroundStyle(.tint)
                            Text(pack.name).font(.callout.bold())
                            Spacer()
                            if let total = pack.totalWeight {
                                Text(pack.formattedWeight(total))
                                    .font(.caption.monospacedDigit())
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(14)
                        .background(.fill.secondary, in: RoundedRectangle(cornerRadius: 10))
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle(trip.name)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.large)
        #endif
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Edit", systemImage: "pencil") { showingEditSheet = true }
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

    private var metaCards: some View {
        HStack(spacing: 10) {
            if !trip.dateRange.isEmpty {
                metaCard("Dates", trip.dateRange, symbol: "calendar", color: .blue)
            }
            if let loc = trip.location?.name {
                metaCard("Location", loc, symbol: "mappin.circle.fill", color: .red)
            }
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
            MapZoomStepper()
            MapCompass()
        }
    }

    private func labeledSection(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption.uppercaseSmallCaps())
                .foregroundStyle(.secondary)
            content()
        }
        .padding(.horizontal)
    }
}
