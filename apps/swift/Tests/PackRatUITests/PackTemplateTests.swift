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
        let name = uniqueName("E2E Template")
        createdTemplateName = name

        goToTab("Templates")
        waitFor(app.buttons["New Template"]).tap()

        let nameField = app.textFields["Name"]
        waitFor(nameField)
        nameField.tap()
        nameField.typeText(name)

        app.buttons["Save"].tap()

        // Template should appear in "Mine" section
        XCTAssertTrue(
            app.staticTexts[name].waitForExistence(timeout: 15),
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

        // The user's account has many official templates above the "Mine"
        // section; scroll the list down so the newly-created template is in
        // the rendered viewport before asserting.
        let target = app.staticTexts[name]
        let list = app.collectionViews.firstMatch
        for _ in 0..<8 {
            if target.exists { break }
            list.swipeUp()
        }
        waitFor(target, timeout: 5)
    }

    private func cleanupTemplate(named name: String) {
        goToTab("Templates")
        let cell = app.cells.containing(.staticText, identifier: name).firstMatch
        guard cell.waitForExistence(timeout: 5) else { return }
        cell.press(forDuration: 1.2)
        let deleteButton = app.buttons["Delete"]
        guard deleteButton.waitForExistence(timeout: 3) else { return }
        deleteButton.tap()
    }
}
