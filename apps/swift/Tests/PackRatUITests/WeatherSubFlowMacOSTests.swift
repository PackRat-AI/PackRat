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
            app.staticTexts["Alert Preferences"].waitForExistence(timeout: 5)
            || app.checkBoxes["Weather Notifications"].waitForExistence(timeout: 2),
            "Alert Preferences screen must appear"
        )
    }

    func testAlertPreferencesShowsToggles() {
        goToSidebar("Weather")
        let prefsButton = app.buttons["Alert Preferences"]
        guard prefsButton.waitForExistence(timeout: 8) else { return }
        prefsButton.click()

        // Master toggle — on macOS it's a checkbox. Query the stable
        // automation identifier first, since SwiftUI can expose Form toggle
        // labels differently from the control itself.
        XCTAssertTrue(
            toggle(named: "weather_alert_notifications_toggle", label: "Weather Notifications").waitForExistence(timeout: 5),
            "Weather Notifications toggle must be visible"
        )

        let alertTypes = [
            ("weather_alert_severe_storms_toggle", "Severe Storms"),
            ("weather_alert_tornado_warnings_toggle", "Tornado Warnings"),
            ("weather_alert_flood_alerts_toggle", "Flood Alerts"),
            ("weather_alert_fire_danger_toggle", "Fire Danger")
        ]
        for type in alertTypes {
            XCTAssertTrue(
                toggle(named: type.0, label: type.1).waitForExistence(timeout: 3),
                "Alert type toggle '\(type.1)' must be visible"
            )
        }
    }

    private func toggle(named identifier: String, label: String) -> XCUIElement {
        let identifierSwitch = app.switches[identifier]
        if identifierSwitch.exists { return identifierSwitch }
        let identifierCheck = app.checkBoxes[identifier]
        if identifierCheck.exists { return identifierCheck }
        let labelSwitch = app.switches[label]
        if labelSwitch.exists { return labelSwitch }
        return app.checkBoxes[label]
    }

    func testToggleAlertPreference() {
        goToSidebar("Weather")
        let prefsButton = app.buttons["Alert Preferences"]
        guard prefsButton.waitForExistence(timeout: 8) else { return }
        prefsButton.click()

        // Ensure master toggle is on.
        let masterSwitch = app.switches["weather_alert_notifications_toggle"]
        let masterCheck = app.checkBoxes["weather_alert_notifications_toggle"]
        let master: XCUIElement = masterSwitch.exists ? masterSwitch : masterCheck
        if master.waitForExistence(timeout: 5), master.isOff {
            master.clickCheckboxControl()
        }

        let highWindsSwitch = app.switches["weather_alert_high_winds_toggle"]
        let highWindsCheck = app.checkBoxes["weather_alert_high_winds_toggle"]
        let highWinds: XCUIElement = highWindsSwitch.exists ? highWindsSwitch : highWindsCheck
        guard highWinds.waitForExistence(timeout: 5) else { return }
        XCTAssertTrue(
            highWinds.isEnabled,
            "High Winds toggle must be enabled — Weather Notifications must be on"
        )

        let originalValue = highWinds.normalizedValue
        highWinds.clickCheckboxControl()
        let changed = highWinds.waitForValueNotEqual(to: originalValue, timeout: 3)
        XCTAssertTrue(changed, "Toggle value should change after click")

        // Restore for idempotency.
        highWinds.clickCheckboxControl()
    }
}
#endif

private extension XCUIElement {
    var normalizedValue: String? {
        guard let value else { return nil }
        return String(describing: value)
    }

    var isOff: Bool {
        guard let normalizedValue else { return false }
        return normalizedValue == "off" || normalizedValue == "0" || normalizedValue == "false"
    }

    func clickCheckboxControl() {
        #if os(macOS)
        coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5)).click()
        #else
        tap()
        #endif
    }

    func waitForValueNotEqual(to originalValue: String?, timeout: TimeInterval) -> Bool {
        let predicate = NSPredicate { element, _ in
            guard let element = element as? XCUIElement else { return false }
            return element.normalizedValue != originalValue
        }
        return XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: predicate, object: self)], timeout: timeout) == .completed
    }
}
