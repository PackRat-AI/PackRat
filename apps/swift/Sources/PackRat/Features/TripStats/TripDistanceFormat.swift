import Foundation

/// Distance and elevation in the user's units. There is no separate distance
/// preference: a user who reads wind in mph reads trails in miles and feet,
/// and km/h means kilometres and metres.
enum TripDistanceUnit: Sendable {
    case metric, imperial

    init(speedUnit: SpeedUnit) {
        self = speedUnit == .mph ? .imperial : .metric
    }

    var distanceSymbol: String { self == .imperial ? "mi" : "km" }
    var elevationSymbol: String { self == .imperial ? "ft" : "m" }

    private var metresPerDistanceUnit: Double { self == .imperial ? 1_609.344 : 1_000 }
    private var metresPerElevationUnit: Double { self == .imperial ? 0.3048 : 1 }

    func distanceValue(_ metres: Double) -> Double { metres / metresPerDistanceUnit }
    func metres(fromDistance value: Double) -> Double { value * metresPerDistanceUnit }
    func elevationValue(_ metres: Double) -> Double { metres / metresPerElevationUnit }
    func metres(fromElevation value: Double) -> Double { value * metresPerElevationUnit }

    /// "12.4 mi", or "1,240 km" once the decimal stops adding anything.
    func formatDistance(_ metres: Double) -> String {
        let value = distanceValue(metres)
        let digits = value >= 100 ? 0 : 1
        return value.formatted(.number.precision(.fractionLength(digits))) + " " + distanceSymbol
    }

    func formatElevation(_ metres: Double) -> String {
        elevationValue(metres).formatted(.number.precision(.fractionLength(0))) + " " + elevationSymbol
    }

    /// Short gaps, like how far a peak sits from a route: "0.4 mi" or "650 m".
    func formatShortDistance(_ metres: Double) -> String {
        if self == .metric, metres < 1_000 {
            return "\(Int((metres / 10).rounded()) * 10) m"
        }
        let value = distanceValue(metres)
        return value.formatted(.number.precision(.fractionLength(value < 10 ? 1 : 0))) + " " + distanceSymbol
    }
}
