import Foundation
import Testing
@testable import PackRat

/// Covers #2719: the watch showed Fahrenheit for a location the phone showed in
/// Celsius, because the snapshot always formatted `tempF`. The watch renders the
/// string the phone sends, so the unit must be resolved from the phone's
/// preference at snapshot time.
@Suite("Watch temperature unit")
struct WatchTemperatureUnitTests {
    private func defaults() -> UserDefaults {
        UserDefaults(suiteName: "watch.temperature.tests.\(UUID().uuidString)")!
    }

    @Test("celsius preference formats the celsius reading")
    func celsiusPreferenceFormatsCelsiusReading() {
        // Taipei from the issue: 28°C / 82°F.
        let text = WatchTemperatureUnit.celsius.format(celsius: 28, fahrenheit: 82.4)

        #expect(text == "28°")
    }

    @Test("fahrenheit preference formats the fahrenheit reading")
    func fahrenheitPreferenceFormatsFahrenheitReading() {
        let text = WatchTemperatureUnit.fahrenheit.format(celsius: 28, fahrenheit: 82.4)

        #expect(text == "82°")
    }

    @Test("celsius is converted when the API only supplied fahrenheit")
    func celsiusIsConvertedWhenOnlyFahrenheitSupplied() {
        let text = WatchTemperatureUnit.celsius.format(celsius: nil, fahrenheit: 82.4)

        #expect(text == "28°")
    }

    @Test("fahrenheit is converted when the API only supplied celsius")
    func fahrenheitIsConvertedWhenOnlyCelsiusSupplied() {
        let text = WatchTemperatureUnit.fahrenheit.format(celsius: 28, fahrenheit: nil)

        #expect(text == "82°")
    }

    @Test("a missing reading renders the placeholder, not a bogus zero")
    func missingReadingRendersPlaceholder() {
        #expect(WatchTemperatureUnit.celsius.format(celsius: nil, fahrenheit: nil) == "--")
        #expect(WatchTemperatureUnit.fahrenheit.format(celsius: nil, fahrenheit: nil) == "--")
    }

    @Test("the stored phone preference is what resolves the unit")
    func storedPhonePreferenceResolvesUnit() {
        let store = defaults()

        store.set(AppPreferences.TemperatureUnit.celsius.rawValue, forKey: "temperatureUnit")
        #expect(WatchTemperatureUnit.fromDefaults(store) == .celsius)

        store.set(AppPreferences.TemperatureUnit.fahrenheit.rawValue, forKey: "temperatureUnit")
        #expect(WatchTemperatureUnit.fromDefaults(store) == .fahrenheit)
    }

    @Test("an unset preference falls back to the phone's own default")
    func unsetPreferenceFallsBackToPhoneDefault() {
        #expect(WatchTemperatureUnit.fromDefaults(defaults()) == .fahrenheit)
    }

    @Test("a corrupt stored preference degrades to the default rather than crashing")
    func corruptStoredPreferenceDegradesToDefault() {
        let store = defaults()
        store.set("kelvin", forKey: "temperatureUnit")

        #expect(WatchTemperatureUnit.fromDefaults(store) == .fahrenheit)
    }

    @Test("watch raw values match the phone preference so the setting maps across")
    func watchRawValuesMatchPhonePreference() {
        // The watch mirror is only correct while the two enums agree on the raw
        // strings @AppStorage persists — this pins that.
        #expect(
            WatchTemperatureUnit.celsius.rawValue
                == AppPreferences.TemperatureUnit.celsius.rawValue
        )
        #expect(
            WatchTemperatureUnit.fahrenheit.rawValue
                == AppPreferences.TemperatureUnit.fahrenheit.rawValue
        )
    }

    @Test("the watch agrees with the phone's weather formatter on the same reading")
    func watchAgreesWithPhoneFormatterOnSameReading() {
        // Same number, same rounding — only the unit suffix differs, since the
        // watch's large readout uses a bare degree sign.
        let phone = WeatherTemperatureDisplay.format(celsius: 28, fahrenheit: 82.4, unit: .celsius)
        let watch = WatchTemperatureUnit.celsius.format(celsius: 28, fahrenheit: 82.4)

        #expect(phone == "28°C")
        #expect(watch == "28°")
    }
}
