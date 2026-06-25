import XCTest

final class HomeTileTests: AppUITestCase {
    private struct Tile {
        let id: String
        let destinationTitle: String?
    }

    private let navigationTiles: [Tile] = [
        Tile(id: "home_tile_my_packs", destinationTitle: "Packs"),
        Tile(id: "home_tile_trips", destinationTitle: "Trips"),
        Tile(id: "home_tile_weather", destinationTitle: "Weather"),
        Tile(id: "home_tile_ai_assistant", destinationTitle: "AI Assistant"),
        Tile(id: "home_tile_gear_inventory", destinationTitle: "Gear Inventory"),
        Tile(id: "home_tile_pack_templates", destinationTitle: "Pack Templates"),
        Tile(id: "home_tile_guides", destinationTitle: "Guides"),
        Tile(id: "home_tile_catalog", destinationTitle: "Gear Catalog"),
        Tile(id: "home_tile_community_feed", destinationTitle: "Community Feed"),
        Tile(id: "home_tile_trail_conditions", destinationTitle: "Trail Conditions"),
        Tile(id: "home_tile_wildlife_id", destinationTitle: "Wildlife ID")
    ]

    func testEveryHomeNavigationTileOpensDestination() {
        for tile in navigationTiles {
            goToTab("Home")
            tapHomeTile(tile.id)

            guard let destinationTitle = tile.destinationTitle else { continue }
            XCTAssertTrue(
                app.navigationBars[destinationTitle].waitForExistence(timeout: 8),
                "\(tile.id) must open \(destinationTitle)"
            )
        }
    }

    func testSeasonSuggestionsTileOpensAndDismissesSheet() {
        goToTab("Home")
        tapHomeTile("home_tile_season_suggestions")

        XCTAssertTrue(
            app.staticTexts["AI-Powered Packing Tips"].waitForExistence(timeout: 5)
            || app.staticTexts["Season Suggestions"].waitForExistence(timeout: 5),
            "Season Suggestions sheet must appear"
        )
        app.buttons["Done"].tapIfExists()
    }

    func testShoppingListTileSupportsAddToggleClearAndDone() {
        goToTab("Home")
        tapHomeTile("home_tile_shopping_list")

        XCTAssertTrue(
            app.navigationBars.matching(NSPredicate(format: "identifier BEGINSWITH 'Shopping List'")).firstMatch
                .waitForExistence(timeout: 5)
            || app.staticTexts["Shopping List Empty"].waitForExistence(timeout: 5),
            "Shopping List sheet must appear"
        )

        waitFor(app.buttons["shopping_add_item"], timeout: 5).tap()
        XCTAssertTrue(app.navigationBars["Add Item"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["shopping_item_add"].isEnabled)

        let itemName = "E2E Stove \(Int(Date().timeIntervalSince1970))"
        let nameField = waitFor(app.textFields["shopping_item_name"], timeout: 5)
        nameField.tap()
        nameField.typeText(itemName)

        waitFor(app.textFields["shopping_item_price"], timeout: 5).tap()
        app.typeText("49.99")

        waitFor(app.buttons["shopping_item_add"], timeout: 5).tap()
        XCTAssertTrue(app.staticTexts[itemName].waitForExistence(timeout: 5))

        let toggle = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'shopping_toggle_'")).firstMatch
        waitFor(toggle, timeout: 5).tap()

        openOverflowMenu()
        waitFor(menuButton(id: "shopping_toggle_purchased_visibility", label: "Show Purchased"), timeout: 5).tap()
        XCTAssertTrue(app.staticTexts[itemName].waitForExistence(timeout: 5))

        openOverflowMenu()
        waitFor(menuButton(id: "shopping_clear_purchased", label: "Clear Purchased"), timeout: 5).tap()
        XCTAssertFalse(
            app.staticTexts[itemName].waitForExistence(timeout: 3),
            "Clear Purchased must remove purchased items"
        )

        waitFor(app.buttons["shopping_done"], timeout: 5).tap()
        XCTAssertTrue(app.navigationBars["Home"].waitForExistence(timeout: 5))
    }

    private func tapHomeTile(_ id: String) {
        let tile = app.buttons[id]
        if !tile.waitForExistence(timeout: 3) {
            app.swipeUp()
        }
        if !tile.waitForExistence(timeout: 3) {
            app.swipeUp()
        }
        waitFor(tile, timeout: 5, message: "\(id) must be visible on Home").tap()
    }

    private func openOverflowMenu() {
        let overflow = app.buttons["OverflowBarButtonItem"]
        if overflow.waitForExistence(timeout: 2) {
            overflow.tap()
            return
        }
        waitFor(
            app.buttons.matching(NSPredicate(format: "identifier == 'OverflowBarButtonItem'")).firstMatch,
            timeout: 5,
            message: "Overflow menu must be available"
        ).tap()
    }

    private func menuButton(id: String, label: String) -> XCUIElement {
        let identified = app.buttons[id]
        if identified.exists { return identified }
        return app.buttons[label]
    }
}
