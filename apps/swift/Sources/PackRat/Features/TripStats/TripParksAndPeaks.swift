import CoreLocation
import Foundation

/// The National Parks checklist and the summits list. Pure, like `TripStats`.
///
/// A trip visits a park when its location or any point of its route falls
/// inside the park's boundary, and is dated by its first day. Visits and
/// summits the user added by hand (`TripStatsEntry`) count alongside, for
/// outings from before PackRat.
struct TripParksAndPeaks: Sendable {

    struct Visit: Identifiable, Sendable {
        let id: String
        let date: Date?
        /// Nil for a visit added by hand.
        let tripId: String?
        let tripName: String?
    }

    struct ParkStatus: Identifiable, Sendable {
        let park: NationalPark
        /// Oldest first; undated hand-added visits last.
        let visits: [Visit]

        var id: String { park.code }
        var isVisited: Bool { !visits.isEmpty }
        var firstVisit: Date? { visits.compactMap(\.date).min() }
        /// Hand-added visits, which are the only ones the checklist can untick.
        var manualEntryIds: [String] { visits.filter { $0.tripId == nil }.map(\.id) }
    }

    struct Ascent: Identifiable, Sendable {
        let id: String
        let summit: TripSummit
        let date: Date?
        let tripId: String?
        let tripName: String?
    }

    /// Every park, by name.
    let parks: [ParkStatus]
    /// Every summit logged, newest first; undated ones last.
    let ascents: [Ascent]

    var visitedParks: [ParkStatus] { parks.filter(\.isVisited) }
    /// Distinct peaks: the same peak climbed twice is one.
    var peakCount: Int { Set(ascents.map(\.summit.peakKey)).count }
    var highest: Ascent? {
        ascents.filter { $0.summit.elevationMeters != nil }
            .max { ($0.summit.elevationMeters ?? 0) < ($1.summit.elevationMeters ?? 0) }
    }

    init(
        finished: [TripStats.FinishedTrip],
        entries: [TripStatsEntry],
        parks: [NationalPark] = NationalParks.all
    ) {
        var visitsByPark: [String: [Visit]] = [:]
        for trip in finished {
            for code in Self.parkCodes(visitedBy: trip.trip, parks: parks) {
                visitsByPark[code, default: []].append(
                    Visit(id: "trip:\(trip.id)", date: trip.start, tripId: trip.id, tripName: trip.trip.name)
                )
            }
        }
        for entry in entries.activeEntries where entry.kind == .park {
            guard let code = entry.parkCode else { continue }
            visitsByPark[code, default: []].append(Visit(id: entry.id, date: entry.day, tripId: nil, tripName: nil))
        }
        self.parks = parks.map { park in
            let visits = (visitsByPark[park.code] ?? []).sorted {
                ($0.date ?? .distantFuture) < ($1.date ?? .distantFuture)
            }
            return ParkStatus(park: park, visits: visits)
        }

        var ascents: [Ascent] = []
        for trip in finished {
            for (index, summit) in (trip.trip.log?.summits ?? []).enumerated() {
                ascents.append(Ascent(
                    id: "trip:\(trip.id):\(index)",
                    summit: summit,
                    date: trip.start,
                    tripId: trip.id,
                    tripName: trip.trip.name
                ))
            }
        }
        for entry in entries.activeEntries {
            guard let summit = entry.summit else { continue }
            ascents.append(Ascent(id: entry.id, summit: summit, date: entry.day, tripId: nil, tripName: nil))
        }
        self.ascents = ascents.sorted { ($0.date ?? .distantPast) > ($1.date ?? .distantPast) }
    }

    /// Distinct parks with a visit inside the window, both days counted.
    func parksVisited(from start: Date, to end: Date) -> Int {
        parks.filter { status in
            status.visits.contains { visit in visit.date.map { $0 >= start && $0 <= end } ?? false }
        }.count
    }

    /// Distinct peaks summited inside the window, both days counted.
    func peaksSummited(from start: Date, to end: Date) -> Int {
        Set(ascents.filter { ascent in ascent.date.map { $0 >= start && $0 <= end } ?? false }
            .map(\.summit.peakKey)).count
    }

    // MARK: - Helpers

    /// A route can hold 1,500 points; every few is plenty against a boundary
    /// simplified to 600 m.
    private static let routeSampleLimit = 300

    static func parkCodes(visitedBy trip: Trip, parks: [NationalPark]) -> Set<String> {
        var points: [CLLocationCoordinate2D] = []
        if let location = trip.location {
            points.append(CLLocationCoordinate2D(latitude: location.latitude, longitude: location.longitude))
        }
        if let encoded = trip.log?.route, !encoded.isEmpty {
            let route = Polyline.decode(encoded)
            let step = max(route.count / routeSampleLimit, 1)
            points += stride(from: 0, to: route.count, by: step).map { route[$0] }
            if let last = route.last { points.append(last) }
        }
        var codes = Set<String>()
        for park in parks where points.contains(where: park.contains) {
            codes.insert(park.code)
        }
        return codes
    }
}
