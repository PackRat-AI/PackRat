#if os(iOS)
import SwiftUI

/// Guidance on the trip page: pick a place to be guided to, then the next
/// turn, the distance left and End, the way Maps shows a route underway.
struct TripGuidanceCard: View {
    let trip: Trip

    @AppStorage("speedUnit") private var speedUnit: SpeedUnit = .mph
    @State private var guide = TripGuide.shared
    @State private var starting = false
    @State private var problem: String?

    private var unit: TripDistanceUnit { TripDistanceUnit(speedUnit: speedUnit) }
    private var waypoints: [TripWaypoint] { trip.log?.waypoints ?? [] }
    private var route: [TripRoutePoint]? { trip.plannedRoute.flatMap { $0.count >= 2 ? $0 : nil } }
    private var session: TripGuide.Session? { guide.session?.tripId == trip.id ? guide.session : nil }

    /// Something to navigate to, on a trip that's underway.
    static func shows(for trip: Trip) -> Bool {
        guard trip.lifecycle == .inProgress else { return TripGuide.shared.isGuiding(tripId: trip.id) }
        return (trip.plannedRoute?.count ?? 0) >= 2 || trip.log?.waypoints.isEmpty == false
    }

    var body: some View {
        Group {
            if let session {
                active(session)
            } else {
                idle
            }
        }
        .padding(16)
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .animation(.snappy, value: session?.guide.isOffRoute)
        .alert(problem ?? "", isPresented: Binding(get: { problem != nil }, set: { if !$0 { problem = nil } })) {
            Button("OK", role: .cancel) {}
        }
        .accessibilityIdentifier("trip_guidance_card")
    }

    // MARK: - Idle

    private var idle: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                Image(systemName: "signpost.right.fill")
                    .font(.title3)
                    .foregroundStyle(Color.accentColor)
                    .frame(width: 36, height: 36)
                    .background(Color.accentColor.opacity(0.12), in: Circle())
                VStack(alignment: .leading, spacing: 2) {
                    Text("Find Your Way").font(.headline)
                    Text("Spoken directions to a waypoint or along your route, with the screen off.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Menu {
                if let route, let first = route.first, let last = route.last {
                    Section("Route") {
                        Button("End of Route", systemImage: "flag.checkered") {
                            navigate(to: GuidanceDestination(name: GuidanceDestination.endName, point: last))
                        }
                        Button("Trailhead", systemImage: "car.fill") {
                            navigate(to: GuidanceDestination(name: GuidanceDestination.startName, point: first))
                        }
                    }
                }
                if !waypoints.isEmpty {
                    Section("Waypoints") {
                        ForEach(waypoints.reversed()) { waypoint in
                            Button(waypoint.name, systemImage: waypoint.note == nil ? "mappin" : "note.text") {
                                navigate(to: .init(waypoint))
                            }
                        }
                    }
                }
            } label: {
                Group {
                    if starting {
                        ProgressView()
                    } else {
                        Label("Navigate", systemImage: "location.north.line.fill").lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(starting || guide.session != nil)
            .accessibilityIdentifier("trip_guidance_navigate")
        }
    }

    // MARK: - Active

    private func active(_ session: TripGuide.Session) -> some View {
        let guideState = session.guide
        let maneuver = maneuver(for: session)
        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center, spacing: 14) {
                Image(systemName: maneuver.symbol)
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 56, height: 56)
                    .background(maneuver.tint, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .contentTransition(.symbolEffect(.replace))
                VStack(alignment: .leading, spacing: 2) {
                    Text(maneuver.headline)
                        .font(.title2.bold())
                        .monospacedDigit()
                        .contentTransition(.numericText())
                    Text(maneuver.detail)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("trip_guidance_next")

            Divider()

            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(unit.formatDistance(guideState.remainingMeters))
                        .font(.headline)
                        .monospacedDigit()
                        .contentTransition(.numericText())
                    Text("to \(guideState.plan.destination.name.capitalizedFirstLetter)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("trip_guidance_remaining")
                Spacer(minLength: 0)
                Button("End", role: .destructive) { guide.stop() }
                    .buttonStyle(.borderedProminent)
                    .tint(.red)
                    .controlSize(.large)
                    .accessibilityIdentifier("trip_guidance_end")
            }
        }
    }

    private struct Maneuver {
        let symbol: String
        let tint: Color
        let headline: String
        let detail: String
    }

    private func maneuver(for session: TripGuide.Session) -> Maneuver {
        let guideState = session.guide
        if guideState.isOffRoute, let progress = guideState.progress {
            return Maneuver(
                symbol: "exclamationmark.triangle.fill",
                tint: .orange,
                headline: "Off Route",
                detail: "Head \(Geo.compassName(progress.bearingToRoute)) about \(shortDistance(progress.offRouteMeters)) to rejoin it."
            )
        }
        if guideState.plan.path == nil {
            return Maneuver(
                symbol: "location.north.fill",
                tint: .accentColor,
                headline: shortDistance(guideState.remainingMeters),
                detail: "Head \(Geo.compassName(session.bearing))."
            )
        }
        if let turn = guideState.nextTurn, let along = guideState.progress?.alongMeters {
            return Maneuver(
                symbol: turn.symbol,
                tint: .accentColor,
                headline: shortDistance(turn.alongMeters - along),
                detail: "\(turn.maneuver.capitalizedFirstLetter), heading \(Geo.compassName(turn.headingAfter))."
            )
        }
        return Maneuver(
            symbol: "arrow.up",
            tint: .accentColor,
            headline: shortDistance(guideState.remainingMeters),
            detail: "Continue on your route."
        )
    }

    /// "400 ft", "0.3 mi", "650 m", the way a turn distance reads in Maps.
    private func shortDistance(_ metres: Double) -> String {
        if unit == .imperial, metres < 0.2 * 1_609.344 {
            return "\(max(50, Int((metres * 3.28084 / 50).rounded()) * 50)) ft"
        }
        return unit.formatShortDistance(metres)
    }

    // MARK: - Actions

    private func navigate(to destination: GuidanceDestination) {
        starting = true
        Task {
            defer { starting = false }
            let metric = UserDefaults.standard.object(forKey: "preferMetric") as? Bool ?? true
            do {
                let (plan, position) = try await guide.start(tripId: trip.id, tripName: trip.name, to: destination, route: route)
                guide.announce(VoiceAnswers.navigating(plan, from: position, metric: metric))
            } catch TripGuide.StartError.denied {
                problem = "Allow location for PackRat in Settings to be guided."
            } catch TripGuide.StartError.alreadyThere {
                problem = VoiceAnswers.alreadyThere(destination.name)
            } catch {
                problem = "Your location isn't available right now. Try again with a clear view of the sky."
            }
        }
    }
}

extension GuidanceDestination {
    init(_ waypoint: TripWaypoint) {
        self.init(name: waypoint.name, point: TripRoutePoint(latitude: waypoint.latitude, longitude: waypoint.longitude))
    }
}

private extension String {
    var capitalizedFirstLetter: String { prefix(1).uppercased() + dropFirst() }
}
#endif
