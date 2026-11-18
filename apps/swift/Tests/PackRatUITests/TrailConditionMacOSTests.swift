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
            app.buttons["trail_report_choose_trail"].waitForExistence(timeout: 5),
            "Submit Report form must appear with trail field"
        )
        XCTAssertTrue(app.buttons["Cancel"].exists)
        app.buttons["Cancel"].click()
    }

    func testSubmitTrailReport() {
        goToSidebar("Trail Conditions")
        waitFor(app.buttons["Submit Report"].firstMatch).click()

        // The trail comes from the picker, not free text, so the report is
        // filed against whichever real trail the search returns first.
        waitFor(app.buttons["trail_report_choose_trail"]).click()
        let pickerSearch = app.searchFields["Search trails"]
        waitFor(pickerSearch)
        pickerSearch.click()
        pickerSearch.typeText("Trail")

        let firstTrail = app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH 'trail_picker_row_'")
        ).firstMatch
        // The search can fail transiently; retry the way a user would.
        let tryAgain = app.buttons["Try Again"]
        for _ in 0..<3 where !firstTrail.waitForExistence(timeout: 15) && tryAgain.exists {
            tryAgain.click()
        }
        waitFor(firstTrail, timeout: 15, message: "Trail search must return a trail to report on")
        firstTrail.click()

        let chooseTrail = app.buttons["trail_report_choose_trail"]
        waitFor(chooseTrail)
        let trailName = chooseTrail.label.components(separatedBy: ",").first?
            .trimmingCharacters(in: .whitespaces) ?? ""
        XCTAssertFalse(
            trailName.isEmpty || trailName.hasPrefix("Choose Trail"),
            "Picking a trail must fill the trail field"
        )
        createdReportTrail = trailName

        let submit = app.buttons["trail_report_submit"]
        XCTAssertTrue(submit.isEnabled, "Submit must enable once a trail is chosen")
        submit.click()

        waitForAbsence(submit, timeout: 20)
        let row = app.descendants(matching: .any)["trail_report_row_\(trailName)"].firstMatch
        XCTAssertTrue(
            row.waitForExistence(timeout: 10),
            "Submitted report for '\(trailName)' must appear in list"
        )
    }

    func testReportFormHasHazardToggles() {
        goToSidebar("Trail Conditions")
        waitFor(app.buttons["Submit Report"].firstMatch).click()

        // On macOS Toggle is rendered as a checkbox; queryable via `switches`
        // (XCUI maps both UISwitches and NSButton checkboxes there) or
        // `checkBoxes`. Prefer the stable identifier SwiftUI exposes across
        // label rendering differences, then fall back to control labels.
        let hazardLabels = ["Downed trees", "Muddy sections", "Ice"]
        for hazard in hazardLabels {
            let byIdentifier = app.descendants(matching: .any)["trail_hazard_\(hazard.uiTestSlug)"]
            let asSwitch = app.switches[hazard]
            let asCheck = app.checkBoxes[hazard]
            XCTAssertTrue(
                byIdentifier.waitForExistence(timeout: 3) ||
                    asSwitch.waitForExistence(timeout: 1) ||
                    asCheck.waitForExistence(timeout: 1),
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
        let cell = app.staticTexts[trail].firstMatch
        let row = app.descendants(matching: .any)["trail_report_row_\(trail)"].firstMatch
        let target = cell.waitForExistence(timeout: 5) ? cell : row
        guard target.waitForExistence(timeout: 1) else { return }
        target.rightClick()
        let deleteButton = app.buttons["Delete"]
        guard deleteButton.waitForExistence(timeout: 3) else { return }
        deleteButton.click()
    }
}
#endif

private extension String {
    var uiTestSlug: String {
        lowercased()
            .replacingOccurrences(of: " ", with: "_")
            .filter { $0.isLetter || $0.isNumber || $0 == "_" }
    }
}
