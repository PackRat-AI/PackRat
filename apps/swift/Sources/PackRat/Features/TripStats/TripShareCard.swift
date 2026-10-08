import CoreLocation
import ImageIO
import MapKit
import SwiftUI
import UniformTypeIdentifiers

// MARK: - What a card shows

/// The shapes a shared image comes in, after Strava's share sheet: a story
/// (9:16, Instagram/Snapchat), a square post, and a transparent sticker to lay
/// over a photo.
enum TripShareFormat: String, CaseIterable, Identifiable, Sendable {
    case story, square, sticker
    var id: String { rawValue }

    var label: String {
        switch self {
        case .story: return "Story"
        case .square: return "Square"
        case .sticker: return "Sticker"
        }
    }

    /// Points; rendered at 3× so a story is 1080 × 1920 px. A sticker is as
    /// tall as its content.
    var width: CGFloat { 360 }
    var height: CGFloat? {
        switch self {
        case .story: return 640
        case .square: return 360
        case .sticker: return nil
        }
    }

    /// Width over height of the map area on a map card.
    var mapAspect: CGFloat { self == .square ? 2 : 1.15 }
}

/// One card's worth of numbers. Built from the stats the screen already
/// shows; a card never carries trip names, notes or exact places unless the
/// user turns that on in the share sheet.
enum TripShareContent: Sendable {
    case totals(TripStats.Totals)
    case year(Int, TripStats.Totals, lastYear: TripStats.Totals?)
    case map(routes: [[CLLocationCoordinate2D]], pins: [CLLocationCoordinate2D], trips: Int, distance: Double?)
    case goal(TripGoalProgress)
    case parks(visited: Set<String>)
    case review(YearInReview, YearInReview.Page)

    var title: String {
        switch self {
        case .totals: return "All Time"
        case .year(let year, _, _): return "\(String(year)) So Far"
        case .map: return "Where I've Been"
        case .goal(let progress): return progress.goal.title
        case .parks: return "National Parks"
        case .review(_, let page):
            switch page {
            case .intro: return "Your Year Outdoors"
            case .totals: return "By the Numbers"
            case .busiestMonth: return "Busiest Month"
            case .longestTrip: return "Biggest Trips"
            case .newPlaces: return "New Ground"
            case .summits: return "Summits"
            case .goals: return "Goals"
            case .summary: return "That's a Wrap"
            }
        }
    }

    var isMap: Bool {
        if case .map = self { return true }
        return false
    }

    /// True when the card would name a trip, so the share sheet offers the toggle.
    var canShowNames: Bool {
        if case .review(let review, let page) = self, page == .longestTrip {
            return review.longestTrip != nil || review.farthestTrip != nil
        }
        return false
    }
}

struct TripShareOptions: Equatable, Sendable {
    var showNames = false
    /// Off: the map is held at least `ProjectedMap.privateSpan` across, so it
    /// shows the region and not the trailhead.
    var zoomClose = false
}

// MARK: - Map geometry

/// Routes and trip pins in a 0…1 square, drawn over a map snapshot, or on
/// their own as a line drawing when the snapshot can't be made.
struct ProjectedMap: Sendable {
    var routes: [[CGPoint]]
    var pins: [CGPoint]
    var image: CGImage?

    static let empty = ProjectedMap(routes: [], pins: [], image: nil)

    /// The narrowest a shared map gets unless the user zooms in close: wide
    /// enough to show a region, too wide to pick out a trailhead or a home.
    static let privateSpan: CLLocationDistance = 150_000

    /// Equirectangular, corrected for latitude, fitted inside the frame with
    /// a margin and centred.
    static func lineDrawing(
        routes: [[CLLocationCoordinate2D]],
        pins: [CLLocationCoordinate2D],
        aspect: CGFloat
    ) -> ProjectedMap {
        let all = routes.flatMap { $0 } + pins
        guard let first = all.first else { return .empty }
        var minLat = first.latitude, maxLat = first.latitude
        var minLon = first.longitude, maxLon = first.longitude
        for point in all {
            minLat = min(minLat, point.latitude); maxLat = max(maxLat, point.latitude)
            minLon = min(minLon, point.longitude); maxLon = max(maxLon, point.longitude)
        }
        let scaleX = cos((minLat + maxLat) / 2 * .pi / 180)
        let spanX = max((maxLon - minLon) * scaleX, 1e-6)
        let spanY = max(maxLat - minLat, 1e-6)
        // Fit the larger span into the frame, leaving 10% each side.
        let margin = 0.1
        let usableX = (1 - 2 * margin) * Double(aspect)
        let usableY = 1 - 2 * margin
        let scale = min(usableX / spanX, usableY / spanY)
        let midLon = (minLon + maxLon) / 2
        let midLat = (minLat + maxLat) / 2

        // Measured from the middle, so a lone pin sits in the centre.
        func project(_ c: CLLocationCoordinate2D) -> CGPoint {
            let x = Double(aspect) / 2 + (c.longitude - midLon) * scaleX * scale
            let y = 0.5 + (midLat - c.latitude) * scale
            return CGPoint(x: x / Double(aspect), y: y)
        }
        return ProjectedMap(routes: routes.map { $0.map(project) }, pins: pins.map(project), image: nil)
    }

    /// A muted dark map behind the same routes and pins, at least `minSpan`
    /// metres across.
    @MainActor
    static func snapshot(
        routes: [[CLLocationCoordinate2D]],
        pins: [CLLocationCoordinate2D],
        aspect: CGFloat,
        minSpan: CLLocationDistance
    ) async -> ProjectedMap? {
        let all = routes.flatMap { $0 } + pins
        guard !all.isEmpty else { return nil }
        var rect = MKMapRect.null
        for point in all {
            rect = rect.union(MKMapRect(origin: MKMapPoint(point), size: MKMapSize(width: 1, height: 1)))
        }
        let padding = max(rect.width, rect.height) * 0.15 + 2_000
        rect = rect.insetBy(dx: -padding, dy: -padding)
        let minPoints = minSpan * MKMapPointsPerMeterAtLatitude(MKMapPoint(x: rect.midX, y: rect.midY).coordinate.latitude)
        rect = rect.insetBy(dx: -max(minPoints - rect.width, 0) / 2, dy: -max(minPoints - rect.height, 0) / 2)
        // Widen to the frame's shape first; the snapshotter crops otherwise.
        let ratio = Double(aspect)
        if rect.width / rect.height < ratio {
            rect = rect.insetBy(dx: -(rect.height * ratio - rect.width) / 2, dy: 0)
        } else {
            rect = rect.insetBy(dx: 0, dy: -(rect.width / ratio - rect.height) / 2)
        }

        let options = MKMapSnapshotter.Options()
        options.mapRect = rect
        options.size = CGSize(width: 1_000, height: 1_000 / aspect)
        options.pointOfInterestFilter = .excludingAll
        options.preferredConfiguration = MKStandardMapConfiguration(emphasisStyle: .muted)
        #if os(iOS)
        options.traitCollection = UITraitCollection(userInterfaceStyle: .dark)
        #elseif os(macOS)
        options.appearance = NSAppearance(named: .darkAqua)
        #endif

        guard let snapshot = try? await MKMapSnapshotter(options: options).start() else { return nil }
        let size = options.size
        func project(_ c: CLLocationCoordinate2D) -> CGPoint {
            let point = snapshot.point(for: c)
            return CGPoint(x: point.x / size.width, y: point.y / size.height)
        }
        #if os(iOS)
        let image = snapshot.image.cgImage
        #else
        let image = snapshot.image.cgImage(forProposedRect: nil, context: nil, hints: nil)
        #endif
        return ProjectedMap(routes: routes.map { $0.map(project) }, pins: pins.map(project), image: image)
    }
}

// MARK: - The card

/// A shareable card. Drawn at a fixed point size with fixed type, so the
/// image comes out the same on every device and text size; the year in
/// review shows the same view scaled to the screen.
struct TripShareCardView: View {
    let content: TripShareContent
    let format: TripShareFormat
    var options = TripShareOptions()
    let unit: TripDistanceUnit
    var map: ProjectedMap = .empty

    private var isSticker: Bool { format == .sticker }
    private var isStory: Bool { format == .story }

    var body: some View {
        VStack(alignment: .leading, spacing: isStory ? 24 : 14) {
            if !isSticker { header }
            if isStory { Spacer(minLength: 0) }
            TripShareCardBody(content: content, format: format, options: options, unit: unit, map: map)
            // A story centres the numbers; a square keeps them under the title.
            if !isSticker { Spacer(minLength: 0) }
            footer
        }
        .padding(isSticker ? 18 : isStory ? 30 : 24)
        .frame(width: format.width, height: format.height, alignment: .topLeading)
        .foregroundStyle(.white)
        .background { if !isSticker { ShareCardBackground() } }
        .shadow(color: isSticker ? .black.opacity(0.55) : .clear, radius: 3, y: 1)
        .environment(\.colorScheme, .dark)
        .environment(\.dynamicTypeSize, .large)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(eyebrow)
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .tracking(1.6)
                .foregroundStyle(ShareCardPalette.mint)
            Text(content.title)
                .font(.system(size: isStory ? 34 : 26, weight: .heavy, design: .rounded))
                .lineLimit(2)
                .minimumScaleFactor(0.6)
        }
    }

    private var eyebrow: String {
        switch content {
        case .review(let review, _): return "MY \(String(review.year)) IN REVIEW"
        case .goal: return "GOAL"
        case .year: return "THIS YEAR"
        default: return "MY TRIP STATS"
        }
    }

    private var footer: some View {
        HStack(spacing: 8) {
            Image("AppLogo")
                .resizable()
                .scaledToFit()
                .frame(width: 22, height: 22)
                .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
            Text("PackRat")
                .font(.system(size: 15, weight: .bold, design: .rounded))
            if !isSticker {
                Spacer()
                Text("packrat.world")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundStyle(.white.opacity(0.6))
            }
        }
    }
}

enum ShareCardPalette {
    static let mint = Color(red: 0.56, green: 0.86, blue: 0.70)
    static let trail = Color(red: 1.0, green: 0.62, blue: 0.26)
    static let top = Color(red: 0.13, green: 0.30, blue: 0.25)
    static let bottom = Color(red: 0.04, green: 0.08, blue: 0.09)
}

private struct ShareCardBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(colors: [ShareCardPalette.top, ShareCardPalette.bottom], startPoint: .top, endPoint: .bottom)
            // Contour lines for texture, faint enough to keep the numbers first.
            Canvas { context, size in
                for ring in 1...9 {
                    let inset = CGFloat(ring) * size.width * 0.11
                    let rect = CGRect(
                        x: size.width * 0.55 - inset, y: -size.height * 0.08 - inset * 0.7,
                        width: inset * 2, height: inset * 1.4
                    )
                    context.stroke(Path(ellipseIn: rect), with: .color(.white.opacity(0.05)), lineWidth: 1)
                }
            }
        }
    }
}

// MARK: - Card bodies

private struct TripShareCardBody: View {
    let content: TripShareContent
    let format: TripShareFormat
    let options: TripShareOptions
    let unit: TripDistanceUnit
    let map: ProjectedMap

    private var isStory: Bool { format == .story }
    private var big: CGFloat { isStory ? 44 : 32 }

    var body: some View {
        switch content {
        case .totals(let totals):
            tiles(totalTiles(totals))
        case .year(let year, let now, let then):
            yearRows(year: year, now: now, then: then)
        case .map(_, _, let trips, let distance):
            VStack(alignment: .leading, spacing: 12) {
                ShareMapView(map: map, aspect: format.mapAspect, plain: format == .sticker)
                Text(([plural(trips, "trip")] + [distance.map(unit.formatDistance)].compactMap { $0 }).joined(separator: " · "))
                    .font(.system(size: 17, weight: .semibold, design: .rounded))
            }
        case .goal(let progress):
            goal(progress)
        case .parks(let visited):
            parks(visited)
        case .review(let review, let page):
            reviewPage(review, page)
        }
    }

    // MARK: Tiles

    private struct Tile: Identifiable {
        let value: String
        let label: String
        var id: String { label }
    }

    private func totalTiles(_ totals: TripStats.Totals) -> [Tile] {
        var tiles = [Tile(value: totals.trips.formatted(), label: "Trips")]
        if let distance = totals.distance { tiles.append(Tile(value: unit.formatDistance(distance), label: "Distance")) }
        if let gain = totals.elevationGain { tiles.append(Tile(value: unit.formatElevation(gain), label: "Climbed")) }
        tiles.append(Tile(value: totals.nights.formatted(), label: "Nights Out"))
        tiles.append(Tile(value: totals.days.formatted(), label: "Days Outdoors"))
        tiles.append(Tile(value: totals.places.formatted(), label: "Places"))
        return tiles
    }

    private func tiles(_ tiles: [Tile]) -> some View {
        Grid(alignment: .leading, horizontalSpacing: 18, verticalSpacing: isStory ? 26 : 12) {
            ForEach(Array(stride(from: 0, to: tiles.count, by: 2)), id: \.self) { index in
                GridRow {
                    tile(tiles[index])
                    if index + 1 < tiles.count { tile(tiles[index + 1]) } else { Color.clear.gridCellUnsizedAxes([.horizontal, .vertical]) }
                }
            }
        }
    }

    private func tile(_ tile: Tile) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(tile.value)
                .font(.system(size: big * (tile.value.count > 7 ? 0.72 : 1), weight: .heavy, design: .rounded))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.5)
            Text(tile.label)
                .font(.system(size: isStory ? 15 : 13, weight: .medium, design: .rounded))
                .foregroundStyle(.white.opacity(0.7))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: Year

    private func yearRows(year: Int, now: TripStats.Totals, then: TripStats.Totals?) -> some View {
        VStack(alignment: .leading, spacing: isStory ? 26 : 12) {
            yearRow("Trips", now.trips, then?.trips, year: year)
            yearRow("Nights out", now.nights, then?.nights, year: year)
            yearRow("Days outdoors", now.days, then?.days, year: year)
            if let distance = now.distance {
                HStack(alignment: .firstTextBaseline) {
                    Text(unit.formatDistance(distance))
                        .font(.system(size: big, weight: .heavy, design: .rounded))
                    Text("logged").font(.system(size: 15, weight: .medium, design: .rounded)).foregroundStyle(.white.opacity(0.7))
                }
            }
        }
    }

    private func yearRow(_ label: String, _ now: Int, _ then: Int?, year: Int) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(now.formatted())
                .font(.system(size: big, weight: .heavy, design: .rounded))
                .monospacedDigit()
            VStack(alignment: .leading, spacing: 0) {
                Text(label).font(.system(size: 15, weight: .medium, design: .rounded)).foregroundStyle(.white.opacity(0.7))
                // Neutral, as on the stats screen: only a rise is called out.
                if let then, now > then {
                    Text("\((now - then).formatted(.number.sign(strategy: .always()))) on \(String(year - 1))")
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                        .foregroundStyle(ShareCardPalette.mint)
                }
            }
        }
    }

    // MARK: Goal

    private func goal(_ progress: TripGoalProgress) -> some View {
        let metric = progress.goal.metric
        let ring: CGFloat = isStory ? 210 : 120
        return VStack(alignment: isStory ? .center : .leading, spacing: isStory ? 22 : 12) {
            HStack(spacing: 18) {
                ZStack {
                    Circle().stroke(.white.opacity(0.14), lineWidth: ring * 0.09)
                    Circle()
                        .trim(from: 0, to: min(progress.fraction, 1))
                        .stroke(ShareCardPalette.mint, style: StrokeStyle(lineWidth: ring * 0.09, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: 0) {
                        if progress.isComplete {
                            Image(systemName: "checkmark").font(.system(size: ring * 0.26, weight: .heavy))
                        } else {
                            Text("\(Int((min(progress.fraction, 1) * 100).rounded()))%")
                                .font(.system(size: ring * 0.24, weight: .heavy, design: .rounded))
                                .monospacedDigit()
                        }
                    }
                }
                .frame(width: ring, height: ring)
                if !isStory { goalText(progress, metric: metric) }
            }
            .frame(maxWidth: .infinity, alignment: isStory ? .center : .leading)
            if isStory { goalText(progress, metric: metric).frame(maxWidth: .infinity) }
        }
    }

    private func goalText(_ progress: TripGoalProgress, metric: TripGoal.Metric) -> some View {
        VStack(alignment: isStory ? .center : .leading, spacing: 4) {
            Text(metric.format(progress.value, unit: unit))
                .font(.system(size: isStory ? 36 : 26, weight: .heavy, design: .rounded))
                .monospacedDigit()
            Text("of \(metric.format(progress.goal.target, unit: unit))")
                .font(.system(size: 16, weight: .medium, design: .rounded))
                .foregroundStyle(.white.opacity(0.7))
            if progress.isComplete {
                Text("Goal complete")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(ShareCardPalette.mint)
                    .padding(.top, 2)
            }
        }
    }

    // MARK: Parks

    private func parks(_ visited: Set<String>) -> some View {
        let dot: CGFloat = isStory ? 26 : 18
        let columns = Array(repeating: GridItem(.fixed(dot), spacing: dot * 0.42), count: 9)
        return VStack(alignment: .leading, spacing: isStory ? 22 : 12) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(visited.count.formatted())
                    .font(.system(size: big * 1.2, weight: .heavy, design: .rounded))
                Text("of \(NationalParks.count) visited")
                    .font(.system(size: 17, weight: .medium, design: .rounded))
                    .foregroundStyle(.white.opacity(0.7))
            }
            if format != .square {
                LazyVGrid(columns: columns, alignment: .leading, spacing: dot * 0.42) {
                    ForEach(NationalParks.all) { park in
                        Circle()
                            .fill(visited.contains(park.code) ? ShareCardPalette.mint : .white.opacity(0.14))
                            .frame(width: dot, height: dot)
                    }
                }
            } else {
                Capsule().fill(.white.opacity(0.14)).frame(height: 10).overlay(alignment: .leading) {
                    GeometryReader { proxy in
                        Capsule().fill(ShareCardPalette.mint)
                            .frame(width: proxy.size.width * CGFloat(visited.count) / CGFloat(NationalParks.count))
                    }
                }
            }
        }
    }

    // MARK: Year in review

    @ViewBuilder
    private func reviewPage(_ review: YearInReview, _ page: YearInReview.Page) -> some View {
        switch page {
        case .intro:
            VStack(alignment: .leading, spacing: 10) {
                Text(String(review.year))
                    .font(.system(size: isStory ? 110 : 80, weight: .black, design: .rounded))
                    .minimumScaleFactor(0.5)
                Text("A look back at your year on the trail.")
                    .font(.system(size: 20, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.8))
            }
        case .totals:
            tiles(totalTiles(review.totals))
        case .busiestMonth:
            if let busiest = review.busiestMonth {
                VStack(alignment: .leading, spacing: 16) {
                    statement(
                        busiest.month.formatted(.dateTime.month(.wide)),
                        "was your busiest month: \(plural(busiest.trips, "trip")), \(plural(busiest.nights, "night")) out."
                    )
                    monthBars(review.months, highlight: busiest.month)
                }
            }
        case .longestTrip:
            VStack(alignment: .leading, spacing: isStory ? 26 : 14) {
                if let longest = review.longestTrip {
                    statement(plural(longest.nights, "night"), options.showNames ? "on \(longest.trip.name), your longest trip." : "on your longest trip.")
                }
                if let farthest = review.farthestTrip, let distance = farthest.distance {
                    statement(unit.formatDistance(distance), options.showNames ? "on \(farthest.trip.name), your farthest." : "on your farthest trip.")
                }
            }
        case .newPlaces:
            VStack(alignment: .leading, spacing: isStory ? 22 : 12) {
                if review.newPlaces > 0 {
                    statement(review.newPlaces.formatted(), review.newPlaces == 1 ? "new place you'd never been." : "new places you'd never been.")
                }
                if !review.newParks.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(review.newParks.count == 1 ? "New National Park" : "\(review.newParks.count) new National Parks")
                            .font(.system(size: 15, weight: .bold, design: .rounded))
                            .foregroundStyle(ShareCardPalette.mint)
                        ForEach(review.newParks.prefix(isStory ? 6 : 3)) { park in
                            Text(park.name).font(.system(size: 17, weight: .semibold, design: .rounded)).lineLimit(1)
                        }
                    }
                }
            }
        case .summits:
            VStack(alignment: .leading, spacing: isStory ? 22 : 12) {
                statement(review.peakCount.formatted(), review.peakCount == 1 ? "summit reached." : "summits reached.")
                if let highest = review.highest, let elevation = highest.summit.elevationMeters {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Highest").font(.system(size: 15, weight: .bold, design: .rounded)).foregroundStyle(ShareCardPalette.mint)
                        Text(highest.summit.name).font(.system(size: 22, weight: .heavy, design: .rounded)).lineLimit(1)
                        Text(unit.formatElevation(elevation)).font(.system(size: 17, weight: .medium, design: .rounded)).foregroundStyle(.white.opacity(0.7))
                    }
                }
            }
        case .goals:
            VStack(alignment: .leading, spacing: isStory ? 18 : 10) {
                statement(review.goalsMet.count.formatted(), review.goalsMet.count == 1 ? "goal met." : "goals met.")
                ForEach(review.goalsMet.prefix(isStory ? 5 : 2), id: \.goal.id) { progress in
                    Label {
                        Text(progress.goal.title).lineLimit(1)
                    } icon: {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(ShareCardPalette.mint)
                    }
                    .font(.system(size: 17, weight: .semibold, design: .rounded))
                }
            }
        case .summary:
            // A square has room for four.
            tiles(Array(summaryTiles(review).prefix(format == .square ? 4 : 8)))
        }
    }

    private func summaryTiles(_ review: YearInReview) -> [Tile] {
        var summary = totalTiles(review.totals)
        if review.peakCount > 0 { summary.append(Tile(value: review.peakCount.formatted(), label: "Summits")) }
        if !review.newParks.isEmpty { summary.append(Tile(value: review.newParks.count.formatted(), label: "New Parks")) }
        if !review.goalsMet.isEmpty { summary.append(Tile(value: review.goalsMet.count.formatted(), label: "Goals Met")) }
        return summary
    }

    private func statement(_ figure: String, _ rest: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(figure)
                .font(.system(size: isStory ? 64 : 42, weight: .black, design: .rounded))
                .lineLimit(1)
                .minimumScaleFactor(0.5)
            Text(rest)
                .font(.system(size: isStory ? 21 : 17, weight: .semibold, design: .rounded))
                .foregroundStyle(.white.opacity(0.8))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func monthBars(_ months: [YearInReview.Month], highlight: Date) -> some View {
        let most = max(months.map(\.nights).max() ?? 0, months.map(\.trips).max() ?? 0, 1)
        let height: CGFloat = isStory ? 110 : 60
        return HStack(alignment: .bottom, spacing: 5) {
            ForEach(months) { month in
                VStack(spacing: 4) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(month.month == highlight ? ShareCardPalette.mint : .white.opacity(0.25))
                        .frame(height: max(3, height * CGFloat(max(month.nights, month.trips)) / CGFloat(most)))
                    Text(month.month.formatted(.dateTime.month(.narrow)))
                        .font(.system(size: 10, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white.opacity(0.6))
                }
                .frame(maxWidth: .infinity)
            }
        }
        .frame(height: height + 18, alignment: .bottom)
    }

    private func plural(_ count: Int, _ word: String) -> String {
        "\(count.formatted()) \(word)\(count == 1 ? "" : "s")"
    }
}

/// Routes as orange lines and trips as dots, over the snapshot when there is one.
private struct ShareMapView: View {
    let map: ProjectedMap
    let aspect: CGFloat
    /// A sticker draws a line drawing with no frame.
    let plain: Bool

    var body: some View {
        Canvas { context, size in
            func point(_ p: CGPoint) -> CGPoint { CGPoint(x: p.x * size.width, y: p.y * size.height) }
            if let image = map.image {
                context.draw(Image(decorative: image, scale: 1), in: CGRect(origin: .zero, size: size))
            }
            let style = StrokeStyle(lineWidth: 3.5, lineCap: .round, lineJoin: .round)
            for route in map.routes where route.count >= 2 {
                var path = Path()
                path.addLines(route.map(point))
                context.stroke(path, with: .color(ShareCardPalette.trail.opacity(0.9)), style: style)
            }
            for pin in map.pins {
                let center = point(pin)
                let dot = CGRect(x: center.x - 4.5, y: center.y - 4.5, width: 9, height: 9)
                context.fill(Path(ellipseIn: dot.insetBy(dx: -2, dy: -2)), with: .color(.black.opacity(0.35)))
                context.fill(Path(ellipseIn: dot), with: .color(ShareCardPalette.mint))
            }
        }
        .aspectRatio(aspect, contentMode: .fit)
        .background(plain || map.image != nil ? Color.clear : Color.white.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: plain && map.image == nil ? 0 : 14, style: .continuous))
    }
}

// MARK: - Rendering

enum TripShareRenderer {
    /// The card as a PNG-ready image at 3×: 1080 px wide.
    @MainActor
    static func render(_ card: TripShareCardView) -> CGImage? {
        let renderer = ImageRenderer(content: card)
        renderer.scale = 3
        renderer.isOpaque = card.format != .sticker
        return renderer.cgImage
    }

    static func png(_ image: CGImage) -> Data? {
        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else { return nil }
        return data as Data
    }
}

/// A rendered card leaving through the share sheet.
struct TripShareImage: Transferable {
    let png: Data

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .png) { $0.png }
            .suggestedFileName("PackRat Trip Stats.png")
    }
}
