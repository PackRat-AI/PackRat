#if os(iOS)
import SwiftUI
import UniformTypeIdentifiers

/// A trip's planned route: import a GPX track, see its length, remove it.
/// With a route, a safety check-in tells the contacts if the user strays well
/// off it.
struct PlannedRouteSection: View {
    let trip: Trip
    let viewModel: TripsViewModel

    @Environment(\.modelContext) private var modelContext
    @AppStorage("preferMetric") private var preferMetric = true
    @State private var importing = false
    @State private var errorMessage: String?

    private static let gpxType = UTType(filenameExtension: "gpx", conformingTo: .xml) ?? .xml

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("PLANNED ROUTE")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            if let route = trip.plannedRoute, route.count >= 2 {
                HStack(spacing: 12) {
                    Image(systemName: "point.topleft.down.to.point.bottomright.curvepath.fill")
                        .font(.title3)
                        .foregroundStyle(.orange)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(distanceLabel(GPXRouteParser.lengthMeters(route))).font(.callout.bold())
                        Text("Contacts are told if you go well off it during a check-in.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Menu {
                        Button("Replace…") { importing = true }
                        Button("Remove", role: .destructive) {
                            viewModel.setPlannedRoute(trip.id, [], context: modelContext)
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle").font(.title3).foregroundStyle(.secondary)
                    }
                    .accessibilityIdentifier("trip_route_menu")
                }
                .padding(14)
                .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            } else {
                Button {
                    importing = true
                } label: {
                    Label("Import GPX Route", systemImage: "square.and.arrow.down")
                        .font(.callout)
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("trip_import_route")
            }
            if let errorMessage {
                Text(errorMessage).font(.caption).foregroundStyle(.red)
            }
        }
        .padding(.horizontal)
        .fileImporter(isPresented: $importing, allowedContentTypes: [Self.gpxType, .xml]) { result in
            importRoute(result)
        }
    }

    private func importRoute(_ result: Result<URL, Error>) {
        errorMessage = nil
        do {
            let url = try result.get()
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            let route = try GPXRouteParser.parse(try Data(contentsOf: url))
            viewModel.setPlannedRoute(trip.id, route, context: modelContext)
        } catch let error as GPXRouteParser.ParseError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = "Couldn't open that file."
        }
    }

    private func distanceLabel(_ meters: Double) -> String {
        let measurement = Measurement(value: meters, unit: UnitLength.meters)
            .converted(to: preferMetric ? .kilometers : .miles)
        return measurement.formatted(.measurement(width: .abbreviated, usage: .asProvided,
                                                  numberFormatStyle: .number.precision(.fractionLength(1))))
            + " route"
    }
}
#endif
