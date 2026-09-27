import CoreLocation
import Foundation

/// Supplies the coarse location used as a ranking prior, and the coordinates
/// stamped onto a saved sighting.
///
/// Two properties make this worth its own small type rather than a call into
/// `CLLocationManager` from the view model:
///
/// - **It never blocks identification.** The prior removes absurd matches; it
///   is not a precondition for answering. A user who declines location, or
///   whose fix has not arrived, gets an unpriored ranking rather than a
///   spinner or a prompt standing between them and the animal in front of
///   them.
/// - **It asks for as little as it can.** Reduced accuracy is plenty to decide
///   which continent's species are plausible, and it costs the user less.
@Observable
@MainActor
final class WildlifeLocationProvider: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()

    private(set) var coordinate: CLLocationCoordinate2D?

    /// The device's biogeographic region, matching the `regions` vocabulary in
    /// the species packs (`north-america`, `europe`, `asia`, …). Nil when no
    /// fix is available.
    private(set) var region: String?

    override init() {
        super.init()
        manager.delegate = self
        // A species range is a continent-scale fact. Full accuracy would buy
        // nothing and cost the user precision they did not need to give up.
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    /// Requests a fix if permission allows, and asks for permission the first
    /// time. Safe to call repeatedly.
    func start() {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            manager.requestLocation()
        default:
            // Denied or restricted. Nothing to do and nothing to report —
            // this is a supported way to use the feature, not an error.
            break
        }
    }

    // MARK: - CLLocationManagerDelegate

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in start() }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        let coordinate = location.coordinate
        Task { @MainActor in
            self.coordinate = coordinate
            self.region = Self.region(for: coordinate)
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Swallowed deliberately. A failed fix means an unpriored ranking,
        // which is a normal outcome, so it is not worth an error report or a
        // message to the user.
    }

    // MARK: - Region

    /// Maps a coordinate to the coarse region vocabulary the packs use.
    ///
    /// Bounding boxes rather than a geocoder: this has to work with no
    /// network, which is the entire premise of the feature, and the answer
    /// only needs to be right at continent scale to be useful as a prior.
    /// A coordinate that falls outside every box yields nil, which the ranker
    /// treats as "no prior" rather than "nowhere".
    nonisolated static func region(for coordinate: CLLocationCoordinate2D) -> String? {
        let lat = coordinate.latitude
        let lon = coordinate.longitude

        switch (lat, lon) {
        case (7...84, -170 ... -50): return "north-america"
        case (-56..<7, -92 ... -34): return "south-america"
        case (35...72, -25...45): return "europe"
        case (-35..<35, -18...52): return "africa"
        case (5...78, 45...180): return "asia"
        case (-48 ..< -10, 110...180): return "oceania"
        default: return nil
        }
    }
}
