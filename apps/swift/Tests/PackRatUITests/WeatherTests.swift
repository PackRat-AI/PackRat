import XCTest

/// End-to-end tests for Weather: location search, forecast display, saved locations.
final class WeatherTests: AppUITestCase {
    private let testCity = "Denver"
    private let testCityFull = "Denver"  // fragment to match in search results

    // MARK: - Search

    func testLocationSearchReturnsResults() {
        goToTab("Weather")

        let searchField = app.textFields["Search locations\u{2026}"]
        waitFor(searchField, message: "Weather search field must appear")
        searchField.tap()
        searchField.typeText(testCity)

        // Search results should appear (they load from the WeatherAPI)
        let results = app.buttons.matching(NSPredicate(format: "label CONTAINS '\(testCityFull)'"))
        XCTAssertTrue(
            results.firstMatch.waitForExistence(timeout: 10),
            "Search results for '\(testCity)' must appear"
        )
    }

    func testSelectLocationLoadsForecast() {
        goToTab("Weather")

        let searchField = app.textFields["Search locations\u{2026}"]
        waitFor(searchField)
        searchField.tap()
        searchField.typeText(testCity)

        // Wait for results and tap the first match
        let firstResult = app.buttons.matching(
            NSPredicate(format: "label CONTAINS '\(testCityFull)'")
        ).firstMatch
        waitFor(firstResult, timeout: 10)
        firstResult.tap()

        // Forecast card: current temperature shows a °
        let tempLabel = app.staticTexts.matching(
            NSPredicate(format: "label MATCHES '.*\\d+°.*' OR label CONTAINS '°'")
        ).firstMatch
        XCTAssertTrue(
            tempLabel.waitForExistence(timeout: 20),
            "Temperature reading must appear after selecting a location"
        )
    }

    func testSavedLocationAppearsAsChip() {
        goToTab("Weather")

        let searchField = app.textFields["Search locations\u{2026}"]
        waitFor(searchField)
        searchField.tap()
        searchField.typeText(testCity)

        let firstResult = app.buttons.matching(
            NSPredicate(format: "label CONTAINS '\(testCityFull)'")
        ).firstMatch
        waitFor(firstResult, timeout: 10)
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
        goToTab("Weather")

        let searchField = app.textFields["Search locations\u{2026}"]
        waitFor(searchField)
        searchField.tap()
        searchField.typeText(testCity)

        // Wait for results to appear
        let results = app.buttons.matching(NSPredicate(format: "label CONTAINS '\(testCityFull)'"))
        waitFor(results.firstMatch, timeout: 10)

        // Clear via the field's native value-clearing rather than hunting for
        // the xmark.circle.fill button (which has no stable identifier).
        searchField.tap()
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
        goToTab("Weather")

        let searchField = app.textFields["Search locations\u{2026}"]
        waitFor(searchField)
        searchField.tap()
        searchField.typeText(testCity)

        let firstResult = app.buttons.matching(
            NSPredicate(format: "label CONTAINS '\(testCityFull)'")
        ).firstMatch
        waitFor(firstResult, timeout: 10)
        firstResult.tap()

        // 10-day forecast header
        XCTAssertTrue(
            app.staticTexts["10-Day Forecast"].waitForExistence(timeout: 20),
            "10-Day Forecast section header must appear"
        )
    }

    func testWeatherAlertsButtonAppearsWithForecast() {
        goToTab("Weather")

        let searchField = app.textFields["Search locations\u{2026}"]
        waitFor(searchField)
        searchField.tap()
        searchField.typeText(testCity)

        let firstResult = app.buttons.matching(
            NSPredicate(format: "label CONTAINS '\(testCityFull)'")
        ).firstMatch
        waitFor(firstResult, timeout: 10)
        firstResult.tap()

        // Alerts toolbar button appears once forecast is loaded
        let alertsButton = app.buttons.matching(
            NSPredicate(format: "label == 'Alerts' OR label CONTAINS 'bell'")
        ).firstMatch
        XCTAssertTrue(
            alertsButton.waitForExistence(timeout: 20),
            "Alerts button must appear in toolbar after forecast loads"
        )
    }
}
