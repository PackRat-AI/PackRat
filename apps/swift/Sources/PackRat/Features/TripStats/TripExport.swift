import CoreTransferable
import Foundation
import UniformTypeIdentifiers

/// Every finished trip and its log, as files to keep or take elsewhere: a
/// spreadsheet (CSV, RFC 4180) and the logged routes as GPS tracks (GPX 1.1).
///
/// Trips left out of stats are still exported, flagged in their own column —
/// the export is the user's record, not the stats screen.
enum TripExport {

    /// Trips whose last day has passed, oldest first.
    static func finishedTrips(_ trips: [Trip], now: Date = .now, calendar: Calendar = .current) -> [Trip] {
        let today = calendar.startOfDay(for: now)
        return trips.activeTrips
            .compactMap { trip -> (Trip, Date)? in
                guard let start = trip.startDate?.toDate() else { return nil }
                let end = trip.endDate?.toDate() ?? start
                guard calendar.startOfDay(for: max(end, start)) < today else { return nil }
                return (trip, start)
            }
            .sorted { $0.1 < $1.1 }
            .map(\.0)
    }

    // MARK: - CSV

    static func csv(_ trips: [Trip], unit: TripDistanceUnit, calendar: Calendar = .current) -> String {
        let header = [
            "Name", "Start", "End", "Nights", "Place", "Latitude", "Longitude", "Activities",
            "Distance (\(unit.distanceSymbol))", "Elevation Gain (\(unit.elevationSymbol))",
            "Summits", "Has Route", "Counted in Stats", "Notes",
        ]
        var dayFormat = Date.ISO8601FormatStyle().year().month().day()
        dayFormat.timeZone = calendar.timeZone

        let rows = trips.map { trip -> [String] in
            let start = trip.startDate?.toDate()
            let end = trip.endDate?.toDate() ?? start
            var nights = ""
            if let start, let end {
                let count = calendar.dateComponents(
                    [.day], from: calendar.startOfDay(for: start), to: calendar.startOfDay(for: end)
                ).day ?? 0
                nights = String(max(count, 0))
            }
            let log = trip.log
            return [
                trip.name,
                start.map { $0.formatted(dayFormat) } ?? "",
                end.map { $0.formatted(dayFormat) } ?? "",
                nights,
                trip.location?.name ?? "",
                trip.location.map { coordinate($0.latitude) } ?? "",
                trip.location.map { coordinate($0.longitude) } ?? "",
                (log?.activities ?? []).map(\.label).joined(separator: "; "),
                log?.distanceMeters.map { number(unit.distanceValue($0), digits: 2) } ?? "",
                log?.elevationGainMeters.map { number(unit.elevationValue($0), digits: 0) } ?? "",
                (log?.summits ?? []).map(\.name).joined(separator: "; "),
                (log?.route?.isEmpty ?? true) ? "No" : "Yes",
                trip.isExcludedFromStats ? "No" : "Yes",
                trip.notes ?? "",
            ]
        }
        // CRLF line endings, as RFC 4180 specifies and Excel expects.
        return ([header] + rows).map { $0.map(csvField).joined(separator: ",") }.joined(separator: "\r\n") + "\r\n"
    }

    /// Quoted when it holds a comma, quote or line break; quotes doubled.
    /// A leading =, +, - or @ is prefixed with an apostrophe so a spreadsheet
    /// never runs a trip name as a formula (OWASP CSV injection).
    static func csvField(_ value: String) -> String {
        var value = value
        if let first = value.first, "=+-@\t\r".contains(first), Double(value) == nil {
            value = "'" + value
        }
        guard value.contains(where: { $0 == "," || $0 == "\"" || $0 == "\n" || $0 == "\r" }) else { return value }
        return "\"" + value.replacingOccurrences(of: "\"", with: "\"\"") + "\""
    }

    private static func coordinate(_ value: Double) -> String {
        number(value, digits: 6)
    }

    /// Plain digits with a dot, whatever the locale, so every spreadsheet reads it.
    private static func number(_ value: Double, digits: Int) -> String {
        String(format: "%.\(digits)f", locale: Locale(identifier: "en_US_POSIX"), value)
    }

    // MARK: - GPX

    /// One track per trip with a logged route, and a waypoint per summit.
    /// Nil when no trip has a route or summit to write.
    static func gpx(_ trips: [Trip]) -> String? {
        let tracks = trips.compactMap { trip -> (Trip, [(Double, Double)])? in
            guard let route = trip.log?.route, !route.isEmpty else { return nil }
            let points = Polyline.decode(route).map { ($0.latitude, $0.longitude) }
            return points.count >= 2 ? (trip, points) : nil
        }
        let summits = trips.flatMap { trip in (trip.log?.summits ?? []).map { (trip, $0) } }
        guard !tracks.isEmpty || !summits.isEmpty else { return nil }

        var lines = [
            #"<?xml version="1.0" encoding="UTF-8"?>"#,
            #"<gpx version="1.1" creator="PackRat" xmlns="http://www.topografix.com/GPX/1/1">"#,
            "  <metadata><name>PackRat trips</name></metadata>",
        ]
        // GPX 1.1 orders waypoints before tracks.
        for (trip, summit) in summits {
            lines.append(#"  <wpt lat="\#(coordinate(summit.latitude))" lon="\#(coordinate(summit.longitude))">"#)
            if let elevation = summit.elevationMeters {
                lines.append("    <ele>\(number(elevation, digits: 0))</ele>")
            }
            lines.append("    <name>\(xmlEscape(summit.name))</name>")
            lines.append("    <desc>\(xmlEscape(trip.name))</desc>")
            lines.append("  </wpt>")
        }
        for (trip, points) in tracks {
            lines.append("  <trk>")
            lines.append("    <name>\(xmlEscape(trip.name))</name>")
            if let type = trip.log?.activities.first {
                lines.append("    <type>\(type.rawValue)</type>")
            }
            lines.append("    <trkseg>")
            for (latitude, longitude) in points {
                lines.append(#"      <trkpt lat="\#(coordinate(latitude))" lon="\#(coordinate(longitude))"/>"#)
            }
            lines.append("    </trkseg>")
            lines.append("  </trk>")
        }
        lines.append("</gpx>")
        return lines.joined(separator: "\n") + "\n"
    }

    static func xmlEscape(_ value: String) -> String {
        value
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&apos;")
    }

    static let gpxType = UTType(filenameExtension: "gpx", conformingTo: .xml) ?? .xml

    static func fileName(_ base: String, ext: String, now: Date = .now) -> String {
        "\(base) \(now.formatted(.iso8601.year().month().day())).\(ext)"
    }
}

/// The trips spreadsheet, written when the share sheet asks for it.
struct TripsCSVFile: Transferable {
    let contents: String
    let name: String

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .commaSeparatedText) { file in
            SentTransferredFile(try file.write())
        }
    }

    private func write() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        try Data(contents.utf8).write(to: url, options: .atomic)
        return url
    }
}

/// The routes as one GPX file, written when the share sheet asks for it.
struct RoutesGPXFile: Transferable {
    let contents: String
    let name: String

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: TripExport.gpxType) { file in
            SentTransferredFile(try file.write())
        }
    }

    private func write() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        try Data(contents.utf8).write(to: url, options: .atomic)
        return url
    }
}
