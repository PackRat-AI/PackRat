import SwiftUI

/// The sky behind a forecast hero.
///
/// Apple Weather uses full-bleed photography that shifts with condition and
/// time of day. A gradient reaches for the same effect — the screen feels like
/// the weather it is describing — without shipping and licensing an image set
/// per condition. The palettes below are deliberately desaturated: the hero's
/// white type sits directly on this, so contrast has to hold at every stop.
enum WeatherSkyGradient {
    /// Maps a WeatherAPI condition code plus day/night to a sky.
    /// Codes match `WeatherCondition.sfSymbol`, so a condition that gets its
    /// own symbol gets its own sky.
    static func colors(conditionCode: Int?, isDay: Bool) -> [Color] {
        guard let conditionCode else { return overcast(isDay: isDay) }
        switch conditionCode {
        case 1000:
            return clear(isDay: isDay)
        case 1003:
            return partlyCloudy(isDay: isDay)
        case 1006, 1009:
            return overcast(isDay: isDay)
        case 1030, 1135, 1147:
            return fog(isDay: isDay)
        case 1063, 1180...1201:
            return rain(isDay: isDay)
        case 1066, 1210...1225:
            return snow(isDay: isDay)
        case 1087, 1273...1282:
            return storm(isDay: isDay)
        default:
            return overcast(isDay: isDay)
        }
    }

    static func gradient(conditionCode: Int?, isDay: Bool) -> LinearGradient {
        LinearGradient(
            colors: colors(conditionCode: conditionCode, isDay: isDay),
            startPoint: .top,
            endPoint: .bottom
        )
    }

    // MARK: - Palettes

    private static func clear(isDay: Bool) -> [Color] {
        isDay
            ? [Color(red: 0.16, green: 0.45, blue: 0.78), Color(red: 0.38, green: 0.66, blue: 0.89)]
            : [Color(red: 0.04, green: 0.07, blue: 0.20), Color(red: 0.10, green: 0.16, blue: 0.35)]
    }

    private static func partlyCloudy(isDay: Bool) -> [Color] {
        isDay
            ? [Color(red: 0.24, green: 0.48, blue: 0.72), Color(red: 0.51, green: 0.67, blue: 0.82)]
            : [Color(red: 0.07, green: 0.10, blue: 0.22), Color(red: 0.16, green: 0.21, blue: 0.36)]
    }

    private static func overcast(isDay: Bool) -> [Color] {
        isDay
            ? [Color(red: 0.38, green: 0.45, blue: 0.53), Color(red: 0.56, green: 0.62, blue: 0.68)]
            : [Color(red: 0.11, green: 0.13, blue: 0.17), Color(red: 0.22, green: 0.25, blue: 0.30)]
    }

    private static func fog(isDay: Bool) -> [Color] {
        isDay
            ? [Color(red: 0.49, green: 0.53, blue: 0.56), Color(red: 0.66, green: 0.69, blue: 0.71)]
            : [Color(red: 0.13, green: 0.15, blue: 0.17), Color(red: 0.27, green: 0.29, blue: 0.32)]
    }

    private static func rain(isDay: Bool) -> [Color] {
        isDay
            ? [Color(red: 0.27, green: 0.36, blue: 0.46), Color(red: 0.42, green: 0.52, blue: 0.61)]
            : [Color(red: 0.06, green: 0.10, blue: 0.16), Color(red: 0.15, green: 0.21, blue: 0.29)]
    }

    private static func snow(isDay: Bool) -> [Color] {
        isDay
            ? [Color(red: 0.44, green: 0.52, blue: 0.60), Color(red: 0.68, green: 0.73, blue: 0.78)]
            : [Color(red: 0.10, green: 0.13, blue: 0.19), Color(red: 0.24, green: 0.28, blue: 0.35)]
    }

    private static func storm(isDay: Bool) -> [Color] {
        isDay
            ? [Color(red: 0.20, green: 0.24, blue: 0.33), Color(red: 0.36, green: 0.40, blue: 0.48)]
            : [Color(red: 0.04, green: 0.06, blue: 0.11), Color(red: 0.13, green: 0.15, blue: 0.22)]
    }
}
