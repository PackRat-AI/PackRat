import Foundation
import SwiftData

/// Waypoints and recorded tracks land in the trip's log, so they sync through
/// the same outbox as any other log edit and work with no signal.
extension TripsViewModel {
    func addWaypoint(_ waypoint: TripWaypoint, to tripId: String, context: ModelContext? = nil) async {
        guard let trip = trips.first(where: { $0.id == tripId }) else { return }
        var log = trip.log ?? TripLog()
        log.waypoints.append(waypoint)
        await saveLog(log, for: tripId, context: context)
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
    /// "Waypoint 2:14 PM" when the user didn't name it.
    static func named(_ name: String?, note: String? = nil, latitude: Double, longitude: Double, elevation: Double?, at date: Date = Date()) -> TripWaypoint {
        TripWaypoint(
            id: UUID().uuidString,
            name: name ?? "Waypoint \(date.formatted(date: .omitted, time: .shortened))",
            note: note,
            latitude: latitude,
            longitude: longitude,
            elevationMeters: elevation,
            createdAt: date.ISO8601Format()
        )
    }
}
