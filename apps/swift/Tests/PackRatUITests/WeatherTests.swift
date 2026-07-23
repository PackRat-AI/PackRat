import XCTest

#if os(iOS)
// iOS-only suite — uses goToTab() (UITabBar) which doesnt exist on macOS.

/// End-to-end tests for Weather: location search, forecast display, saved locations.
final class WeatherTests: AppUITestCase {
    override var additionalLaunchArguments: [String] {
        ["--ui-test-fixtures", "-temperatureUnit", "°C"]
    }

    private let testCity = "Denver"
    private let testCityFull = "Denver"  // fragment to match in search results
    private let weatherSearchTimeout: TimeInterval = 20

    // MARK: - Search

    func testLocationSearchReturnsResults() {
        goToWeather()

        let searchField = app.searchFields["Search locations\u{2026}"]
        waitFor(searchField, message: "Weather search field must appear")
        searchField.tap()
        searchField.typeText(testCity)

        // Search results should appear (they load from the WeatherAPI)
        let results = weatherSearchResults()
        XCTAssertTrue(
            results.firstMatch.waitForExistence(timeout: weatherSearchTimeout),
            "Search results for '\(testCity)' must appear"
        )
    }

    func testSelectLocationLoadsForecast() {
        goToWeather()

        let searchField = app.searchFields["Search locations\u{2026}"]
        waitFor(searchField)
        searchField.tap()
        searchField.typeText(testCity)

        // Wait for results and tap the first match
        let firstResult = weatherSearchResults().firstMatch
        waitFor(firstResult, timeout: weatherSearchTimeout)
        firstResult.tap()

        // Forecast card: current temperature shows a °
        let tempLabel = app.descendants(matching: .any)["weather_current_card"]
        XCTAssertTrue(
            tempLabel.waitForExistence(timeout: 20),
            "Temperature reading must appear after selecting a location"
        )
    }

    func testSavedLocationAppearsAsChip() {
        goToWeather()

        let searchField = app.searchFields["Search locations\u{2026}"]
        waitFor(searchField)
        searchField.tap()
        searchField.typeText(testCity)

        let firstResult = weatherSearchResults().firstMatch
        waitFor(firstResult, timeout: weatherSearchTimeout)
        firstResult.tap()

        // Clear search to show saved locations section
        let clearButton = app.buttons.matching(
            NSPredicate(format: "label CONTAINS 'xmark' OR label == 'Clear'")
        ).firstMatch
        clearButton.tapIfExists()

        // Saved location chip should appear
        XCTAssertTrue(
            app.staticTexts.matching(NSPredicate(format: "label CONTAINS '\(testCityFull)'")).firstMatch
                .waitForExistence(timeout: 5),
            "Saved location chip must appear after selecting a location"
        )
    }

    func testSearchClearButtonRemovesResults() {
        goToWeather()

        let searchField = app.searchFields["Search locations\u{2026}"]
        waitFor(searchField)
        searchField.tap()
        searchField.typeText(testCity)

        // Wait for results to appear
        let results = weatherSearchResults()
        waitFor(results.firstMatch, timeout: weatherSearchTimeout)

        searchField.clearAndTypeText("")

        // The location-result dropdown rows show "City, Region, Country" with
        // commas. After clearing search, those should not be visible.
        let dropdownResult = app.buttons.matching(
            NSPredicate(format: "label CONTAINS '\(testCityFull)' AND label CONTAINS ','")
        ).firstMatch
        XCTAssertFalse(
            dropdownResult.waitForExistence(timeout: 3),
            "Search results dropdown should disappear after clearing"
        )
    }

    func testForecastShowsDailyRows() {
        goToWeather()

        let searchField = app.searchFields["Search locations\u{2026}"]
        waitFor(searchField)
        searchField.tap()
        searchField.typeText(testCity)

        let firstResult = weatherSearchResults().firstMatch
        waitFor(firstResult, timeout: weatherSearchTimeout)
        firstResult.tap()

        XCTAssertTrue(
            app.descendants(matching: .any)["weather_current_card"].waitForExistence(timeout: 20),
            "Current weather card must appear before checking forecast rows"
        )
        let list = app.collectionViews.firstMatch
        for _ in 0..<4 where !app.staticTexts["10-Day Forecast"].exists {
            list.swipeUp()
        }
        // 10-day forecast header
        XCTAssertTrue(
            app.staticTexts["10-Day Forecast"].waitForExistence(timeout: 20),
            "10-Day Forecast section header must appear"
        )
    }

    func testCelsiusPreferenceAppliesToCurrentFeelsLikeAndForecast() {
        goToWeather()

        let searchField = app.searchFields["Search locations\u{2026}"]
        waitFor(searchField)
        searchField.tap()
        searchField.typeText(testCity)

        let firstResult = weatherSearchResults().firstMatch
        waitFor(firstResult, timeout: weatherSearchTimeout)
        firstResult.tap()

        let currentCard = app.descendants(matching: .any)["weather_current_card"]
        XCTAssertTrue(currentCard.waitForExistence(timeout: 20))
        assertCelsiusValue(identifier: "weather_current_temperature")
        assertCelsiusValue(identifier: "weather_feels_like_temperature")

        let list = app.collectionViews.firstMatch
        for _ in 0..<4 where !app.staticTexts["10-Day Forecast"].exists {
            list.swipeUp()
        }
        XCTAssertTrue(app.staticTexts["10-Day Forecast"].waitForExistence(timeout: 20))
        assertCelsiusValue(identifierPrefix: "weather_forecast_high_")
        assertCelsiusValue(identifierPrefix: "weather_forecast_low_")
    }

    func testWeatherAlertsButtonAppearsWithForecast() {
        goToWeather()

        let searchField = app.searchFields["Search locations\u{2026}"]
        waitFor(searchField)
        searchField.tap()
        searchField.typeText(testCity)

        let firstResult = weatherSearchResults().firstMatch
        waitFor(firstResult, timeout: weatherSearchTimeout)
        firstResult.tap()

        XCTAssertTrue(
            app.descendants(matching: .any)["weather_current_card"].waitForExistence(timeout: 20),
            "Current weather card must appear before checking toolbar actions"
        )
        // Alerts toolbar button appears once forecast is loaded
        let alertsButton = app.buttons["weather_alerts_button"].firstMatch.exists
            ? app.buttons["weather_alerts_button"].firstMatch
            : app.buttons.matching(NSPredicate(format: "label == 'Alerts' OR label CONTAINS 'bell'")).firstMatch
        XCTAssertTrue(
            alertsButton.waitForExistence(timeout: 20),
            "Alerts button must appear in toolbar after forecast loads"
        )
    }

    private func goToWeather() {
        goToHomeAction("Weather")
        XCTAssertTrue(app.navigationBars["Weather"].waitForExistence(timeout: 8))
    }

    private func weatherSearchResults() -> XCUIElementQuery {
        app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH 'weather_search_result_' AND label CONTAINS '\(testCityFull)'")
        )
    }

    private func assertCelsiusValue(identifier: String) {
        let value = app.descendants(matching: .any)[identifier]
        XCTAssertTrue(value.waitForExistence(timeout: 5))
        XCTAssertTrue(value.label.hasSuffix("°C"), "\(identifier) should use Celsius")
    }

    private func assertCelsiusValue(identifierPrefix: String) {
        let value = app.descendants(matching: .any).matching(
            NSPredicate(format: "identifier BEGINSWITH %@", identifierPrefix)
        ).firstMatch
        XCTAssertTrue(value.waitForExistence(timeout: 5))
        XCTAssertTrue(value.label.hasSuffix("°C"), "\(identifierPrefix) values should use Celsius")
    }
}

#endif
