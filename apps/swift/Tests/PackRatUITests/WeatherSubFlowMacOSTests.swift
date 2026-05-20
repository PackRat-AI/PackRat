import XCTest

#if os(macOS)
/// macOS variant of `WeatherSubFlowTests`. Alert Preferences is reachable
/// from the Weather content-column toolbar via a NavigationLink.
final class WeatherSubFlowMacOSTests: AppUITestCase {

    func testAlertPreferencesReachableFromWeatherToolbar() {
        goToSidebar("Weather")

        // The Alert Preferences toolbar item is a NavigationLink with a slider
        // label. macOS surfaces the link as a button with the same a11y label.
        let prefsButton = app.buttons["Alert Preferences"]
        guard prefsButton.waitForExistence(timeout: 8) else {
            XCTFail("Alert Preferences button must be in Weather toolbar")
            return
        }
        prefsButton.click()

        XCTAssertTrue(
            app.staticTexts["Alert Preferences"].waitForExistence(timeout: 5),
            "Alert Preferences screen must appear"
        )
    }

    func testAlertPreferencesShowsToggles() {
        goToSidebar("Weather")
        let prefsButton = app.buttons["Alert Preferences"]
        guard prefsButton.waitForExistence(timeout: 8) else { return }
        prefsButton.click()

        // Master toggle — on macOS it's a checkbox.
        XCTAssertTrue(
            app.switches["Weather Notifications"].waitForExistence(timeout: 5)
            || app.checkBoxes["Weather Notifications"].waitForExistence(timeout: 2),
            "Weather Notifications toggle must be visible"
        )

        let alertTypes = ["Severe Storms", "Tornado Warnings", "Flood Alerts", "Fire Danger"]
        for type in alertTypes {
            XCTAssertTrue(
                app.switches[type].waitForExistence(timeout: 3)
                || app.checkBoxes[type].waitForExistence(timeout: 2),
                "Alert type toggle '\(type)' must be visible"
            )
        }
    }

    func testToggleAlertPreference() {
        goToSidebar("Weather")
        let prefsButton = app.buttons["Alert Preferences"]
        guard prefsButton.waitForExistence(timeout: 8) else { return }
        prefsButton.click()

        // Ensure master toggle is on.
        let masterSwitch = app.switches["Weather Notifications"]
        let masterCheck = app.checkBoxes["Weather Notifications"]
        let master: XCUIElement = masterSwitch.exists ? masterSwitch : masterCheck
        if master.waitForExistence(timeout: 5), master.value as? String == "0" {
            master.click()
        }

        let highWindsSwitch = app.switches["High Winds"]
        let highWindsCheck = app.checkBoxes["High Winds"]
        let highWinds: XCUIElement = highWindsSwitch.exists ? highWindsSwitch : highWindsCheck
        guard highWinds.waitForExistence(timeout: 5) else { return }
        XCTAssertTrue(
            highWinds.isEnabled,
            "High Winds toggle must be enabled — Weather Notifications must be on"
        )

        let initialValue = highWinds.value as? String
        highWinds.click()
        let newValue = highWinds.value as? String
        XCTAssertNotEqual(initialValue, newValue, "Toggle value should change after click")

        // Restore for idempotency.
        highWinds.click()
    }
}
#endif
