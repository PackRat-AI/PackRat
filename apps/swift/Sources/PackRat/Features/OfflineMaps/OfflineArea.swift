import CoreLocation
import Defaults
import Foundation

/// How much of the map a saved area keeps.
///
/// Zoom ranges end on Mapbox's tile-pack group edges (0-5, 6-10, 11-14,
/// 15-16): a request inside a group downloads the whole group anyway, so
/// stopping mid-group would cost the same space and show less.
enum OfflineDetailLevel: String, Codable, CaseIterable, Identifiable, Defaults.Serializable {
    case standard
    case trail

    var id: String { rawValue }

    var label: String {
        switch self {
        case .standard: return "Standard"
        case .trail: return "Trail detail"
        }
    }

    var summary: String {
        switch self {
        case .standard: return "Roads, towns and terrain."
        case .trail: return "Adds the closest zoom levels for following a path."
        }
    }

    var maxZoom: UInt8 {
        switch self {
        case .standard: return 14
        case .trail: return 16
        }
    }
}

/// The rectangle a saved area covers, stored as plain degrees so it encodes
/// without depending on the map SDK.
struct OfflineAreaBounds: Codable, Hashable, Defaults.Serializable {
    var south: Double
    var west: Double
    var north: Double
    var east: Double

    var center: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: (south + north) / 2, longitude: (west + east) / 2)
    }

    /// Closed ring, counter-clockwise from the south-west corner.
    var ring: [CLLocationCoordinate2D] {
        [
            CLLocationCoordinate2D(latitude: south, longitude: west),
            CLLocationCoordinate2D(latitude: south, longitude: east),
            CLLocationCoordinate2D(latitude: north, longitude: east),
            CLLocationCoordinate2D(latitude: north, longitude: west),
            CLLocationCoordinate2D(latitude: south, longitude: west),
        ]
    }

    func contains(_ coordinate: CLLocationCoordinate2D) -> Bool {
        (south...north).contains(coordinate.latitude) && (west...east).contains(coordinate.longitude)
    }
}

/// A point on a saved trail line, stored as plain degrees like the bounds.
struct OfflinePoint: Codable, Hashable, Defaults.Serializable {
    var latitude: Double
    var longitude: Double

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

/// A map area the user saved for offline use.
///
/// The tiles live in Mapbox's tile store under `id`; this record carries
/// what the tile store does not: the user's name for it, the detail level,
/// and the trip or trail it was saved for.
struct OfflineArea: Codable, Hashable, Identifiable, Defaults.Serializable {
    var id: String
    var name: String
    var bounds: OfflineAreaBounds
    var detail: OfflineDetailLevel
    var savedAt: Date
    var tripId: String?
    var tripEndDate: Date?
    var trailId: String?
    /// The trail's line, kept so the saved map can draw it without signal.
    var trailLines: [[OfflinePoint]]?
    /// Bytes on disk once the download finished. Zero while downloading.
    var sizeBytes: Int64 = 0
    /// False until every tile has arrived, so an interrupted download can be
    /// picked up again on the next launch.
    var isComplete: Bool = false

    var tripHasEnded: Bool {
        guard let tripEndDate else { return false }
        return tripEndDate < Date()
    }
}

extension Defaults.Keys {
    static let offlineAreas = Key<[OfflineArea]>("offlineAreas", default: [])
    /// Off by default: map downloads run to hundreds of megabytes.
    static let offlineMapsAllowCellular = Key<Bool>("offlineMapsAllowCellular", default: false)
    /// Zero means no limit.
    static let offlineMapsStorageLimitBytes = Key<Int64>("offlineMapsStorageLimitBytes", default: 0)
}

extension Int64 {
    var fileSizeText: String { ByteCountFormatter.string(fromByteCount: self, countStyle: .file) }
}
