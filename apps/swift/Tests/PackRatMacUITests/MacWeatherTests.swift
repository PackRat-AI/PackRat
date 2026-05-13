import XCTest

final class MacWeatherTests: MacUITestCase {
    func testLocationSearchAndForecastLoadOnMac() {
        goToSidebar("Weather")

        let searchField = textInput(
            "Search locations...",
            alternateLabels: ["Search locations…", "weather_location_search"]
        )
        waitFor(searchField, timeout: 10).tap()
        searchField.typeText("Denver")

        let result = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Denver'")).firstMatch
        waitFor(result, timeout: 10).tap()

        XCTAssertTrue(
            app.staticTexts["10-Day Forecast"].waitForExistence(timeout: 20)
            || app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Forecast'")).firstMatch.waitForExistence(timeout: 20),
            "Forecast content must load after selecting a Denver location"
        )
    }

    func testAlertPreferencesToolbarFlowOnMac() {
        goToSidebar("Weather")

        let preferences = app.buttons["weather_alert_preferences_button"].firstMatch
        if preferences.waitForExistence(timeout: 3) {
            preferences.tap()
        } else {
            openOverflowMenu()
            waitFor(app.buttons["Alert Preferences"], timeout: 8).tap()
        }

        XCTAssertTrue(toggleControl("Weather Notifications", alternateLabels: ["weather_notifications_toggle"]).waitForExistence(timeout: 5))
        let highWinds = waitFor(toggleControl("High Winds", alternateLabels: ["high_winds_toggle"]), timeout: 5)
        highWinds.tap()
        highWinds.tap()
    }

    private func openOverflowMenu() {
        let overflow = app.buttons["OverflowBarButtonItem"]
        if overflow.waitForExistence(timeout: 2) {
            overflow.tap()
            return
        }
        waitFor(app.buttons.matching(NSPredicate(format: "identifier == 'OverflowBarButtonItem'")).firstMatch).tap()
    }
}
