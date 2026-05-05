import XCTest

/// E2E tests for Trail Conditions: submitting reports, viewing list, viewing detail.
final class TrailConditionTests: AppUITestCase {
    private var createdReportTrail: String?

    override func tearDownWithError() throws {
        if let trail = createdReportTrail {
            cleanupReport(forTrail: trail)
        }
        createdReportTrail = nil
        try super.tearDownWithError()
    }

    func testTrailConditionsTabReachable() {
        goToTab("Trail Conditions")
        XCTAssertTrue(
            app.navigationBars["Trail Conditions"].waitForExistence(timeout: 8)
        )
    }

    func testSubmitReportButtonOpensForm() {
        goToTab("Trail Conditions")
        let submitButton = app.buttons["Submit Report"].firstMatch
        waitFor(submitButton)
        submitButton.tap()

        XCTAssertTrue(
            app.textFields["Trail Name"].waitForExistence(timeout: 5),
            "Submit Report form must appear with Trail Name field"
        )
        XCTAssertTrue(app.buttons["Cancel"].exists)
        app.buttons["Cancel"].tap()
    }

    func testSubmitTrailReport() {
        let trailName = uniqueName("E2E Trail")
        createdReportTrail = trailName

        goToTab("Trail Conditions")
        waitFor(app.buttons["Submit Report"].firstMatch).tap()

        let nameField = app.textFields["Trail Name"]
        waitFor(nameField)
        nameField.tap()
        nameField.typeText(trailName)

        // Add region
        let regionField = app.textFields["Region / Area (optional)"]
        if regionField.waitForExistence(timeout: 3) {
            regionField.tap()
            regionField.typeText("Test Region")
        }

        app.buttons["Submit"].tap()

        // Report should appear in list
        XCTAssertTrue(
            app.staticTexts[trailName].waitForExistence(timeout: 20),
            "Submitted report '\(trailName)' must appear in list"
        )
    }

    func testReportFormHasHazardToggles() {
        goToTab("Trail Conditions")
        waitFor(app.buttons["Submit Report"].firstMatch).tap()

        // Hazard section toggles
        let hazardLabels = ["Downed trees", "Muddy sections", "Ice"]
        for hazard in hazardLabels {
            XCTAssertTrue(
                app.switches[hazard].waitForExistence(timeout: 5),
                "Hazard toggle '\(hazard)' must exist"
            )
        }
        app.buttons["Cancel"].tap()
    }

    func testReportFormSubmitDisabledWithoutTrailName() {
        goToTab("Trail Conditions")
        waitFor(app.buttons["Submit Report"].firstMatch).tap()

        let submit = app.buttons["Submit"]
        waitFor(submit)
        XCTAssertFalse(submit.isEnabled, "Submit must be disabled without trail name")

        app.buttons["Cancel"].tap()
    }

    // MARK: - Helpers

    private func cleanupReport(forTrail trail: String) {
        goToTab("Trail Conditions")
        let cell = app.cells.containing(.staticText, identifier: trail).firstMatch
        guard cell.waitForExistence(timeout: 5) else { return }
        cell.press(forDuration: 1.2)
        let deleteButton = app.buttons["Delete"]
        guard deleteButton.waitForExistence(timeout: 3) else { return }
        deleteButton.tap()
    }
}
