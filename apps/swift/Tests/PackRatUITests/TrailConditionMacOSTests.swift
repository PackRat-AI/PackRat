import XCTest

#if os(macOS)
/// macOS variant of `TrailConditionTests`. Trail Conditions is the sidebar's
/// "Trail Conditions" entry; the submit form opens as a sheet from the content
/// column toolbar.
final class TrailConditionMacOSTests: AppUITestCase {
    private var createdReportTrail: String?

    override func tearDownWithError() throws {
        if let trail = createdReportTrail {
            cleanupReport(forTrail: trail)
        }
        createdReportTrail = nil
        try super.tearDownWithError()
    }

    func testTrailConditionsSidebarReachable() {
        goToSidebar("Trail Conditions")
        XCTAssertTrue(
            app.staticTexts["Trail Conditions"].waitForExistence(timeout: 8),
            "Trail Conditions header must appear"
        )
    }

    func testSubmitReportButtonOpensForm() {
        goToSidebar("Trail Conditions")
        let submitButton = app.buttons["Submit Report"].firstMatch
        waitFor(submitButton)
        submitButton.click()

        XCTAssertTrue(
            app.textFields["Trail Name"].waitForExistence(timeout: 5),
            "Submit Report form must appear with Trail Name field"
        )
        XCTAssertTrue(app.buttons["Cancel"].exists)
        app.buttons["Cancel"].click()
    }

    func testSubmitTrailReport() {
        let trailName = uniqueName("E2E Trail")
        createdReportTrail = trailName

        goToSidebar("Trail Conditions")
        waitFor(app.buttons["Submit Report"].firstMatch).click()

        let nameField = app.textFields["Trail Name"]
        waitFor(nameField)
        nameField.click()
        nameField.typeText(trailName)

        let regionField = app.textFields["Region / Area (optional)"]
        if regionField.waitForExistence(timeout: 3) {
            regionField.click()
            regionField.typeText("Test Region")
        }

        // Pick a non-null surface — the API rejects null surface with a 400.
        let surfacePicker = app.popUpButtons.matching(
            NSPredicate(format: "label CONTAINS 'Surface' OR label CONTAINS 'specified'")
        ).firstMatch
        if surfacePicker.waitForExistence(timeout: 3) {
            surfacePicker.click()
            let dirt = app.menuItems["Dirt"].firstMatch
            if dirt.waitForExistence(timeout: 3) { dirt.click() }
        } else {
            // Fall back to button-style picker if popUpButton isn't surfaced.
            let pickerButton = app.buttons.matching(
                NSPredicate(format: "label CONTAINS 'Surface' OR label CONTAINS 'specified'")
            ).firstMatch
            if pickerButton.waitForExistence(timeout: 3) {
                pickerButton.click()
                let dirt = app.buttons["Dirt"].firstMatch
                if dirt.waitForExistence(timeout: 3) { dirt.click() }
            }
        }

        app.buttons["Submit"].click()

        // Wait for the form sheet to dismiss.
        waitFor(app.buttons["Submit Report"].firstMatch, timeout: 20)

        let target = app.staticTexts[trailName]
        XCTAssertTrue(
            target.waitForExistence(timeout: 10),
            "Submitted report '\(trailName)' must appear in list"
        )
    }

    func testReportFormHasHazardToggles() {
        goToSidebar("Trail Conditions")
        waitFor(app.buttons["Submit Report"].firstMatch).click()

        // On macOS Toggle is rendered as a checkbox; queryable via `switches`
        // (XCUI maps both UISwitches and NSButton checkboxes there) or
        // `checkBoxes`. Try switches first, then checkboxes.
        let hazardLabels = ["Downed trees", "Muddy sections", "Ice"]
        for hazard in hazardLabels {
            let asSwitch = app.switches[hazard]
            let asCheck = app.checkBoxes[hazard]
            XCTAssertTrue(
                asSwitch.waitForExistence(timeout: 3) || asCheck.waitForExistence(timeout: 2),
                "Hazard toggle '\(hazard)' must exist"
            )
        }
        app.buttons["Cancel"].click()
    }

    func testReportFormSubmitDisabledWithoutTrailName() {
        goToSidebar("Trail Conditions")
        waitFor(app.buttons["Submit Report"].firstMatch).click()

        let submit = app.buttons["Submit"]
        waitFor(submit)
        XCTAssertFalse(submit.isEnabled, "Submit must be disabled without trail name")

        app.buttons["Cancel"].click()
    }

    // MARK: - Helpers

    private func cleanupReport(forTrail trail: String) {
        goToSidebar("Trail Conditions")
        let cell = app.staticTexts[trail]
        guard cell.waitForExistence(timeout: 5) else { return }
        cell.rightClick()
        let deleteButton = app.buttons["Delete"]
        guard deleteButton.waitForExistence(timeout: 3) else { return }
        deleteButton.click()
    }
}
#endif
