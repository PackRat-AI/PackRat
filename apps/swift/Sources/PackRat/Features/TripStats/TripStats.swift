import CoreLocation
import Foundation

/// The record a user's finished trips add up to. Pure aggregation over trips
/// and the packs linked to them — no network, no persistence — so the stats
/// screen and its tests read the same numbers.
///
/// Dates, a location and a pack count for every trip. Distance, elevation,
/// activity and route come from the trip's log (see
/// `docs/features/trip-stats.md`) and count only for the trips that hold
/// them; nothing here estimates a missing figure. Trips the user left out of
/// stats count toward nothing.
struct TripStats: Sendable {

    /// A trip whose end date has passed, with its dates resolved to days.
    struct FinishedTrip: Identifiable, Sendable {
        let trip: Trip
        let start: Date
        let end: Date
        /// Nights between the start and end day. A day trip has none.
        let nights: Int

        var id: String { trip.id }
        var distance: Double? { trip.log?.distanceMeters }
        var elevationGain: Double? { trip.log?.elevationGainMeters }
    }

    struct Totals: Equatable, Sendable {
        var trips = 0
        var nights = 0
        var days = 0
        var places = 0
        /// Metres, summed over the trips that logged one; nil when none did.
        var distance: Double?
        var elevationGain: Double?
    }

    struct ActivityBucket: Identifiable, Equatable, Sendable {
        let activity: TripActivity
        var trips = 0
        var nights = 0
        var distance = 0.0

        var id: TripActivity { activity }
    }

    struct Route: Identifiable, Sendable {
        let id: String
        let name: String
        let coordinates: [CLLocationCoordinate2D]
    }

    struct MonthBucket: Identifiable, Equatable, Sendable {
        /// First day of the month.
        let month: Date
        var trips = 0
        var nights = 0

        var id: Date { month }
    }

    struct GearCount: Identifiable, Equatable, Sendable {
        let id: String
        let name: String
        let trips: Int
    }

    struct WeightPoint: Identifiable, Equatable, Sendable {
        let id: String
        let date: Date
        let grams: Double
        let packName: String
    }

    enum Season: String, CaseIterable, Sendable {
        case spring, summer, autumn, winter

        var label: String { rawValue.capitalized }

        var symbol: String {
            switch self {
            case .spring: return "leaf"
            case .summer: return "sun.max"
            case .autumn: return "wind"
            case .winter: return "snowflake"
            }
        }

        /// Meteorological seasons, flipped south of the equator so a December
        /// trip in Patagonia counts as summer.
        static func of(month: Int, latitude: Double?) -> Season {
            let northern: Season
            switch month {
            case 3...5: northern = .spring
            case 6...8: northern = .summer
            case 9...11: northern = .autumn
            default: northern = .winter
            }
            guard let latitude, latitude < 0 else { return northern }
            switch northern {
            case .spring: return .autumn
            case .summer: return .winter
            case .autumn: return .spring
            case .winter: return .summer
            }
        }
    }

    let finished: [FinishedTrip]
    let totals: Totals
    let thisYear: Totals
    /// The same 1 January → today stretch of last year, or nil when the user
    /// had no trips before this year — a first-year user sees this year alone.
    let lastYearToDate: Totals?
    let longestByNights: FinishedTrip?
    let longestByDistance: FinishedTrip?
    let averageNights: Double?
    /// Over the trips that logged a distance only.
    let averageDistance: Double?
    /// Trips per activity, busiest first. A trip with two activities counts in both.
    let activities: [ActivityBucket]
    let routes: [Route]
    /// The last twelve months, oldest first, including empty ones.
    let months: [MonthBucket]
    /// Busiest calendar month across the whole history, by nights then trips.
    let busiestMonth: Int?
    let busiestSeason: Season?
    let topGear: [GearCount]
    let packWeights: [WeightPoint]
    /// A recent return after a break of three months or more, until the user
    /// is back to their old pace or six months pass.
    let comeback: Comeback?

    var isEmpty: Bool { finished.isEmpty }

    init(trips: [Trip], packs: [Pack], now: Date = .now, calendar: Calendar = .current) {
        let today = calendar.startOfDay(for: now)

        let finished: [FinishedTrip] = trips.activeTrips.compactMap { trip in
            guard !trip.isExcludedFromStats, let start = trip.startDate?.toDate() else { return nil }
            let end = trip.endDate?.toDate() ?? start
            let startDay = calendar.startOfDay(for: start)
            let endDay = max(calendar.startOfDay(for: end), startDay)
            guard endDay < today else { return nil }
            let nights = calendar.dateComponents([.day], from: startDay, to: endDay).day ?? 0
            return FinishedTrip(trip: trip, start: startDay, end: endDay, nights: max(nights, 0))
        }
        .sorted { $0.start < $1.start }
        self.finished = finished

        self.totals = Self.totals(finished, calendar: calendar)
        self.comeback = Comeback.find(in: finished, today: today, calendar: calendar)

        let year = calendar.component(.year, from: today)
        let thisYearStart = calendar.date(from: DateComponents(year: year, month: 1, day: 1)) ?? today
        let lastYearStart = calendar.date(byAdding: .year, value: -1, to: thisYearStart) ?? thisYearStart
        let lastYearToday = calendar.date(byAdding: .year, value: -1, to: today) ?? today
        self.thisYear = Self.totals(Self.clip(finished, from: thisYearStart, to: today, calendar: calendar), calendar: calendar)
        let hadEarlierTrips = finished.contains { $0.start < thisYearStart }
        self.lastYearToDate = hadEarlierTrips
            ? Self.totals(Self.clip(finished, from: lastYearStart, to: lastYearToday, calendar: calendar), calendar: calendar)
            : nil

        self.longestByNights = finished
            .filter { $0.nights > 0 }
            .max { ($0.nights, $1.start) < ($1.nights, $0.start) }
        self.averageNights = finished.isEmpty
            ? nil
            : Double(finished.reduce(0) { $0 + $1.nights }) / Double(finished.count)

        let withDistance = finished.filter { ($0.distance ?? 0) > 0 }
        self.longestByDistance = withDistance.max { ($0.distance ?? 0, $1.start) < ($1.distance ?? 0, $0.start) }
        self.averageDistance = withDistance.isEmpty
            ? nil
            : withDistance.reduce(0) { $0 + ($1.distance ?? 0) } / Double(withDistance.count)

        var byActivity: [TripActivity: ActivityBucket] = [:]
        for trip in finished {
            for activity in Set(trip.trip.log?.activities ?? []) {
                byActivity[activity, default: ActivityBucket(activity: activity)].trips += 1
                byActivity[activity, default: ActivityBucket(activity: activity)].nights += trip.nights
                byActivity[activity, default: ActivityBucket(activity: activity)].distance += trip.distance ?? 0
            }
        }
        self.activities = byActivity.values.sorted {
            ($0.trips, $1.activity.rawValue) > ($1.trips, $0.activity.rawValue)
        }

        self.routes = finished.compactMap { trip in
            guard let encoded = trip.trip.log?.route, !encoded.isEmpty else { return nil }
            let coordinates = Polyline.decode(encoded)
            guard coordinates.count >= 2 else { return nil }
            return Route(id: trip.id, name: trip.trip.name, coordinates: coordinates)
        }

        self.months = Self.lastTwelveMonths(finished, today: today, calendar: calendar)

        var byMonth: [Int: (nights: Int, trips: Int)] = [:]
        var bySeason: [Season: (nights: Int, trips: Int)] = [:]
        for trip in finished {
            let month = calendar.component(.month, from: trip.start)
            byMonth[month, default: (0, 0)].nights += trip.nights
            byMonth[month, default: (0, 0)].trips += 1
            let season = Season.of(month: month, latitude: trip.trip.location?.latitude)
            bySeason[season, default: (0, 0)].nights += trip.nights
            bySeason[season, default: (0, 0)].trips += 1
        }
        self.busiestMonth = byMonth.max { ($0.value.nights, $0.value.trips, -$0.key) < ($1.value.nights, $1.value.trips, -$1.key) }?.key
        self.busiestSeason = bySeason.max {
            ($0.value.nights, $0.value.trips, $0.key.rawValue) < ($1.value.nights, $1.value.trips, $1.key.rawValue)
        }?.key

        let packsById = Dictionary(packs.activePacks.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        var gear: [String: (name: String, trips: Int)] = [:]
        var weights: [WeightPoint] = []
        for trip in finished {
            guard let packId = trip.trip.packId, let pack = packsById[packId] else { continue }
            // An item counts once per trip however many times it is in the pack.
            var seen = Set<String>()
            for item in pack.activeItems {
                let key = Self.gearKey(item)
                guard seen.insert(key).inserted else { continue }
                gear[key, default: (item.name, 0)].trips += 1
            }
            if let base = pack.baseWeight, base > 0 {
                weights.append(WeightPoint(id: trip.id, date: trip.start, grams: base, packName: pack.name))
            }
        }
        self.topGear = gear
            .map { GearCount(id: $0.key, name: $0.value.name, trips: $0.value.trips) }
            .sorted { ($0.trips, $1.name.lowercased()) > ($1.trips, $0.name.lowercased()) }
            .prefix(10)
            .map { $0 }
        self.packWeights = weights
    }

    // MARK: - Helpers

    /// Catalog items are one thing however they're named; hand-typed items
    /// match by name.
    private static func gearKey(_ item: PackItem) -> String {
        if let catalogId = item.catalogItemId { return "catalog:\(catalogId)" }
        return "name:" + item.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    static func totals(_ trips: [FinishedTrip], calendar: Calendar) -> Totals {
        var days = Set<Date>()
        for trip in trips {
            var day = trip.start
            while day <= trip.end {
                days.insert(day)
                guard let next = calendar.date(byAdding: .day, value: 1, to: day) else { break }
                day = next
            }
        }
        let distances = trips.compactMap(\.distance)
        let gains = trips.compactMap(\.elevationGain)
        return Totals(
            trips: trips.count,
            nights: trips.reduce(0) { $0 + $1.nights },
            days: days.count,
            places: distinctPlaces(trips.compactMap(\.trip.location)),
            distance: distances.isEmpty ? nil : distances.reduce(0, +),
            elevationGain: gains.isEmpty ? nil : gains.reduce(0, +)
        )
    }

    /// The same spot reached twice counts once: a location within a kilometre
    /// of one already counted is the same place. A distance check rather than
    /// rounded coordinates, which split two points either side of a grid line.
    private static func distinctPlaces(_ locations: [TripLocation]) -> Int {
        var places: [CLLocation] = []
        for location in locations {
            let point = CLLocation(latitude: location.latitude, longitude: location.longitude)
            if !places.contains(where: { $0.distance(from: point) < 1_000 }) {
                places.append(point)
            }
        }
        return places.count
    }

    /// Trips starting inside the window, with their end clipped to it, so a
    /// comparison window never counts nights past its last day.
    static func clip(_ trips: [FinishedTrip], from start: Date, to end: Date, calendar: Calendar) -> [FinishedTrip] {
        trips.compactMap { trip in
            guard trip.start >= start, trip.start <= end else { return nil }
            let clippedEnd = min(trip.end, end)
            let nights = calendar.dateComponents([.day], from: trip.start, to: clippedEnd).day ?? 0
            return FinishedTrip(trip: trip.trip, start: trip.start, end: clippedEnd, nights: max(nights, 0))
        }
    }

    private static func lastTwelveMonths(_ trips: [FinishedTrip], today: Date, calendar: Calendar) -> [MonthBucket] {
        guard let thisMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: today)) else { return [] }
        var buckets: [MonthBucket] = (0..<12).reversed().compactMap { offset in
            calendar.date(byAdding: .month, value: -offset, to: thisMonth).map { MonthBucket(month: $0) }
        }
        for trip in trips {
            guard let month = calendar.date(from: calendar.dateComponents([.year, .month], from: trip.start)),
                  let index = buckets.firstIndex(where: { $0.month == month })
            else { continue }
            buckets[index].trips += 1
            buckets[index].nights += trip.nights
        }
        return buckets
    }
}
