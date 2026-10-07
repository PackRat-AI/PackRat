import Foundation

extension TripStats {
    /// A return to the trail after three months or more without a trip,
    /// tracked against the user's own pace in the year before the break.
    /// See "Back on the trail" in `docs/features/trip-stats.md`.
    struct Comeback: Sendable {
        /// Per-month figures for one stretch.
        struct Pace: Equatable, Sendable {
            var trips: Double
            var nights: Double
            /// Metres; nil when no trip in the stretch logged a distance.
            var distance: Double?
        }

        /// The first trip after the break.
        let trip: FinishedTrip
        /// Whole months between the last trip before the break and this one.
        let monthsAway: Int
        /// Since the comeback trip started, up to today.
        let now: Pace
        /// The twelve months before the break began.
        let before: Pace
        /// Days since the comeback trip started.
        let daysBack: Int

        /// Breaks shorter than this aren't a comeback.
        static let minimumMonthsAway = 3
        /// The card retires after this long whatever the pace.
        static let maximumMonthsShown = 6
        /// Pace is judged only once a month has passed; one trip in its first
        /// week would otherwise read as back to an old pace at once.
        static let daysBeforePaceCounts = 30

        /// Back to the pace before the break, in trips and nights both.
        var isBackToPace: Bool {
            daysBack >= Self.daysBeforePaceCounts && now.trips >= before.trips && now.nights >= before.nights
        }

        /// Finds the latest break of three months or more and the trip that
        /// ended it, if that trip is recent enough to still show.
        static func find(in finished: [FinishedTrip], today: Date, calendar: Calendar) -> Comeback? {
            guard finished.count >= 2 else { return nil }
            // `finished` is in start order; trips can overlap, so a break
            // starts at the latest end so far, not the previous trip's end.
            var latestEnd = finished[0].end
            var found: (index: Int, breakStart: Date, months: Int)?
            for index in 1..<finished.count {
                let trip = finished[index]
                let months = calendar.dateComponents([.month], from: latestEnd, to: trip.start).month ?? 0
                if months >= minimumMonthsAway {
                    found = (index, latestEnd, months)
                }
                latestEnd = max(latestEnd, trip.end)
            }
            guard let found else { return nil }

            let trip = finished[found.index]
            guard let retires = calendar.date(byAdding: .month, value: maximumMonthsShown, to: trip.start),
                  today < retires,
                  let yearBefore = calendar.date(byAdding: .year, value: -1, to: found.breakStart)
            else { return nil }

            let since = TripStats.clip(finished, from: trip.start, to: today, calendar: calendar)
            let prior = TripStats.clip(finished, from: yearBefore, to: found.breakStart, calendar: calendar)
            let daysBack = calendar.dateComponents([.day], from: trip.start, to: today).day ?? 0
            // At least a month as the divisor, so the first days back don't
            // inflate to a monthly rate nobody has kept up.
            let monthsBack = max(Double(daysBack) / 30.44, 1)

            let comeback = Comeback(
                trip: trip,
                monthsAway: found.months,
                now: pace(since, months: monthsBack, calendar: calendar),
                before: pace(prior, months: 12, calendar: calendar),
                daysBack: daysBack
            )
            return comeback.isBackToPace ? nil : comeback
        }

        private static func pace(_ trips: [FinishedTrip], months: Double, calendar: Calendar) -> Pace {
            let totals = TripStats.totals(trips, calendar: calendar)
            return Pace(
                trips: Double(totals.trips) / months,
                nights: Double(totals.nights) / months,
                distance: totals.distance.map { $0 / months }
            )
        }
    }
}
