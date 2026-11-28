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

        let searchField = app.searchFields["Search for a city or place"]
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

        let searchField = app.searchFields["Search for a city or place"]
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

    func testSavedLocationAppearsAsCard() {
        goToSidebar("Weather")

        let searchField = app.searchFields["Search for a city or place"]
        waitFor(searchField)
        searchField.click()
        searchField.typeText(testCity)

        // Opening a result only previews it; saving is the row's own button.
        let saveButton = app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH 'weather_search_save_' AND label CONTAINS '\(testCityFull)'")
        ).firstMatch
        waitFor(saveButton, timeout: 10)
        saveButton.click()
        // The saved list sits behind the search results until search closes.
        app.typeKey(XCUIKeyboardKey.escape.rawValue, modifierFlags: [])
        app.typeKey(XCUIKeyboardKey.escape.rawValue, modifierFlags: [])

        XCTAssertTrue(
            app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH 'weather_saved_location_'")).firstMatch
                .waitForExistence(timeout: 10),
            "A selected location must appear on the Weather list"
        )
    }

    func testSearchClearButtonRemovesResults() {
        goToSidebar("Weather")

        let searchField = app.searchFields["Search for a city or place"]
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

        let searchField = app.searchFields["Search for a city or place"]
        waitFor(searchField)
        searchField.click()
        searchField.typeText(testCity)

        let firstResult = weatherSearchResults().firstMatch
        waitFor(firstResult, timeout: 10)
        firstResult.click()

        XCTAssertTrue(
            app.staticTexts["10-DAY FORECAST"].waitForExistence(timeout: 20),
            "10-day forecast section header must appear"
        )
    }

    func testActiveAlertsAppearWithForecast() {
        goToSidebar("Weather")

        let searchField = app.searchFields["Search for a city or place"]
        waitFor(searchField)
        searchField.click()
        searchField.typeText(testCity)

        let firstResult = weatherSearchResults().firstMatch
        waitFor(firstResult, timeout: 10)
        firstResult.click()

        // Alerts sit inline on the forecast; the fixture forecast carries one.
        XCTAssertTrue(
            app.descendants(matching: .any)["forecast_alert_section"].waitForExistence(timeout: 20),
            "Active alerts must appear on the forecast"
        )
    }

    private func weatherSearchResults() -> XCUIElementQuery {
        app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH 'weather_search_result_' AND label CONTAINS '\(testCityFull)'")
        )
    }
}
#endif
