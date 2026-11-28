#if os(iOS)
import CoreLocation
import Foundation
import Observation
import Sentry

/// Records the user's path with continuous GPS while a trip is underway,
/// including with the screen off and the phone in a pocket.
///
/// Unlike `SafetyLocationTracker`'s significant-change monitoring, this keeps
/// the GPS on, so it only runs between start and stop. The recording is
/// saved to disk as it grows and picked up again if PackRat is relaunched.
@Observable
@MainActor
final class TrackRecorder: NSObject, CLLocationManagerDelegate {
    static let shared = TrackRecorder()

    enum StartError: Error {
        case denied
    }

    private(set) var track: RecordedTrack?

    @ObservationIgnored private let manager = CLLocationManager()
    @ObservationIgnored private var authContinuation: CheckedContinuation<Void, Never>?
    @ObservationIgnored private var unsavedSamples = 0

    /// Fixes less accurate than this are dropped: under trees they wander
    /// enough to add distance that was never walked.
    static let worstAccuracy = 50.0

    override init() {
        super.init()
        manager.delegate = self
        manager.activityType = .fitness
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 5
        manager.pausesLocationUpdatesAutomatically = false
    }

    var isRecording: Bool { track.map { !$0.isPaused } ?? false }

    func isRecording(tripId: String) -> Bool { track?.tripId == tripId }

    // MARK: - Start, pause, stop

    func start(tripId: String, tripName: String) async throws {
        guard track == nil else { return }
        if manager.authorizationStatus == .notDetermined {
            await withCheckedContinuation { continuation in
                authContinuation = continuation
                manager.requestWhenInUseAuthorization()
            }
        }
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse: break
        default: throw StartError.denied
        }
        track = RecordedTrack(tripId: tripId, tripName: tripName, startedAt: Date())
        persist()
        startUpdates()
        breadcrumb("Tracking started", tripId: tripId)
    }

    func pause() {
        guard track?.isPaused == false else { return }
        track?.pause()
        manager.stopUpdatingLocation()
        persist()
    }

    func resume() {
        guard track?.isPaused == true else { return }
        track?.resume()
        persist()
        startUpdates()
    }

    /// Ends the recording and hands it back for the trip log.
    @discardableResult
    func stop() -> RecordedTrack? {
        guard let finished = track else { return nil }
        manager.stopUpdatingLocation()
        manager.allowsBackgroundLocationUpdates = false
        track = nil
        try? FileManager.default.removeItem(at: Self.fileURL)
        breadcrumb("Tracking stopped", tripId: finished.tripId)
        return finished
    }

    /// Call at launch: carries on a recording PackRat was closed in the middle of.
    func resumeIfNeeded() {
        guard track == nil,
              let data = try? Data(contentsOf: Self.fileURL),
              let saved = try? JSONDecoder().decode(RecordedTrack.self, from: data)
        else { return }
        track = saved
        if !saved.isPaused { startUpdates() }
    }

    private func startUpdates() {
        // Needs the `location` background mode. With When In Use, iOS keeps
        // updates flowing with the screen off and shows the blue indicator.
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
        manager.startUpdatingLocation()
    }

    // MARK: - Saving

    private static var fileURL: URL {
        URL.applicationSupportDirectory.appending(path: "recorded-track.json")
    }

    private func persist() {
        guard let track else { return }
        unsavedSamples = 0
        do {
            try FileManager.default.createDirectory(at: URL.applicationSupportDirectory, withIntermediateDirectories: true)
            try JSONEncoder().encode(track).write(to: Self.fileURL, options: .atomic)
        } catch {
            SentrySDK.capture(error: error) { scope in
                scope.setTag(value: "voiceCommands", key: "feature")
                scope.setTag(value: "persistTrack", key: "action")
            }
        }
    }

    private func record(_ locations: [CLLocation]) {
        guard track != nil else { return }
        for location in locations
        where location.horizontalAccuracy >= 0 && location.horizontalAccuracy <= Self.worstAccuracy {
            let usableAltitude = location.verticalAccuracy >= 0 && location.verticalAccuracy <= 30
            track?.append(.init(
                latitude: location.coordinate.latitude,
                longitude: location.coordinate.longitude,
                altitude: usableAltitude ? location.altitude : nil,
                time: location.timestamp
            ))
            unsavedSamples += 1
        }
        // Every point would rewrite a growing file every few seconds; a batch
        // loses at most a minute or two of path if PackRat is killed.
        if unsavedSamples >= 20 { persist() }
    }

    private func breadcrumb(_ message: String, tripId: String) {
        let crumb = Breadcrumb(level: .info, category: "voiceCommands")
        crumb.message = message
        crumb.data = ["tripId": tripId]
        SentrySDK.addBreadcrumb(crumb)
    }

    // MARK: - CLLocationManagerDelegate

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        Task { @MainActor in self.record(locations) }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            guard manager.authorizationStatus != .notDetermined else { return }
            self.authContinuation?.resume()
            self.authContinuation = nil
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // No fix for a while just leaves a gap; updates carry on when the sky
        // comes back.
    }
}
#endif
