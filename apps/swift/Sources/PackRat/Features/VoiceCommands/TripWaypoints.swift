import Foundation
import SwiftData

/// Waypoints and recorded tracks land in the trip's log, so they sync through
/// the same outbox as any other log edit and work with no signal.
extension TripsViewModel {
    /// False when the trip already has as many waypoints as it can sync.
    @discardableResult
    func addWaypoint(_ waypoint: TripWaypoint, to tripId: String, context: ModelContext? = nil) async -> Bool {
        guard let trip = trips.first(where: { $0.id == tripId }) else { return false }
        var log = trip.log ?? TripLog()
        guard log.waypoints.count < TripWaypoint.maxPerTrip else { return false }
        log.waypoints.append(waypoint)
        await saveLog(log, for: tripId, context: context)
        return true
    }

    func removeWaypoint(_ id: String, from tripId: String, context: ModelContext? = nil) async {
        guard var log = trips.first(where: { $0.id == tripId })?.log else { return }
        log.waypoints.removeAll { $0.id == id }
        await saveLog(log, for: tripId, context: context)
    }

    /// Puts a finished recording's distance, climbing and route in the trip log.
    func saveRecording(_ track: RecordedTrack, context: ModelContext? = nil) async {
        guard track.logRoute != nil, let trip = trips.first(where: { $0.id == track.tripId }) else { return }
        await saveLog(track.applied(to: trip.log), for: track.tripId, context: context)
    }
}

extension TripWaypoint {
    /// The server's limits (`TripWaypointSchema`); anything over them would
    /// stop the whole trip from syncing.
    static let maxPerTrip = 500
    static let maxNameLength = 200
    static let maxNoteLength = 2_000

    /// "Waypoint 2:14 PM" when the user didn't name it.
    static func named(_ name: String?, note: String? = nil, latitude: Double, longitude: Double, elevation: Double?, at date: Date = Date()) -> TripWaypoint {
        TripWaypoint(
            id: UUID().uuidString,
            name: (name ?? "Waypoint \(date.formatted(date: .omitted, time: .shortened))").clipped(toUTF16: maxNameLength),
            note: note?.clipped(toUTF16: maxNoteLength),
            latitude: latitude,
            longitude: longitude,
            elevationMeters: elevation,
            createdAt: date.ISO8601Format()
        )
    }
}

private extension String {
    /// Cut to a length the server counts in UTF-16 units, never mid-character.
    func clipped(toUTF16 limit: Int) -> String {
        guard utf16.count > limit else { return self }
        var result = ""
        for character in self {
            guard result.utf16.count + character.utf16.count <= limit else { break }
            result.append(character)
        }
        return result
    }
}
