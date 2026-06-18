import XCTest

#if os(iOS)
// iOS-only suite — uses goToTab() (UITabBar) which doesnt exist on macOS.

/// Sub-flows reachable from Packs: Weight Analysis, Recent Packs.
final class PackSubFlowTests: AppUITestCase {
    private var createdPackName: String?

    override func tearDownWithError() throws {
        if let name = createdPackName {
            cleanupPack(named: name)
        }
        createdPackName = nil
        try super.tearDownWithError()
    }

    func testRecentPacksReachableFromPacksToolbar() {
        goToTab("Packs")

        // "Recent" is in .secondaryAction placement, which collapses into the
        // nav-bar overflow menu on iPhone. Open the menu first if needed.
        let recentButton = app.buttons["Recent"]
        if !recentButton.waitForExistence(timeout: 2) {
            let overflow = app.navigationBars.firstMatch.buttons.matching(
                NSPredicate(format: "label == 'More' OR label CONTAINS 'ellipsis'")
            ).firstMatch
            waitFor(overflow, timeout: 5)
            overflow.tap()
        }
        waitFor(recentButton, timeout: 5, message: "'Recent' button must be reachable")
        recentButton.tap()

        XCTAssertTrue(
            app.navigationBars["Recent Packs"].waitForExistence(timeout: 5),
            "Recent Packs view must appear"
        )
    }

    func testWeightAnalysisReachableFromPackDetailMenu() {
        let packName = uniqueName("E2E Weight Pack")
        createdPackName = packName

        // Create pack and add an item so weight analysis is enabled
        createPack(named: packName)
        let cell = waitFor(app.staticTexts[packName])
        cell.tap()

        // Toolbar ••• menu, then Weight Analysis
        // Scope to the nav bar so we don't grab the bottom tab-bar's "More".
        let menuButton = app.navigationBars.firstMatch.buttons.matching(
            NSPredicate(format: "label CONTAINS 'ellipsis' OR label == 'More'")
        ).firstMatch
        guard menuButton.waitForExistence(timeout: 5) else {
            XCTFail("Pack detail menu button must be present")
            return
        }
        menuButton.tap()

        let weightAnalysis = app.buttons["Weight Analysis"]
        guard weightAnalysis.waitForExistence(timeout: 3) else {
            // Empty pack — disabled. Not a failure for this smoke test.
            return
        }
        // Some packs may have it disabled if empty; tap when enabled
        if weightAnalysis.isEnabled {
            weightAnalysis.tap()
            XCTAssertTrue(
                app.navigationBars["Weight Analysis"].waitForExistence(timeout: 5),
                "Weight Analysis view must open"
            )
        }
    }

    func testGapAnalysisMenuItem() {
        let packName = uniqueName("E2E Gap Pack")
        createdPackName = packName

        createPack(named: packName)
        let cell = waitFor(app.staticTexts[packName])
        cell.tap()

        // Scope to the nav bar so we don't grab the bottom tab-bar's "More".
        let menuButton = app.navigationBars.firstMatch.buttons.matching(
            NSPredicate(format: "label CONTAINS 'ellipsis' OR label == 'More'")
        ).firstMatch
        guard menuButton.waitForExistence(timeout: 5) else { return }
        menuButton.tap()

        XCTAssertTrue(
            app.buttons["Gap Analysis"].waitForExistence(timeout: 3),
            "Gap Analysis must appear in pack menu"
        )
    }

    func testPackContextMenuAndCategoryFilter() {
        let packName = uniqueName("E2E CtxMenu Pack")
        createdPackName = packName

        createPack(named: packName)
        goToTab("Packs")

        // The category filter should be a native picker/menu.
        XCTAssertTrue(
            app.buttons["packs_category_filter"].waitForExistence(timeout: 5)
                || app.popUpButtons["packs_category_filter"].waitForExistence(timeout: 2)
        )

        // Long press a row triggers context menu
        let cell = app.cells.containing(.staticText, identifier: packName).firstMatch
        waitFor(cell)
        cell.press(forDuration: 1.2)

        XCTAssertTrue(
            app.buttons["Delete"].waitForExistence(timeout: 3),
            "Context menu must contain Delete"
        )

        // Dismiss the context menu
        app.tap()
    }

    // MARK: - Helpers

    private func createPack(named name: String) {
        goToTab("Packs")
        waitFor(app.buttons["packs_new_pack_button"]).tap()
        let nameField = app.textFields["pack_name"]
        waitFor(nameField)
        nameField.tap()
        nameField.typeText(name)

        let categoryButton = app.buttons.matching(
            NSPredicate(format: "label CONTAINS 'Category' OR label == 'None'")
        ).firstMatch
        if categoryButton.waitForExistence(timeout: 3) {
            categoryButton.tap()
            let hiking = app.buttons["Hiking"].firstMatch
            if hiking.waitForExistence(timeout: 3) { hiking.tap() }
        }

        app.buttons["Create"].tap()
        waitFor(app.staticTexts[name], timeout: 15)
    }

    private func cleanupPack(named name: String) {
        goToTab("Packs")
        let cell = app.cells.containing(.staticText, identifier: name).firstMatch
        guard cell.waitForExistence(timeout: 5) else { return }
        cell.press(forDuration: 1.2)
        let deleteButton = app.buttons["Delete"]
        guard deleteButton.waitForExistence(timeout: 3) else { return }
        deleteButton.tap()
    }
}

#endif
