import XCTest

#if os(macOS)
/// macOS variant of `WeatherTests`. Weather is the sidebar's "Weather" entry;
/// the search field, forecast cards, and toolbar buttons all live in the
/// content column.
final class WeatherMacOSTests: AppUITestCase {
    override var additionalLaunchArguments: [String] { ["--ui-test-fixtures"] }

    private let testCity = "Denver"
    private let testCityFull = "Denver"

    func testLocationSearchReturnsResults() {
        goToSidebar("Weather")

        let searchField = app.searchFields["Search locations\u{2026}"]
        waitFor(searchField, message: "Weather search field must appear")
        searchField.click()
        searchField.typeText(testCity)

        let results = weatherSearchResults()
        XCTAssertTrue(
            results.firstMatch.waitForExistence(timeout: 10),
            "Search results for '\(testCity)' must appear"
        )
    }

    func testSelectLocationLoadsForecast() {
        goToSidebar("Weather")

        let searchField = app.searchFields["Search locations\u{2026}"]
        waitFor(searchField)
        searchField.click()
        searchField.typeText(testCity)

        let firstResult = weatherSearchResults().firstMatch
        waitFor(firstResult, timeout: 10)
        firstResult.click()

        let tempLabel = app.descendants(matching: .any)["weather_current_card"]
        XCTAssertTrue(
            tempLabel.waitForExistence(timeout: 20),
            "Temperature reading must appear after selecting a location"
        )
    }

    func testSavedLocationAppearsAsChip() {
        goToSidebar("Weather")

        let searchField = app.searchFields["Search locations\u{2026}"]
        waitFor(searchField)
        searchField.click()
        searchField.typeText(testCity)

        let firstResult = weatherSearchResults().firstMatch
        waitFor(firstResult, timeout: 10)
        firstResult.click()

        XCTAssertTrue(
            app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH 'weather_saved_location_'")).firstMatch
                .waitForExistence(timeout: 10),
            "Saved location chip must appear after selecting a location"
        )
    }

    func testSearchClearButtonRemovesResults() {
        goToSidebar("Weather")

        let searchField = app.searchFields["Search locations\u{2026}"]
        waitFor(searchField)
        searchField.click()
        searchField.typeText(testCity)

        let results = weatherSearchResults()
        waitFor(results.firstMatch, timeout: 10)

        searchField.clearAndTypeText("")

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

        let searchField = app.searchFields["Search locations\u{2026}"]
        waitFor(searchField)
        searchField.click()
        searchField.typeText(testCity)

        let firstResult = weatherSearchResults().firstMatch
        waitFor(firstResult, timeout: 10)
        firstResult.click()

        XCTAssertTrue(
            app.staticTexts["10-Day Forecast"].waitForExistence(timeout: 20),
            "10-Day Forecast section header must appear"
        )
    }

    func testWeatherAlertsButtonAppearsWithForecast() {
        goToSidebar("Weather")

        let searchField = app.searchFields["Search locations\u{2026}"]
        waitFor(searchField)
        searchField.click()
        searchField.typeText(testCity)

        let firstResult = weatherSearchResults().firstMatch
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

    private func weatherSearchResults() -> XCUIElementQuery {
        app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH 'weather_search_result_' AND label CONTAINS '\(testCityFull)'")
        )
    }
}
#endif
