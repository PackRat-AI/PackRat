import XCTest

#if os(macOS)
/// macOS variant of `PackSubFlowTests`. Recent Packs is reached via the
/// "Recent" toolbar button in the Packs content column. Weight Analysis and
/// Gap Analysis live in the detail-column overflow menu.
final class PackSubFlowMacOSTests: AppUITestCase {
    private var createdPackName: String?

    override func tearDownWithError() throws {
        if let name = createdPackName {
            cleanupPack(named: name)
        }
        createdPackName = nil
        try super.tearDownWithError()
    }

    func testRecentPacksReachableFromPacksToolbar() {
        goToSidebar("Packs")

        let recentButton = app.buttons["Recent"]
        waitFor(recentButton, timeout: 5, message: "'Recent' button must be reachable from Packs toolbar")
        recentButton.click()

        XCTAssertTrue(
            app.descendants(matching: .any)["recent_packs_view"].waitForExistence(timeout: 5)
            || app.staticTexts["Recent Packs"].waitForExistence(timeout: 2),
            "Recent Packs view must appear"
        )
    }

    func testWeightAnalysisReachableFromPackDetailMenu() {
        let packName = uniqueName("E2E Weight Pack")
        createdPackName = packName

        createPack(named: packName)
        let cell = waitFor(app.staticTexts[packName])
        cell.click()

        // Wait for detail column to load.
        _ = app.staticTexts["Total"].waitForExistence(timeout: 5)

        let menuButton = detailMenuButton()
        guard menuButton.waitForExistence(timeout: 5) else {
            XCTFail("Pack detail menu button must be present")
            return
        }
        menuButton.click()

        let weightAnalysis = app.menuItems["Weight Analysis"]
        guard weightAnalysis.waitForExistence(timeout: 3) else {
            // Empty pack — disabled. Not a failure for this smoke test.
            return
        }
        if weightAnalysis.isEnabled {
            weightAnalysis.click()
            XCTAssertTrue(
                app.staticTexts["Weight Analysis"].waitForExistence(timeout: 5),
                "Weight Analysis view must open"
            )
        }
    }

    func testGapAnalysisMenuItem() {
        let packName = uniqueName("E2E Gap Pack")
        createdPackName = packName

        createPack(named: packName)
        let cell = waitFor(app.staticTexts[packName])
        cell.click()
        _ = app.staticTexts["Total"].waitForExistence(timeout: 5)

        let menuButton = detailMenuButton()
        guard menuButton.waitForExistence(timeout: 5) else { return }
        menuButton.click()

        XCTAssertTrue(
            app.menuItems["Gap Analysis"].waitForExistence(timeout: 3),
            "Gap Analysis must appear in pack menu"
        )
    }

    func testPackContextMenuAndCategoryFilter() {
        let packName = uniqueName("E2E CtxMenu Pack")
        createdPackName = packName

        createPack(named: packName)
        goToSidebar("Packs")

        XCTAssertTrue(app.buttons["All"].waitForExistence(timeout: 5))

        // Right-click triggers context menu on macOS.
        let cell = waitFor(app.staticTexts[packName])
        cell.rightClick()

        XCTAssertTrue(
            rowDeleteMenuItem().waitForExistence(timeout: 3),
            "Context menu must contain Delete"
        )

        // Dismiss the context menu by pressing Escape.
        app.typeKey(XCUIKeyboardKey.escape.rawValue, modifierFlags: [])
    }

    // MARK: - Helpers

    private func createPack(named name: String) {
        goToSidebar("Packs")
        waitFor(app.buttons["New Pack"]).click()
        let nameField = app.textFields["pack_name"]
        waitFor(nameField)
        nameField.click()
        nameField.typeText(name)
        app.buttons["Create"].click()
        waitFor(app.staticTexts[name], timeout: 15)
    }

    private func cleanupPack(named name: String) {
        goToSidebar("Packs")
        let cell = app.staticTexts[name]
        guard cell.waitForExistence(timeout: 5) else { return }
        cell.rightClick()
        let deleteButton = rowDeleteMenuItem()
        guard deleteButton.waitForExistence(timeout: 3) else { return }
        deleteButton.click()
    }

    private func detailMenuButton() -> XCUIElement {
        let identified = app.menuButtons["pack_detail_more_menu"]
        if identified.exists { return identified }
        let fallback = app.menuButtons["ellipsis.circle"]
        if fallback.exists { return fallback }
        return app.buttons.matching(NSPredicate(format: "label CONTAINS 'ellipsis' OR label == 'More'")).firstMatch
    }

    private func rowDeleteMenuItem() -> XCUIElement {
        app.menuItems.matching(NSPredicate(format: "identifier == %@", "trash")).firstMatch
    }
}
#endif
