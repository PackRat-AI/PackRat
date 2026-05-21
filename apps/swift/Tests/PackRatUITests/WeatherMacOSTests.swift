import XCTest

#if os(macOS)
/// macOS variant of `WeatherTests`. Weather is the sidebar's "Weather" entry;
/// the search field, forecast cards, and toolbar buttons all live in the
/// content column.
final class WeatherMacOSTests: AppUITestCase {
    private let testCity = "Denver"
    private let testCityFull = "Denver"

    func testLocationSearchReturnsResults() {
        goToSidebar("Weather")

        let searchField = app.textFields["Search locations\u{2026}"]
        waitFor(searchField, message: "Weather search field must appear")
        searchField.click()
        searchField.typeText(testCity)

        let results = app.buttons.matching(NSPredicate(format: "label CONTAINS '\(testCityFull)'"))
        XCTAssertTrue(
            results.firstMatch.waitForExistence(timeout: 10),
            "Search results for '\(testCity)' must appear"
        )
    }

    func testSelectLocationLoadsForecast() {
        goToSidebar("Weather")

        let searchField = app.textFields["Search locations\u{2026}"]
        waitFor(searchField)
        searchField.click()
        searchField.typeText(testCity)

        let firstResult = app.buttons.matching(
            NSPredicate(format: "label CONTAINS '\(testCityFull)'")
        ).firstMatch
        waitFor(firstResult, timeout: 10)
        firstResult.click()

        let tempLabel = app.staticTexts.matching(
            NSPredicate(format: "label MATCHES '.*\\d+°.*' OR label CONTAINS '°'")
        ).firstMatch
        XCTAssertTrue(
            tempLabel.waitForExistence(timeout: 20),
            "Temperature reading must appear after selecting a location"
        )
    }

    func testSavedLocationAppearsAsChip() {
        goToSidebar("Weather")

        let searchField = app.textFields["Search locations\u{2026}"]
        waitFor(searchField)
        searchField.click()
        searchField.typeText(testCity)

        let firstResult = app.buttons.matching(
            NSPredicate(format: "label CONTAINS '\(testCityFull)'")
        ).firstMatch
        waitFor(firstResult, timeout: 10)
        firstResult.click()

        let clearButton = app.buttons.matching(
            NSPredicate(format: "label CONTAINS 'xmark' OR label == 'Clear'")
        ).firstMatch
        if clearButton.exists { clearButton.click() }

        XCTAssertTrue(
            app.staticTexts.matching(NSPredicate(format: "label CONTAINS '\(testCityFull)'")).firstMatch
                .waitForExistence(timeout: 5),
            "Saved location chip must appear after selecting a location"
        )
    }

    func testSearchClearButtonRemovesResults() {
        goToSidebar("Weather")

        let searchField = app.textFields["Search locations\u{2026}"]
        waitFor(searchField)
        searchField.click()
        searchField.typeText(testCity)

        let results = app.buttons.matching(NSPredicate(format: "label CONTAINS '\(testCityFull)'"))
        waitFor(results.firstMatch, timeout: 10)

        let clear = app.buttons["weather_search_clear"]
        waitFor(clear, timeout: 5)
        clear.click()

        let dropdownResult = app.buttons.matching(
            NSPredicate(format: "label CONTAINS '\(testCityFull)' AND label CONTAINS ','")
        ).firstMatch
        XCTAssertFalse(
            dropdownResult.waitForExistence(timeout: 3),
            "Search results dropdown should disappear after clearing"
        )
    }

    func testForecastShowsDailyRows() {
        goToSidebar("Weather")

        let searchField = app.textFields["Search locations\u{2026}"]
        waitFor(searchField)
        searchField.click()
        searchField.typeText(testCity)

        let firstResult = app.buttons.matching(
            NSPredicate(format: "label CONTAINS '\(testCityFull)'")
        ).firstMatch
        waitFor(firstResult, timeout: 10)
        firstResult.click()

        XCTAssertTrue(
            app.staticTexts["10-Day Forecast"].waitForExistence(timeout: 20),
            "10-Day Forecast section header must appear"
        )
    }

    func testWeatherAlertsButtonAppearsWithForecast() {
        goToSidebar("Weather")

        let searchField = app.textFields["Search locations\u{2026}"]
        waitFor(searchField)
        searchField.click()
        searchField.typeText(testCity)

        let firstResult = app.buttons.matching(
            NSPredicate(format: "label CONTAINS '\(testCityFull)'")
        ).firstMatch
        waitFor(firstResult, timeout: 10)
        firstResult.click()

        let alertsButton = app.buttons.matching(
            NSPredicate(format: "label == 'Alerts' OR label CONTAINS 'bell'")
        ).firstMatch
        XCTAssertTrue(
            alertsButton.waitForExistence(timeout: 20),
            "Alerts button must appear in toolbar after forecast loads"
        )
    }
}
#endif
