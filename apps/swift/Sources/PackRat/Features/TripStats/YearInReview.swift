import CoreLocation
import Foundation

/// One calendar year of finished trips, told as a short sequence of cards:
/// totals, busiest month, longest trip, new places, summits and goals met.
/// Pure, like `TripStats`, so the cards and their tests read the same numbers.
///
/// Offered in December (for the year closing) and January (for the year just
/// gone), the Strava Year in Sport / Spotify Wrapped window. Trips crossing
/// New Year count in the year they started, clipped to 31 December.
struct YearInReview: Identifiable, Sendable {

    enum Page: String, CaseIterable, Identifiable, Sendable {
        case intro, totals, busiestMonth, longestTrip, newPlaces, summits, goals, summary
        var id: String { rawValue }
    }

    struct Month: Identifiable, Equatable, Sendable {
        /// First day of the month.
        let month: Date
        var trips = 0
        var nights = 0
        var id: Date { month }
    }

    let year: Int
    var id: Int { year }
    let totals: TripStats.Totals
    /// January through December, including empty months.
    let months: [Month]
    let busiestMonth: Month?
    let longestTrip: TripStats.FinishedTrip?
    let farthestTrip: TripStats.FinishedTrip?
    /// Trips per activity, busiest first.
    let activities: [TripStats.ActivityBucket]
    /// Places reached for the first time this year: more than a kilometre
    /// from every earlier trip.
    let newPlaces: Int
    /// National Parks first visited this year, by first visit.
    let newParks: [NationalPark]
    /// Summits reached this year, newest first.
    let summits: [TripParksAndPeaks.Ascent]
    let peakCount: Int
    let highest: TripParksAndPeaks.Ascent?
    /// Goals for this year, or ending in it, that were met.
    let goalsMet: [TripGoalProgress]

    /// The pages worth showing: a page with nothing to say is left out.
    var pages: [Page] {
        Page.allCases.filter { page in
            switch page {
            case .intro, .totals, .summary: return true
            case .busiestMonth: return busiestMonth != nil && totals.trips > 1
            case .longestTrip: return longestTrip != nil || farthestTrip != nil
            case .newPlaces: return newPlaces > 0 || !newParks.isEmpty
            case .summits: return peakCount > 0
            case .goals: return !goalsMet.isEmpty
            }
        }
    }

    /// The year on offer today: December offers the year closing, January the
    /// year just gone, other months nothing. `force` (a debug launch argument)
    /// offers the current year at any time.
    static func offeredYear(now: Date = .now, calendar: Calendar = .current, force: Bool = false) -> Int? {
        let year = calendar.component(.year, from: now)
        switch calendar.component(.month, from: now) {
        case 12: return year
        case 1: return force ? year : year - 1
        default: return force ? year : nil
        }
    }

    /// Nil when the year holds no finished trips.
    init?(
        year: Int,
        finished: [TripStats.FinishedTrip],
        record: TripParksAndPeaks,
        goals: [TripGoalProgress],
        calendar: Calendar = .current
    ) {
        guard let start = calendar.date(from: DateComponents(year: year, month: 1, day: 1)),
              let nextYear = calendar.date(byAdding: .year, value: 1, to: start),
              let end = calendar.date(byAdding: .day, value: -1, to: nextYear)
        else { return nil }
        let inYear = TripStats.clip(finished, from: start, to: end, calendar: calendar)
        guard !inYear.isEmpty else { return nil }

        self.year = year
        self.totals = TripStats.totals(inYear, calendar: calendar)

        var months: [Month] = (0..<12).compactMap { offset in
            calendar.date(byAdding: .month, value: offset, to: start).map { Month(month: $0) }
        }
        for trip in inYear {
            let index = calendar.component(.month, from: trip.start) - 1
            guard months.indices.contains(index) else { continue }
            months[index].trips += 1
            months[index].nights += trip.nights
        }
        self.months = months
        self.busiestMonth = months
            .filter { $0.trips > 0 }
            .max { ($0.nights, $0.trips, $1.month) < ($1.nights, $1.trips, $0.month) }

        self.longestTrip = inYear
            .filter { $0.nights > 0 }
            .max { ($0.nights, $1.start) < ($1.nights, $0.start) }
        self.farthestTrip = inYear
            .filter { ($0.distance ?? 0) > 0 }
            .max { ($0.distance ?? 0, $1.start) < ($1.distance ?? 0, $0.start) }

        var byActivity: [TripActivity: TripStats.ActivityBucket] = [:]
        for trip in inYear {
            for activity in Set(trip.trip.log?.activities ?? []) {
                byActivity[activity, default: .init(activity: activity)].trips += 1
                byActivity[activity, default: .init(activity: activity)].nights += trip.nights
                byActivity[activity, default: .init(activity: activity)].distance += trip.distance ?? 0
            }
        }
        self.activities = byActivity.values.sorted {
            ($0.trips, $1.activity.rawValue) > ($1.trips, $0.activity.rawValue)
        }

        let earlier = finished.filter { $0.start < start }.compactMap(\.trip.location).map(Self.point)
        var seen = earlier
        var newPlaces = 0
        for location in inYear.compactMap(\.trip.location).map(Self.point)
        where !seen.contains(where: { $0.distance(from: location) < 1_000 }) {
            seen.append(location)
            newPlaces += 1
        }
        self.newPlaces = newPlaces

        self.newParks = record.parks
            .compactMap { status -> (NationalPark, Date)? in
                guard let first = status.firstVisit, first >= start, first <= end else { return nil }
                return (status.park, first)
            }
            .sorted { $0.1 < $1.1 }
            .map(\.0)

        let summits = record.ascents.filter { ascent in
            guard let date = ascent.date else { return false }
            return date >= start && date <= end
        }
        self.summits = summits
        self.peakCount = Set(summits.map(\.summit.peakKey)).count
        self.highest = summits
            .filter { $0.summit.elevationMeters != nil }
            .max { ($0.summit.elevationMeters ?? 0) < ($1.summit.elevationMeters ?? 0) }

        self.goalsMet = goals.filter { progress in
            guard progress.isComplete else { return false }
            switch progress.goal.kind {
            case .annual:
                return progress.goal.year == year
            case .custom, .longTrail, .peakList, .parkList:
                // Dated goals count in the year they end; open-ended list
                // goals count in the year they were started.
                let anchor = progress.end ?? progress.start
                return calendar.component(.year, from: anchor) == year
            }
        }
    }

    private static func point(_ location: TripLocation) -> CLLocation {
        CLLocation(latitude: location.latitude, longitude: location.longitude)
    }
}
