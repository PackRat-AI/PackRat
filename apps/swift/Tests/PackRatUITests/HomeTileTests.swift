import XCTest

final class HomeTileTests: AppUITestCase {
    private struct Tile {
        let id: String
        let destinationTitle: String?
    }

    private let primaryNavigationTiles: [Tile] = [
        Tile(id: "home_action_mypacks", destinationTitle: "Packs"),
        Tile(id: "home_action_trips", destinationTitle: "Trips"),
        Tile(id: "home_action_weather", destinationTitle: "Weather"),
        Tile(id: "home_action_aiassistant", destinationTitle: "AI Assistant"),
    ]

    private let planningNavigationTiles: [Tile] = [
        Tile(id: "home_action_aipacks", destinationTitle: "AI Packs"),
        Tile(id: "home_action_gearinventory", destinationTitle: "Gear Inventory"),
        Tile(id: "home_action_packtemplates", destinationTitle: "Pack Templates"),
    ]

    private var exploreNavigationTiles: [Tile] {
        var tiles: [Tile] = [
            Tile(id: "home_action_guides", destinationTitle: "Guides"),
            Tile(id: "home_action_catalog", destinationTitle: "Gear Catalog"),
        ]

        if UITestFeatureFlags.enableFeed {
            tiles.append(Tile(id: "home_action_communityfeed", destinationTitle: "Feed"))
        }
        if UITestFeatureFlags.enableTrailConditions {
            tiles.append(Tile(id: "home_action_trailconditions", destinationTitle: "Trail Conditions"))
        }
        if UITestFeatureFlags.enableWildlifeIdentification {
            tiles.append(Tile(id: "home_action_wildlifeid", destinationTitle: "Wildlife"))
        }

        return tiles
    }

    func testPrimaryHomeNavigationTilesOpenDestinations() {
        assertHomeTilesOpenDestinations(primaryNavigationTiles)
    }

    func testPlanningHomeNavigationTilesOpenDestinations() {
        assertHomeTilesOpenDestinations(planningNavigationTiles)
    }

    func testExploreHomeNavigationTilesOpenDestinations() {
        assertHomeTilesOpenDestinations(exploreNavigationTiles)
    }

    func testSeasonSuggestionsTileOpensAndDismissesSheet() {
        goHome()
        tapHomeTile("home_action_seasonsuggestions")

        XCTAssertTrue(
            app.staticTexts["AI-Powered Packing Tips"].waitForExistence(timeout: 5)
            || app.staticTexts["Season Suggestions"].waitForExistence(timeout: 5),
            "Season Suggestions sheet must appear"
        )
        app.buttons["Done"].tapIfExists()
    }

    func testShoppingListTileSupportsAddToggleClearAndDone() throws {
        guard UITestFeatureFlags.enableShoppingList else {
            throw XCTSkip("Shopping List is disabled by feature flags")
        }

        goHome()
        tapHomeTile("home_action_shoppinglist")

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
        XCTAssertTrue(destinationExists("Home", timeout: 5))
    }

    private func goHome() {
        #if os(macOS)
        goToSidebar("Home")
        #else
        goToTab("Home")
        #endif
    }

    private func destinationExists(_ title: String, timeout: TimeInterval) -> Bool {
        #if os(macOS)
        let staticText = app.staticTexts[title]
        let navigationBar = app.navigationBars[title]
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if staticText.exists || navigationBar.exists {
                return true
            }
            Thread.sleep(forTimeInterval: 0.1)
        }
        return staticText.exists || navigationBar.exists
        #else
        return app.navigationBars[title].waitForExistence(timeout: timeout)
        #endif
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

    private func assertHomeTilesOpenDestinations(_ tiles: [Tile]) {
        for tile in tiles {
            goHome()
            tapHomeTile(tile.id)

            guard let destinationTitle = tile.destinationTitle else { continue }
            XCTAssertTrue(
                destinationExists(destinationTitle, timeout: 8),
                "\(tile.id) must open \(destinationTitle)"
            )
        }
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
