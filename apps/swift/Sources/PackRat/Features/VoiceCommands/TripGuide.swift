#if os(iOS)
import AudioToolbox
import CoreLocation
import Foundation
import Observation
import Sentry

/// Spoken guidance to one place on one trip, with the screen off and the
/// phone in a pocket. Keeps its own GPS running, so it works with or without
/// a recording, and is saved to disk so a relaunch picks it back up.
@Observable
@MainActor
final class TripGuide: NSObject, CLLocationManagerDelegate {
    static let shared = TripGuide()

    enum StartError: Error {
        case denied
        case noFix
        case alreadyThere
    }

    struct Session: Codable, Equatable {
        let tripId: String
        let tripName: String
        var guide: RouteGuide
        /// From the user to the destination, as of the latest fix.
        var bearing: Double
    }

    private(set) var session: Session?
    /// What guidance said last, shown on the card.
    private(set) var lastPrompt: String?

    @ObservationIgnored private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.activityType = .fitness
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 5
        manager.pausesLocationUpdatesAutomatically = false
    }

    func isGuiding(tripId: String) -> Bool { session?.tripId == tripId }

    private var metric: Bool { UserDefaults.standard.object(forKey: "preferMetric") as? Bool ?? true }

    // MARK: - Start and stop

    /// Starts guidance from where the user is now, and hands back the plan
    /// and that position for the opening sentence.
    @discardableResult
    func start(tripId: String, tripName: String, to destination: GuidanceDestination, route: [TripRoutePoint]?) async throws -> (GuidancePlan, TripRoutePoint) {
        let position = try await currentPosition()
        guard Geo.distance(position, destination.point) > RouteGuide.arrivalRadius else { throw StartError.alreadyThere }
        let plan = GuidancePlan(from: position, to: destination, route: route)
        var guide = RouteGuide(plan: plan)
        // Sets progress for the card; a turn right at the start is in the opening line's place.
        _ = guide.update(position: position, at: Date(), metric: metric)
        session = Session(tripId: tripId, tripName: tripName, guide: guide, bearing: Geo.bearing(from: position, to: destination.point))
        lastPrompt = nil
        persist()
        startUpdates()
        breadcrumb("Guidance started", tripId: tripId)
        return (plan, position)
    }

    func stop() {
        guard let ended = session else { return }
        manager.stopUpdatingLocation()
        manager.allowsBackgroundLocationUpdates = false
        session = nil
        lastPrompt = nil
        try? FileManager.default.removeItem(at: Self.fileURL)
        breadcrumb("Guidance stopped", tripId: ended.tripId)
    }

    /// Call at launch: carries on guidance PackRat was closed in the middle of.
    func resumeIfNeeded() {
        guard session == nil,
              let data = try? Data(contentsOf: Self.fileURL),
              let saved = try? JSONDecoder().decode(Session.self, from: data)
        else { return }
        session = saved
        startUpdates()
    }

    private func startUpdates() {
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
        manager.startUpdatingLocation()
    }

    /// The recorder's latest point when it's fresh, otherwise a new fix.
    private func currentPosition() async throws -> TripRoutePoint {
        if let sample = TrackRecorder.shared.track?.lastSample, Date().timeIntervalSince(sample.time) < 30 {
            return TripRoutePoint(latitude: sample.latitude, longitude: sample.longitude)
        }
        do {
            let fix = try await SafetyCheckInLocator().currentFix(timeout: .seconds(15))
            return TripRoutePoint(latitude: fix.latitude, longitude: fix.longitude)
        } catch SafetyCheckInLocator.LocatorError.denied {
            throw StartError.denied
        } catch {
            throw StartError.noFix
        }
    }

    // MARK: - Following

    private func follow(_ location: CLLocation) {
        guard var current = session else { return }
        // Never talk over a command in progress or an answer being said. The
        // guide isn't advanced either, so the prompt comes on the next fix.
        let phase = VoiceCommandController.shared.phase
        if phase == .listening || phase == .confirming || phase == .working || VoiceSpeaker.shared.isSpeaking { return }

        let position = TripRoutePoint(latitude: location.coordinate.latitude, longitude: location.coordinate.longitude)
        let prompts = current.guide.update(position: position, at: location.timestamp, metric: metric)
            .filter { VoiceCommandSettings.allows($0.kind) }
        current.bearing = Geo.bearing(from: position, to: current.guide.plan.destination.point)
        session = current

        if !prompts.isEmpty { deliver(prompts.map(\.text).joined(separator: " ")) }
        if current.guide.hasArrived {
            stop()
        } else if !prompts.isEmpty {
            persist()
        }
    }

    /// Says something guidance-related now, such as the opening line after
    /// Navigate is tapped.
    func announce(_ text: String) {
        deliver(text)
    }

    private func deliver(_ text: String) {
        lastPrompt = text
        if VoiceCommandSettings.guidanceVibratesOnly {
            AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
            return
        }
        Task {
            await VoiceSpeaker.shared.say(text)
            VoiceAudioSession.deactivate()
        }
    }

    // MARK: - Saving

    private static var fileURL: URL {
        URL.applicationSupportDirectory.appending(path: "trip-guidance.json")
    }

    private func persist() {
        guard let session else { return }
        do {
            try FileManager.default.createDirectory(at: URL.applicationSupportDirectory, withIntermediateDirectories: true)
            try JSONEncoder().encode(session).write(to: Self.fileURL, options: .atomic)
        } catch {
            SentrySDK.capture(error: error) { scope in
                scope.setTag(value: "voiceCommands", key: "feature")
                scope.setTag(value: "persistGuidance", key: "action")
            }
        }
    }

    private func breadcrumb(_ message: String, tripId: String) {
        let crumb = Breadcrumb(level: .info, category: "voiceCommands")
        crumb.message = message
        crumb.data = ["tripId": tripId]
        SentrySDK.addBreadcrumb(crumb)
    }

    // MARK: - CLLocationManagerDelegate

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last(where: { $0.horizontalAccuracy >= 0 && $0.horizontalAccuracy <= 50 }) else { return }
        Task { @MainActor in self.follow(location) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // No fix for a while just means no prompts until the sky comes back.
    }
}
#endif
