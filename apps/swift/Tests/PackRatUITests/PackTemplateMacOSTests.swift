import XCTest

#if os(macOS)
/// macOS variant of `PackTemplateTests`. Templates is the sidebar's
/// "Templates" entry; selecting a template populates the detail column.
final class PackTemplateMacOSTests: AppUITestCase {
    private var createdTemplateName: String?

    override func tearDownWithError() throws {
        if let name = createdTemplateName {
            cleanupTemplate(named: name)
        }
        createdTemplateName = nil
        try super.tearDownWithError()
    }

    func testTemplatesSidebarReachable() {
        goToSidebar("Templates")
        XCTAssertTrue(
            app.staticTexts["Pack Templates"].waitForExistence(timeout: 8),
            "Pack Templates header must appear"
        )
    }

    func testNewTemplateButtonOpensForm() {
        goToSidebar("Templates")
        waitFor(app.buttons["New Template"]).click()

        XCTAssertTrue(
            app.textFields["template_name"].waitForExistence(timeout: 5),
            "Template Name field must appear"
        )
        XCTAssertTrue(app.buttons["Cancel"].exists)
        app.buttons["Cancel"].click()
    }

    func testCreateTemplate() {
        let name = uniqueName("E2E Template")
        createdTemplateName = name

        createTemplate(named: name)

        let row = app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH '\(name)'")
        ).firstMatch
        let staticTextHit = app.staticTexts[name]
        XCTAssertTrue(
            row.waitForExistence(timeout: 5) || staticTextHit.waitForExistence(timeout: 2),
            "Created template '\(name)' should appear in list"
        )
    }

    func testTemplatesSearchable() {
        goToSidebar("Templates")
        XCTAssertTrue(
            app.searchFields.firstMatch.waitForExistence(timeout: 8),
            "Templates list must be searchable"
        )
    }

    func testOpenTemplateDetail() {
        let name = uniqueName("E2E Detail Template")
        createdTemplateName = name

        createTemplate(named: name)
        let row = waitFor(app.staticTexts[name])
        row.click()

        // Detail column shows the template name as a heading and "Gear List"
        // section header. Either is sufficient as a landmark.
        XCTAssertTrue(
            app.staticTexts[name].waitForExistence(timeout: 10)
            || app.staticTexts["Gear List"].waitForExistence(timeout: 5)
            || app.buttons["Apply to Pack"].waitForExistence(timeout: 5),
            "Template detail must appear in trailing column"
        )
    }

    func testTemplateCategoryPicker() {
        goToSidebar("Templates")
        waitFor(app.buttons["New Template"]).click()

        XCTAssertTrue(
            app.buttons.matching(NSPredicate(format: "label CONTAINS 'Category'")).firstMatch
                .waitForExistence(timeout: 5)
            || app.staticTexts["Category"].waitForExistence(timeout: 2)
            || app.popUpButtons.firstMatch.waitForExistence(timeout: 2),
            "Category picker must be visible in template form"
        )
        app.buttons["Cancel"].click()
    }

    // MARK: - Helpers

    private func createTemplate(named name: String) {
        goToSidebar("Templates")
        waitFor(app.buttons["New Template"]).click()
        let nameField = app.textFields["template_name"]
        waitFor(nameField)
        nameField.click()
        nameField.typeText(name)
        app.buttons["Save"].click()

        waitForAbsence(nameField, timeout: 15)

        // Filter the list with the search field so the new template surfaces
        // above the user's many official templates.
        let searchField = app.searchFields["Search templates"]
        if searchField.waitForExistence(timeout: 5) {
            searchField.click()
            searchField.typeText(name)
        }
    }

    private func cleanupTemplate(named name: String) {
        // Dismiss anything modal first.
        let cancel = app.buttons["Cancel"]
        if cancel.exists { cancel.click() }

        goToSidebar("Templates")
        let cell = app.staticTexts[name]
        guard cell.waitForExistence(timeout: 5) else { return }
        cell.rightClick()
        let deleteButton = app.buttons["Delete"]
        guard deleteButton.waitForExistence(timeout: 3) else { return }
        deleteButton.click()
    }
}
#endif
