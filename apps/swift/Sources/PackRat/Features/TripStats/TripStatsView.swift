import Charts
import MapKit
import SwiftUI

/// What a user's finished trips add up to. Reads `TripStats` over the trips and
/// packs already loaded into `AppState`; nothing here fetches on its own.
///
/// Layout follows big picture → story → detail: the lifetime grid, this year against the same stretch of last year, the monthly
/// chart, highlights, the map, parks and peaks, then gear. A section with nothing to show is
/// left out rather than rendered as zeros.
struct TripStatsView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext
    @Environment(\.weightUnit) private var weightUnit
    @AppStorage("speedUnit") private var speedUnit: SpeedUnit = .mph

    private var distanceUnit: TripDistanceUnit { TripDistanceUnit(speedUnit: speedUnit) }

    @State private var editingGoal: TripGoal?
    @State private var addingGoal = false
    @State private var followingTrail = false

    private var stats: TripStats {
        TripStats(trips: appState.tripsVM.trips, packs: appState.packsVM.packs)
    }

    var body: some View {
        let stats = stats
        Group {
            if !appState.tripGoalsVM.isEnabled {
                TripStatsOptInView()
            } else if stats.isEmpty {
                EmptyStateView(
                    "Your Record Starts Here",
                    subtitle: "Once a trip's end date passes, it counts here: nights out, days outdoors, the places you've been and the gear that came along.",
                    systemImage: "chart.bar.xaxis",
                    actionLabel: "Plan a Trip",
                    accessibilityIdentifier: "trip_stats_empty"
                ) {
                    appState.navItem = .trips
                }
            } else {
                content(stats)
            }
        }
        .navigationTitle("Trip Stats")
        .toolbar {
            if appState.tripGoalsVM.isEnabled {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button { addingGoal = true } label: { Label("Add Goal", systemImage: "target") }
                        Divider()
                        Button(role: .destructive) {
                            Task { await appState.tripGoalsVM.setEnabled(false, context: modelContext) }
                        } label: {
                            Label("Turn Off Trip Stats", systemImage: "eye.slash")
                        }
                    } label: {
                        Label("More", systemImage: "ellipsis.circle")
                    }
                    .accessibilityIdentifier("trip_stats_menu")
                }
            }
        }
        .sheet(isPresented: $addingGoal) {
            GoalEditorView(goal: nil, finished: stats.finished, parksAndPeaks: parksAndPeaks(stats), unit: distanceUnit)
        }
        .sheet(item: $editingGoal) { goal in
            GoalEditorView(goal: goal, finished: stats.finished, parksAndPeaks: parksAndPeaks(stats), unit: distanceUnit)
        }
        .sheet(isPresented: $followingTrail) {
            GoalEditorView(
                goal: nil,
                finished: stats.finished,
                parksAndPeaks: parksAndPeaks(stats),
                unit: distanceUnit,
                initialKind: .longTrail,
                initialTrailCode: LongTrails.all.first { appState.followGoal(forTrail: $0.code) == nil }?.code
            )
        }
        .task {
            if appState.tripsVM.trips.isEmpty { await appState.tripsVM.load(context: modelContext) }
            if appState.packsVM.packs.isEmpty { await appState.packsVM.load(context: modelContext) }
            await appState.tripGoalsVM.load(context: modelContext)
        }
    }

    private func parksAndPeaks(_ stats: TripStats) -> TripParksAndPeaks {
        TripParksAndPeaks(finished: stats.finished, entries: appState.tripGoalsVM.entries)
    }

    private func content(_ stats: TripStats) -> some View {
        let record = parksAndPeaks(stats)
        let trails = LongTrails.all.map { LongTrailProgress(trail: $0, finished: stats.finished) }
        return ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                TotalsGrid(totals: stats.totals, unit: distanceUnit)

                if let comeback = stats.comeback {
                    ComebackCard(comeback: comeback, unit: distanceUnit)
                }

                GoalsCard(
                    progress: appState.tripGoalsVM.goals.compactMap { TripGoalProgress(goal: $0, finished: stats.finished, parksAndPeaks: record, longTrails: trails) },
                    unit: distanceUnit,
                    onAdd: { addingGoal = true },
                    onEdit: { editingGoal = $0 }
                )

                if stats.thisYear.trips > 0 || stats.lastYearToDate != nil {
                    YearComparisonCard(thisYear: stats.thisYear, lastYear: stats.lastYearToDate)
                }

                MonthlyChartCard(months: stats.months)

                if !stats.activities.isEmpty {
                    ActivitiesCard(activities: stats.activities, unit: distanceUnit)
                }

                HighlightsCard(stats: stats, unit: distanceUnit)

                if stats.finished.contains(where: { $0.trip.location != nil }) || !stats.routes.isEmpty {
                    TripsMapCard(trips: stats.finished, routes: stats.routes)
                }

                ParksCard(record: record, unit: distanceUnit)
                PeaksCard(record: record, unit: distanceUnit)
                LongTrailsCard(progress: trails, unit: distanceUnit) { _ in followingTrail = true }

                if !stats.topGear.isEmpty {
                    TopGearCard(gear: stats.topGear)
                }

                if stats.packWeights.count >= 2 {
                    PackWeightCard(points: stats.packWeights, unit: weightUnit)
                }
            }
            .padding(16)
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background(.background.secondary)
        .accessibilityIdentifier("trip_stats_screen")
    }
}

// MARK: - Card chrome

struct StatsCard<Content: View>: View {
    let title: String
    var subtitle: String?
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline)
                if let subtitle {
                    Text(subtitle).font(.caption).foregroundStyle(.secondary)
                }
            }
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

// MARK: - Totals

private struct TotalsGrid: View {
    let totals: TripStats.Totals
    let unit: TripDistanceUnit

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
            tile(totals.trips.formatted(), "Trips", "map.fill")
            // Distance and climbing appear once a logged trip carries them,
            // never as a zero standing in for "not logged".
            if let distance = totals.distance {
                tile(unit.formatDistance(distance), "Distance", "point.topleft.down.to.point.bottomright.curvepath")
            }
            if let gain = totals.elevationGain {
                tile(unit.formatElevation(gain), "Elevation Gained", "mountain.2.fill")
            }
            tile(totals.nights.formatted(), "Nights Out", "moon.stars.fill")
            tile(totals.days.formatted(), "Days Outdoors", "sun.max.fill")
            tile(totals.places.formatted(), "Places", "mappin.and.ellipse")
        }
    }

    private func tile(_ value: String, _ label: String, _ symbol: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: symbol)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.accentColor)
            Text(value)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .font(.title.weight(.bold))
                .monospacedDigit()
                .contentTransition(.numericText())
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label), \(value)")
    }
}

// MARK: - This year

private struct YearComparisonCard: View {
    let thisYear: TripStats.Totals
    let lastYear: TripStats.Totals?

    var body: some View {
        StatsCard(
            title: "This Year",
            subtitle: lastYear == nil ? "Your first year on the record" : "Compared with the same dates last year"
        ) {
            VStack(spacing: 10) {
                row("Trips", thisYear.trips, lastYear?.trips)
                row("Nights out", thisYear.nights, lastYear?.nights)
                row("Days outdoors", thisYear.days, lastYear?.days)
            }
        }
    }

    // Deltas are neutral: these are a record, not a target, so a quieter year
    // is shown as a difference rather than flagged as a shortfall.
    private func row(_ label: String, _ now: Int, _ then: Int?) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label).foregroundStyle(.secondary)
            Spacer()
            Text(now, format: .number).font(.body.weight(.semibold)).monospacedDigit()
            if let then {
                let change = now - then
                Label {
                    Text(change == 0 ? "same" : change.formatted(.number.sign(strategy: .always())))
                } icon: {
                    Image(systemName: change > 0 ? "arrow.up" : change < 0 ? "arrow.down" : "equal")
                }
                .labelStyle(.titleAndIcon)
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
                .frame(minWidth: 56, alignment: .trailing)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibility(label, now, then))
    }

    private func accessibility(_ label: String, _ now: Int, _ then: Int?) -> String {
        guard let then else { return "\(label), \(now) this year" }
        return "\(label), \(now) this year, \(then) by this date last year"
    }
}

// MARK: - Monthly chart

private struct MonthlyChartCard: View {
    let months: [TripStats.MonthBucket]

    enum Metric: String, CaseIterable, Identifiable {
        case nights = "Nights"
        case trips = "Trips"
        var id: String { rawValue }
    }

    @State private var metric: Metric = .nights
    @State private var selected: Date?

    private func value(_ bucket: TripStats.MonthBucket) -> Int {
        metric == .nights ? bucket.nights : bucket.trips
    }

    private var selectedBucket: TripStats.MonthBucket? {
        guard let selected else { return nil }
        let calendar = Calendar.current
        return months.first { calendar.isDate($0.month, equalTo: selected, toGranularity: .month) }
    }

    var body: some View {
        StatsCard(title: "Last 12 Months") {
            Picker("Metric", selection: $metric) {
                ForEach(Metric.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .accessibilityIdentifier("trip_stats_metric_picker")

            Chart {
                ForEach(months) { bucket in
                    BarMark(
                        x: .value("Month", bucket.month, unit: .month),
                        y: .value(metric.rawValue, value(bucket))
                    )
                    .foregroundStyle(Color.accentColor.opacity(selectedBucket == nil || selectedBucket == bucket ? 1 : 0.35))
                    .cornerRadius(3)
                    .accessibilityLabel(bucket.month.formatted(.dateTime.month(.wide).year()))
                    .accessibilityValue("\(value(bucket)) \(metric.rawValue.lowercased())")
                }
                if let bucket = selectedBucket {
                    RuleMark(x: .value("Month", bucket.month, unit: .month))
                        .foregroundStyle(.secondary.opacity(0.3))
                        .annotation(position: .top, overflowResolution: .init(x: .fit(to: .chart), y: .disabled)) {
                            VStack(spacing: 2) {
                                Text(bucket.month.formatted(.dateTime.month(.abbreviated).year()))
                                    .font(.caption2).foregroundStyle(.secondary)
                                Text("\(value(bucket)) \(metric.rawValue.lowercased())")
                                    .font(.caption.weight(.semibold))
                            }
                            .padding(6)
                            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 6))
                        }
                }
            }
            .chartXSelection(value: $selected)
            .chartXAxis {
                AxisMarks(values: .stride(by: .month, count: 2)) {
                    AxisValueLabel(format: .dateTime.month(.narrow), centered: true)
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading, values: .automatic(desiredCount: 3))
            }
            .frame(height: 180)
            .animation(.snappy, value: metric)
        }
    }
}

// MARK: - Activities

private struct ActivitiesCard: View {
    let activities: [TripStats.ActivityBucket]
    let unit: TripDistanceUnit

    var body: some View {
        StatsCard(title: "Activities", subtitle: "From your trip logs") {
            Chart(activities) { bucket in
                BarMark(
                    x: .value("Trips", bucket.trips),
                    y: .value("Activity", bucket.activity.label)
                )
                .foregroundStyle(Color.accentColor)
                .cornerRadius(3)
                .annotation(position: .trailing, alignment: .leading, spacing: 6) {
                    Text(detail(bucket))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .accessibilityLabel(bucket.activity.label)
                .accessibilityValue(detail(bucket))
            }
            .chartXAxis(.hidden)
            .chartXScale(domain: 0...Double((activities.map(\.trips).max() ?? 1)) * 1.6)
            .chartYAxis {
                AxisMarks(position: .leading) { AxisValueLabel() }
            }
            .frame(height: CGFloat(activities.count) * 34 + 8)
        }
    }

    private func detail(_ bucket: TripStats.ActivityBucket) -> String {
        var parts = ["\(bucket.trips) trip\(bucket.trips == 1 ? "" : "s")"]
        if bucket.nights > 0 { parts.append("\(bucket.nights) night\(bucket.nights == 1 ? "" : "s")") }
        if bucket.distance > 0 { parts.append(unit.formatDistance(bucket.distance)) }
        return parts.joined(separator: " · ")
    }
}

// MARK: - Highlights

private struct HighlightsCard: View {
    @Environment(AppState.self) private var appState
    let stats: TripStats
    let unit: TripDistanceUnit

    var body: some View {
        StatsCard(title: "Highlights") {
            VStack(spacing: 0) {
                if let longest = stats.longestByNights {
                    Button {
                        appState.selectedTripId = longest.id
                        appState.navItem = .trips
                    } label: {
                        row("Longest trip", "\(longest.trip.name) · \(longest.nights) night\(longest.nights == 1 ? "" : "s")", "trophy", chevron: true)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("trip_stats_longest_trip")
                    Divider()
                }
                if let farthest = stats.longestByDistance, let distance = farthest.distance {
                    Button {
                        appState.selectedTripId = farthest.id
                        appState.navItem = .trips
                    } label: {
                        row("Farthest trip", "\(farthest.trip.name) · \(unit.formatDistance(distance))", "flag.checkered", chevron: true)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("trip_stats_farthest_trip")
                    Divider()
                }
                if let average = stats.averageNights {
                    row("Average trip", average.formatted(.number.precision(.fractionLength(0...1))) + " nights", "moon")
                }
                if let average = stats.averageDistance {
                    Divider()
                    row("Average distance", unit.formatDistance(average), "ruler")
                }
                if let month = stats.busiestMonth {
                    Divider()
                    row("Busiest month", Calendar.current.monthSymbols[month - 1], "calendar")
                }
                if let season = stats.busiestSeason {
                    Divider()
                    row("Busiest season", season.label, season.symbol)
                }
            }
        }
    }

    private func row(_ label: String, _ value: String, _ symbol: String, chevron: Bool = false) -> some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .foregroundStyle(Color.accentColor)
                .frame(width: 24)
            Text(label).foregroundStyle(.secondary)
            Spacer(minLength: 8)
            Text(value)
                .fontWeight(.medium)
                .lineLimit(1)
                .multilineTextAlignment(.trailing)
            if chevron {
                Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 10)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Map

private struct TripsMapCard: View {
    @Environment(AppState.self) private var appState
    let trips: [TripStats.FinishedTrip]
    let routes: [TripStats.Route]

    @State private var position: MapCameraPosition = .automatic
    @State private var selection: String?

    private var located: [(trip: TripStats.FinishedTrip, coordinate: CLLocationCoordinate2D)] {
        trips.compactMap { trip in
            trip.trip.location.map { (trip, CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude)) }
        }
    }

    private var selectedTrip: TripStats.FinishedTrip? {
        trips.first { $0.id == selection }
    }

    var body: some View {
        StatsCard(title: "Where You've Been") {
            Map(position: $position, selection: $selection) {
                // Translucent strokes: a trail walked more than once draws darker.
                ForEach(routes) { route in
                    MapPolyline(coordinates: route.coordinates)
                        .stroke(Color.orange.opacity(0.55), style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
                }
                ForEach(located, id: \.trip.id) { item in
                    Marker(item.trip.trip.name, systemImage: "tent.fill", coordinate: item.coordinate)
                        .tint(Color.accentColor)
                        .tag(item.trip.id)
                }
            }
            .mapStyle(.standard(elevation: .realistic, pointsOfInterest: .excludingAll))
            .frame(height: 240)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .accessibilityIdentifier("trip_stats_map")

            if let trip = selectedTrip {
                Button {
                    appState.selectedTripId = trip.id
                    appState.navItem = .trips
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(trip.trip.name).font(.subheadline.weight(.semibold))
                            Text(trip.trip.dateRange).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Gear

private struct TopGearCard: View {
    let gear: [TripStats.GearCount]

    var body: some View {
        StatsCard(title: "Packed Most Often", subtitle: "From packs linked to finished trips") {
            let most = gear.first?.trips ?? 1
            VStack(spacing: 10) {
                ForEach(gear) { item in
                    HStack(spacing: 10) {
                        Text(item.name).lineLimit(1)
                        Spacer(minLength: 8)
                        Capsule()
                            .fill(Color.accentColor.opacity(0.25))
                            .frame(width: 60 * CGFloat(item.trips) / CGFloat(most), height: 6)
                        Text("\(item.trips)")
                            .font(.subheadline.weight(.semibold))
                            .monospacedDigit()
                            .frame(minWidth: 20, alignment: .trailing)
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(item.name), \(item.trips) trip\(item.trips == 1 ? "" : "s")")
                }
            }
        }
    }
}

private struct PackWeightCard: View {
    let points: [TripStats.WeightPoint]
    let unit: AppWeightUnit

    var body: some View {
        StatsCard(title: "Base Weight by Trip", subtitle: "Each pack's current base weight, in \(unit.label)") {
            Chart(points) { point in
                LineMark(
                    x: .value("Date", point.date),
                    y: .value("Base weight", point.grams / unit.gramsPerUnit)
                )
                                .foregroundStyle(Color.accentColor.opacity(0.6))
                PointMark(
                    x: .value("Date", point.date),
                    y: .value("Base weight", point.grams / unit.gramsPerUnit)
                )
                .foregroundStyle(Color.accentColor)
                .accessibilityLabel(point.date.formatted(date: .abbreviated, time: .omitted))
                .accessibilityValue("\(point.packName), \(unit.display(grams: point.grams))")
            }
            .chartYScale(domain: .automatic(includesZero: false))
            .chartXAxis {
                AxisMarks(values: .automatic(desiredCount: 4)) {
                    AxisValueLabel(format: .dateTime.month(.abbreviated).year(.twoDigits))
                }
            }
            .chartYAxis { AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) }
            .frame(height: 160)
        }
    }
}

