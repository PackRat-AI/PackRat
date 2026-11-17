import Foundation

/// Hands the watch app's weather state to its watch-face complications.
///
/// The complication runs in its own extension process and cannot see the
/// watch app's WatchConnectivity session or its standard defaults, so the app
/// writes the weather slice of each snapshot into a shared App Group and the
/// complication reads it back on every timeline reload.
enum WatchComplicationStore {
    static let appGroup = "group.com.andrewbierman.packrat.watch"
    private static let weatherKey = "watch.complication.weather"

    private static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

    /// Stores the weather slice. Returns whether it differed from what was
    /// stored, so the caller only spends a complication reload on a change —
    /// the system rations reloads per day.
    @discardableResult
    static func save(_ weather: WatchWeatherSnapshot) -> Bool {
        // Compared as values, not bytes: JSONEncoder's key order is not stable
        // between encodes, so identical weather can produce different data.
        guard let defaults, loadWeather() != weather,
              let data = try? JSONEncoder().encode(weather) else { return false }
        defaults.set(data, forKey: weatherKey)
        return true
    }

    static func loadWeather() -> WatchWeatherSnapshot? {
        guard let data = defaults?.data(forKey: weatherKey) else { return nil }
        return try? JSONDecoder().decode(WatchWeatherSnapshot.self, from: data)
    }
}
