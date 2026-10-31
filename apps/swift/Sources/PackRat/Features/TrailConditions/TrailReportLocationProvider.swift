import CoreLocation
import Foundation

/// Where the hiker is while writing a report: it puts the nearest trails at
/// the top of the picker and is stamped on the report so readers can see it
/// was filed from the trail.
///
/// Never a precondition. A hiker who declines location still searches by
/// name and still submits; they just don't get the nearest-first list.
@Observable
@MainActor
final class TrailReportLocationProvider: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()

    private(set) var coordinate: CLLocationCoordinate2D?
    /// True once the user has said no, so the picker can stop waiting for a
    /// fix and lead with search instead.
    private(set) var isDenied = false

    override init() {
        super.init()
        manager.delegate = self
        // Enough to tell neighbouring trails apart and to place a report on
        // the trail, without asking for a GPS-precision fix.
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    /// Requests a fix if permission allows, asking the first time. Safe to call repeatedly.
    func start() {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        #if os(iOS)
        case .authorizedWhenInUse, .authorizedAlways:
            isDenied = false
            manager.requestLocation()
        #else
        case .authorized, .authorizedAlways:
            isDenied = false
            manager.requestLocation()
        #endif
        default:
            isDenied = true
        }
    }

    /// Requests a fix only if the hiker already allowed location. For screens
    /// where location is a nicety, like ranking search results, not worth a prompt.
    func startIfAllowed() {
        guard manager.authorizationStatus != .notDetermined else { return }
        start()
    }

    // MARK: - CLLocationManagerDelegate

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in start() }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let coordinate = locations.last?.coordinate else { return }
        Task { @MainActor in self.coordinate = coordinate }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // A missing fix means a name search instead of a nearby list — a normal
        // outcome, not an error worth reporting.
    }
}
