import CoreLocation
import Foundation

/// A US National Park and its boundary, from the bundled `NationalParks.json`
/// (built by `apps/swift/scripts/generate-national-parks.ts` from the NPS
/// boundary service). Boundaries are simplified to about 600 m: plenty to
/// tell whether a trip was inside a park, not a survey line.
struct NationalPark: Identifiable, Sendable {
    /// The NPS unit code, e.g. "YOSE". Stable, and what manual visits store.
    let code: String
    let name: String
    let states: [String]
    /// Outer boundaries and holes alike; the even-odd rule sorts them out.
    let rings: [[CLLocationCoordinate2D]]
    let minLatitude: Double
    let maxLatitude: Double
    let minLongitude: Double
    let maxLongitude: Double

    var id: String { code }

    var center: CLLocationCoordinate2D {
        CLLocationCoordinate2D(
            latitude: (minLatitude + maxLatitude) / 2,
            longitude: (minLongitude + maxLongitude) / 2
        )
    }

    init(code: String, name: String, states: [String], rings: [[CLLocationCoordinate2D]]) {
        self.code = code
        self.name = name
        self.states = states
        self.rings = rings
        let points = rings.flatMap { $0 }
        minLatitude = points.map(\.latitude).min() ?? 0
        maxLatitude = points.map(\.latitude).max() ?? 0
        minLongitude = points.map(\.longitude).min() ?? 0
        maxLongitude = points.map(\.longitude).max() ?? 0
    }

    /// Even-odd ray casting over every ring, after a bounding-box check that
    /// rules out almost every park for almost every point.
    func contains(_ point: CLLocationCoordinate2D) -> Bool {
        guard point.latitude >= minLatitude, point.latitude <= maxLatitude,
              point.longitude >= minLongitude, point.longitude <= maxLongitude
        else { return false }
        var inside = false
        for ring in rings where ring.count >= 3 {
            var j = ring.count - 1
            for i in 0..<ring.count {
                let a = ring[i], b = ring[j]
                if (a.latitude > point.latitude) != (b.latitude > point.latitude) {
                    let crossing = (b.longitude - a.longitude) * (point.latitude - a.latitude)
                        / (b.latitude - a.latitude) + a.longitude
                    if point.longitude < crossing { inside.toggle() }
                }
                j = i
            }
        }
        return inside
    }
}

enum NationalParks {
    /// The official count, which the generator checks the dataset against.
    static let count = 63

    /// Every park, by name. Empty only if the bundled file is missing.
    static let all: [NationalPark] = load(from: .main)

    static func load(from bundle: Bundle) -> [NationalPark] {
        guard let url = bundle.url(forResource: "NationalParks", withExtension: "json"),
              let data = try? Data(contentsOf: url)
        else { return [] }
        return decode(data)
    }

    static func decode(_ data: Data) -> [NationalPark] {
        struct Row: Decodable {
            let code: String
            let name: String
            let states: [String]
            /// Flat `[lng, lat, lng, lat, …]` per ring, to keep the file small.
            let rings: [[Double]]
        }
        guard let rows = try? JSONDecoder().decode([Row].self, from: data) else { return [] }
        return rows.map { row in
            let rings = row.rings.map { flat in
                stride(from: 0, to: flat.count - 1, by: 2).map {
                    CLLocationCoordinate2D(latitude: flat[$0 + 1], longitude: flat[$0])
                }
            }
            return NationalPark(code: row.code, name: row.name, states: row.states, rings: rings)
        }
    }
}
