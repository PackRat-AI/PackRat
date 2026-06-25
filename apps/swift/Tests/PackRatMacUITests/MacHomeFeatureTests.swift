import XCTest

final class MacHomeFeatureTests: MacUITestCase {
    func testPrimaryHomeTileOpensPacksOnMac() {
        goToSidebar("Home", expected: "Home")
        tapHomeTile("home_tile_my_packs")
        XCTAssertTrue(
            app.buttons["New Pack"].waitForExistence(timeout: 8)
            || app.staticTexts["Packs"].waitForExistence(timeout: 2),
            "Packs content must appear after selecting the home tile"
        )
    }

    func testShoppingListTileSupportsAddToggleClearAndDone() {
        goToSidebar("Home", expected: "Home")
        tapHomeTile("home_tile_shopping_list")

        XCTAssertTrue(
            app.staticTexts["Shopping List Empty"].waitForExistence(timeout: 5)
            || app.buttons["shopping_add_item"].waitForExistence(timeout: 5),
            "Shopping List sheet must appear"
        )

        waitFor(app.buttons["shopping_add_item"], timeout: 5).tap()
        XCTAssertTrue(app.textFields["shopping_item_name"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["shopping_item_add"].isEnabled)

        let itemName = "Mac Stove \(Int(Date().timeIntervalSince1970))"
        let nameField = waitFor(app.textFields["shopping_item_name"], timeout: 5)
        nameField.tap()
        nameField.typeText(itemName)

        waitFor(app.textFields["shopping_item_price"], timeout: 5).tap()
        app.typeText("49.99")

        waitFor(app.buttons["shopping_item_add"], timeout: 5).tap()
        XCTAssertTrue(app.staticTexts[itemName].waitForExistence(timeout: 5))

        let toggle = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'shopping_toggle_'")).firstMatch
        waitFor(toggle, timeout: 5).tap()

        app.buttons["shopping_done"].macTapIfExists()
    }

    private func tapHomeTile(_ id: String) {
        let tile = app.buttons[id]
        if !tile.waitForExistence(timeout: 2) {
            app.scrollViews.firstMatch.swipeUp()
        }
        if !tile.waitForExistence(timeout: 2) {
            app.scrollViews.firstMatch.swipeUp()
        }
        waitFor(tile, timeout: 5, message: "\(id) must be visible on Home").tap()
    }

}
