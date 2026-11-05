import Foundation

/// A hike recorded on the phone: the path in stretches between pauses, with
/// distance, climbing and time moving kept as it grows.
///
/// A pause ends a stretch, so a ride back to the trailhead between pause and
/// resume never counts as distance walked.
struct RecordedTrack: Codable, Equatable, Sendable {
    struct Sample: Codable, Equatable, Sendable {
        let latitude: Double
        let longitude: Double
        /// Metres above sea level, when the fix had a usable one.
        let altitude: Double?
        let time: Date

        var trackPoint: TrackPoint { TrackPoint(latitude: latitude, longitude: longitude, elevation: altitude) }
    }

    let tripId: String
    let tripName: String
    let startedAt: Date
    private(set) var stretches: [[Sample]] = [[]]
    private(set) var isPaused = false
    private(set) var distanceMeters = 0.0
    private(set) var elevationGainMeters = 0.0
    private(set) var movingSeconds = 0.0
    /// Low point the next climb is measured from (see `TrackMath.elevationGain`).
    private var climbReference: Double?

    /// Faster than this between fixes counts as moving; slower is standing about.
    static let movingSpeed = 0.3
    /// A longer gap than this between fixes isn't counted as time moving: the
    /// phone lost the sky, not the user walking.
    static let longestMovingGap = 120.0
    static let climbThreshold = 3.0

    init(tripId: String, tripName: String, startedAt: Date) {
        self.tripId = tripId
        self.tripName = tripName
        self.startedAt = startedAt
    }

    var samples: [Sample] { stretches.flatMap { $0 } }
    var lastSample: Sample? { stretches.last(where: { !$0.isEmpty })?.last }

    mutating func append(_ sample: Sample) {
        guard !isPaused else { return }
        if let previous = stretches[stretches.count - 1].last {
            let step = TrackMath.haversine(previous.trackPoint, sample.trackPoint)
            let seconds = sample.time.timeIntervalSince(previous.time)
            guard seconds >= 0 else { return }
            distanceMeters += step
            if seconds > 0, seconds <= Self.longestMovingGap, step / seconds >= Self.movingSpeed {
                movingSeconds += seconds
            }
        }
        if let altitude = sample.altitude {
            if let reference = climbReference {
                if altitude - reference >= Self.climbThreshold {
                    elevationGainMeters += altitude - reference
                    climbReference = altitude
                } else if altitude < reference {
                    climbReference = altitude
                }
            } else {
                climbReference = altitude
            }
        }
        stretches[stretches.count - 1].append(sample)
    }

    mutating func pause() {
        isPaused = true
    }

    mutating func resume() {
        guard isPaused else { return }
        isPaused = false
        if stretches.last?.isEmpty == false { stretches.append([]) }
        // Climbing restarts from wherever the user is when they set off again.
        climbReference = nil
    }

    /// What goes into the trip log, or nil when too little was recorded to
    /// draw a line.
    var logRoute: String? {
        let points = samples.map(\.trackPoint)
        guard points.count >= 2 else { return nil }
        return Polyline.encode(TrackMath.simplify(points).map(\.coordinate))
    }

    /// The trip's log with this recording's distance, climbing and route in
    /// it. Everything else the user entered is kept.
    func applied(to log: TripLog?) -> TripLog {
        var log = log ?? TripLog()
        guard let route = logRoute else { return log }
        log.distanceMeters = distanceMeters
        log.elevationGainMeters = elevationGainMeters
        log.route = route
        log.source = .track
        return log
    }
}
