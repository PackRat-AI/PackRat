import XCTest

/// E2E tests for Pack Templates: browse, create, delete.
final class PackTemplateTests: AppUITestCase {
    private var createdTemplateName: String?

    override func tearDownWithError() throws {
        if let name = createdTemplateName {
            cleanupTemplate(named: name)
        }
        createdTemplateName = nil
        try super.tearDownWithError()
    }

    func testTemplatesTabReachable() {
        goToTab("Templates")
        XCTAssertTrue(
            app.navigationBars["Pack Templates"].waitForExistence(timeout: 8),
            "Pack Templates navigation must appear"
        )
    }

    func testNewTemplateButtonOpensForm() {
        goToTab("Templates")
        waitFor(app.buttons["New Template"]).tap()

        XCTAssertTrue(
            app.textFields["Name"].waitForExistence(timeout: 5),
            "Template Name field must appear"
        )
        XCTAssertTrue(app.buttons["Cancel"].exists)
        app.buttons["Cancel"].tap()
    }

    func testCreateTemplate() {
        // The createTemplate helper waits for form dismiss then filters via
        // the search field so the new template is visible despite the user's
        // many official templates above the "Mine" section.
        let name = uniqueName("E2E Template")
        createdTemplateName = name

        createTemplate(named: name)

        let row = app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH '\(name)'")
        ).firstMatch
        XCTAssertTrue(
            row.waitForExistence(timeout: 5),
            "Created template '\(name)' should appear in list"
        )
    }

    func testTemplatesSearchable() {
        goToTab("Templates")
        XCTAssertTrue(
            app.searchFields.firstMatch.waitForExistence(timeout: 8),
            "Templates list must be searchable"
        )
    }

    func testOpenTemplateDetail() {
        let name = uniqueName("E2E Detail Template")
        createdTemplateName = name

        createTemplate(named: name)
        waitFor(app.staticTexts[name]).tap()

        XCTAssertTrue(
            app.navigationBars[name].waitForExistence(timeout: 10),
            "Template detail nav bar should show name"
        )
    }

    func testTemplateCategoryPicker() {
        goToTab("Templates")
        waitFor(app.buttons["New Template"]).tap()

        // Category picker should be visible
        XCTAssertTrue(
            app.buttons.matching(NSPredicate(format: "label CONTAINS 'Category'")).firstMatch
                .waitForExistence(timeout: 5)
            || app.staticTexts["Category"].waitForExistence(timeout: 2),
            "Category picker must be visible in template form"
        )
        app.buttons["Cancel"].tap()
    }

    // MARK: - Helpers

    private func createTemplate(named name: String) {
        goToTab("Templates")
        waitFor(app.buttons["New Template"]).tap()
        let nameField = app.textFields["Name"]
        waitFor(nameField)
        nameField.tap()
        nameField.typeText(name)
        app.buttons["Save"].tap()

        // Wait for the form to actually dismiss. The Name textfield uniquely
        // belongs to the form, so its absence is a reliable signal.
        waitForAbsence(nameField, timeout: 15)

        // Use the search field to filter — much more reliable than scrolling
        // past the user's many official templates.
        let searchField = app.searchFields["Search templates"]
        if searchField.waitForExistence(timeout: 5) {
            searchField.tap()
            searchField.typeText(name)
        }

        // Match the row's combined label (e.g. "E2E Template ..., 0 items, Custom")
        // rather than the inner static text — SwiftUI lazy lists may not surface
        // the inner static text in XCUI's query until the cell is interacted with.
        let row = app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH '\(name)'")
        ).firstMatch
        waitFor(row, timeout: 5)
    }

    private func cleanupTemplate(named name: String) {
        // Tab navigation may be impossible if the search field is focused or
        // a sheet is open; wrap so cleanup never crashes the test report.
        if !app.tabBars.firstMatch.exists {
            // Try to dismiss anything modal first.
            let cancel = app.buttons["Cancel"]
            if cancel.exists { cancel.tap() }
        }
        guard app.tabBars.firstMatch.waitForExistence(timeout: 3) else { return }
        goToTab("Templates")
        let cell = app.cells.containing(.staticText, identifier: name).firstMatch
        guard cell.waitForExistence(timeout: 5) else { return }
        cell.press(forDuration: 1.2)
        let deleteButton = app.buttons["Delete"]
        guard deleteButton.waitForExistence(timeout: 3) else { return }
        deleteButton.tap()
    }
}
