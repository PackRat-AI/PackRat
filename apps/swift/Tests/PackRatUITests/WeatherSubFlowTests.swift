import XCTest

/// Sub-flows reachable from Weather: Alert Preferences, Alerts sheet.
final class WeatherSubFlowTests: AppUITestCase {

    func testAlertPreferencesReachableFromWeatherToolbar() {
        goToTab("Weather")

        // The Alert Preferences icon is the slider control in the toolbar
        // Alert Preferences is in .secondaryAction placement, so it collapses
        // into the nav-bar overflow menu on iPhone. Open the menu first if needed.
        let prefsButton = app.buttons["Alert Preferences"]
        if !prefsButton.waitForExistence(timeout: 2) {
            let overflow = app.navigationBars.firstMatch.buttons.matching(
                NSPredicate(format: "label == 'More' OR label CONTAINS 'ellipsis'")
            ).firstMatch
            if overflow.waitForExistence(timeout: 5) { overflow.tap() }
        }
        guard prefsButton.waitForExistence(timeout: 8) else {
            XCTFail("Alert Preferences button must be in Weather toolbar")
            return
        }
        prefsButton.tap()

        XCTAssertTrue(
            app.navigationBars["Alert Preferences"].waitForExistence(timeout: 5),
            "Alert Preferences screen must appear"
        )
    }

    func testAlertPreferencesShowsToggles() {
        goToTab("Weather")
        // Alert Preferences is in .secondaryAction placement, so it collapses
        // into the nav-bar overflow menu on iPhone. Open the menu first if needed.
        let prefsButton = app.buttons["Alert Preferences"]
        if !prefsButton.waitForExistence(timeout: 2) {
            let overflow = app.navigationBars.firstMatch.buttons.matching(
                NSPredicate(format: "label == 'More' OR label CONTAINS 'ellipsis'")
            ).firstMatch
            if overflow.waitForExistence(timeout: 5) { overflow.tap() }
        }
        guard prefsButton.waitForExistence(timeout: 8) else { return }
        prefsButton.tap()

        // Master Weather Notifications toggle
        XCTAssertTrue(
            app.switches["Weather Notifications"].waitForExistence(timeout: 5),
            "Weather Notifications toggle must be visible"
        )

        // Per-type toggles
        let alertTypes = ["Severe Storms", "Tornado Warnings", "Flood Alerts", "Fire Danger"]
        for type in alertTypes {
            XCTAssertTrue(
                app.switches[type].waitForExistence(timeout: 3),
                "Alert type toggle '\(type)' must be visible"
            )
        }
    }

    func testToggleAlertPreference() {
        goToTab("Weather")
        // Alert Preferences is in .secondaryAction placement, so it collapses
        // into the nav-bar overflow menu on iPhone. Open the menu first if needed.
        let prefsButton = app.buttons["Alert Preferences"]
        if !prefsButton.waitForExistence(timeout: 2) {
            let overflow = app.navigationBars.firstMatch.buttons.matching(
                NSPredicate(format: "label == 'More' OR label CONTAINS 'ellipsis'")
            ).firstMatch
            if overflow.waitForExistence(timeout: 5) { overflow.tap() }
        }
        guard prefsButton.waitForExistence(timeout: 8) else { return }
        prefsButton.tap()

        // High Winds defaults to off — toggle it on
        let highWinds = app.switches["High Winds"]
        guard highWinds.waitForExistence(timeout: 5) else { return }
        let initialValue = highWinds.value as? String

        highWinds.tap()

        // Value should flip
        let newValue = highWinds.value as? String
        XCTAssertNotEqual(initialValue, newValue, "Toggle value should change after tap")

        // Restore for idempotency
        highWinds.tap()
    }
}
