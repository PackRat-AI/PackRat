#if os(iOS)
import CoreLocation
import Foundation

/// Follows the user's progress during a check-in that allowed it.
///
/// Uses significant-change monitoring, not continuous GPS: iOS wakes the app
/// when the user has moved a meaningful distance (roughly 500 m), which costs
/// almost nothing in battery over a day on the trail and keeps working while
/// the app is suspended or relaunched in the background. Points are queued
/// offline and uploaded whenever there is signal.
@MainActor
final class SafetyLocationTracker: NSObject, CLLocationManagerDelegate {
    static let shared = SafetyLocationTracker()

    private let manager = CLLocationManager()
    private(set) var isTracking = false

    override init() {
        super.init()
        manager.delegate = self
    }

    var authorization: CLAuthorizationStatus { manager.authorizationStatus }

    func start() {
        guard CLLocationManager.significantLocationChangeMonitoringAvailable() else { return }
        switch manager.authorizationStatus {
        case .notDetermined, .authorizedWhenInUse:
            // Background updates need Always. iOS shows the upgrade prompt at a
            // moment of its choosing; monitoring starts once it's granted.
            manager.requestAlwaysAuthorization()
        case .authorizedAlways:
            break
        default:
            return
        }
        manager.startMonitoringSignificantLocationChanges()
        isTracking = true
    }

    func stop() {
        manager.stopMonitoringSignificantLocationChanges()
        isTracking = false
    }

    /// Call at launch: after iOS relaunches the app for a location event, the
    /// manager must be recreated and monitoring restarted to receive it.
    func resumeIfNeeded() {
        guard SafetyCheckInStore.shared.hasTrackingCheckIn else { return }
        start()
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let fixes = locations
            .filter { $0.horizontalAccuracy >= 0 && $0.horizontalAccuracy <= 1_000 }
            .map {
                SafetyLocationFix(
                    latitude: $0.coordinate.latitude,
                    longitude: $0.coordinate.longitude,
                    accuracy: $0.horizontalAccuracy,
                    recordedAt: $0.timestamp
                )
            }
        Task { @MainActor in SafetyCheckInStore.shared.recordTrackPoints(fixes) }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            if self.isTracking, manager.authorizationStatus == .authorizedAlways {
                manager.startMonitoringSignificantLocationChanges()
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // A missed fix just means a gap in the path; the next significant
        // change fills it. Not worth reporting.
    }
}

/// One accurate fix for a manual check-in, with a place name when the phone
/// can look one up (it can't offline; the coordinates are what matter).
@MainActor
final class SafetyCheckInLocator: NSObject, CLLocationManagerDelegate {
    enum LocatorError: LocalizedError {
        case denied
        case unavailable

        var errorDescription: String? {
            switch self {
            case .denied:
                "PackRat needs your location to check in. Allow it in Settings › PackRat › Location."
            case .unavailable:
                "Couldn't get a fix. Move to open sky and try again."
            }
        }
    }

    private let manager = CLLocationManager()
    private var authContinuation: CheckedContinuation<Void, Never>?

    override init() {
        super.init()
        manager.delegate = self
    }

    func currentFix(timeout: Duration = .seconds(30)) async throws -> SafetyLocationFix {
        if manager.authorizationStatus == .notDetermined {
            await withCheckedContinuation { continuation in
                authContinuation = continuation
                manager.requestWhenInUseAuthorization()
            }
        }
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse: break
        default: throw LocatorError.denied
        }

        let location = try await bestLocation(within: timeout)
        var fix = SafetyLocationFix(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            accuracy: location.horizontalAccuracy,
            recordedAt: location.timestamp
        )
        fix.placeName = await Self.placeName(for: location)
        return fix
    }

    /// The first fix within 50 m, or the best one seen when time runs out.
    /// The updates stream can go quiet with no fix at all (indoors, no sky), so
    /// it races a hard timeout rather than relying on the next update arriving.
    private func bestLocation(within timeout: Duration) async throws -> CLLocation {
        let found = try await withThrowingTaskGroup(of: CLLocation?.self) { group in
            group.addTask {
                let clock = ContinuousClock()
                let deadline = clock.now.advanced(by: timeout)
                var best: CLLocation?
                for try await update in CLLocationUpdate.liveUpdates() {
                    if let location = update.location, location.horizontalAccuracy >= 0,
                       location.horizontalAccuracy < (best?.horizontalAccuracy ?? .infinity) {
                        best = location
                        if location.horizontalAccuracy <= 50 { break }
                    }
                    if clock.now >= deadline { break }
                }
                return best
            }
            group.addTask {
                try await Task.sleep(for: timeout + .seconds(5))
                return nil
            }
            let first = try await group.next() ?? nil
            group.cancelAll()
            return first
        }
        guard let found else { throw LocatorError.unavailable }
        return found
    }

    private static func placeName(for location: CLLocation) async -> String? {
        guard let placemark = try? await CLGeocoder().reverseGeocodeLocation(location).first else {
            return nil
        }
        return placemark.areasOfInterest?.first ?? placemark.name ?? placemark.locality
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            guard manager.authorizationStatus != .notDetermined else { return }
            self.authContinuation?.resume()
            self.authContinuation = nil
        }
    }
}
#endif
