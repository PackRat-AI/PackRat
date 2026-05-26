import XCTest

#if os(iOS)
// iOS-only suite — uses goToTab() (UITabBar) which doesnt exist on macOS.

/// Smoke + interaction tests for Home and secondary destinations exposed from
/// Home. iPhone keeps the tab bar intentionally small; Home owns discovery.
final class MoreTabsTests: AppUITestCase {

    // MARK: - Home

    func testHomeTabReachable() {
        goToTab("Home")
        XCTAssertTrue(
            app.navigationBars["Home"].waitForExistence(timeout: 8),
            "Home navigation must appear"
        )
    }

    func testHomeShowsGreeting() {
        goToTab("Home")
        let greeting = app.staticTexts["home_greeting"]
        XCTAssertTrue(
            greeting.waitForExistence(timeout: 8),
            "Home should show a time-based greeting"
        )
        XCTAssertFalse(
            greeting.label.contains("@"),
            "Home greeting should not use an email address as the display name"
        )
    }

    func testHomeShowsDashboardSubtitle() {
        goToTab("Home")
        XCTAssertTrue(
            app.staticTexts["Here's your outdoor dashboard"].waitForExistence(timeout: 8)
        )
    }

    func testHomePrimaryActionsUseNativeRows() {
        goToTab("Home")
        let packs = app.buttons["home_action_mypacks"]
        let trips = app.buttons["home_action_trips"]
        XCTAssertTrue(packs.waitForExistence(timeout: 8))
        XCTAssertTrue(trips.waitForExistence(timeout: 8))
        XCTAssertLessThan(
            packs.frame.height,
            80,
            "Compact iPhone Home actions should use native list rows instead of oversized dashboard tiles"
        )
    }

    func testHomePrimaryActionNavigatesToTab() {
        goToTab("Home")
        let packs = app.buttons["home_action_mypacks"]
        XCTAssertTrue(packs.waitForExistence(timeout: 8))

        packs.tap()

        XCTAssertTrue(
            app.navigationBars["Packs"].waitForExistence(timeout: 8),
            "Home actions should switch the selected iPhone tab, not just update app state"
        )
    }

    func testPrimaryTabsWorkAfterOpeningMoreDestination() {
        goToTab("Assistant")
        XCTAssertTrue(
            app.navigationBars["AI Assistant"].waitForExistence(timeout: 8),
            "Assistant should be a primary tab"
        )

        goToTab("Home")

        XCTAssertTrue(
            app.navigationBars["Home"].waitForExistence(timeout: 8),
            "Primary tabs should remain reachable after opening a More destination"
        )
    }

    // MARK: - Guides

    func testGuidesTabReachable() {
        goToHomeAction("Guides")
        XCTAssertTrue(
            app.navigationBars["Guides"].waitForExistence(timeout: 8),
            "Guides navigation must appear from Home"
        )
    }

    // MARK: - Gear Inventory

    func testGearInventoryTabReachable() {
        goToHomeAction("Gear Inventory")
        XCTAssertTrue(
            app.navigationBars["Gear Inventory"].waitForExistence(timeout: 8),
            "Gear Inventory navigation must appear from Home"
        )
    }

    // MARK: - Wildlife

    func testWildlifeTabReachable() {
        goToHomeAction("Wildlife ID")
        XCTAssertTrue(
            app.navigationBars["Wildlife ID"].waitForExistence(timeout: 8),
            "Wildlife ID navigation must appear from Home"
        )
    }

    func testHomeGlobalSearchButtonOpensSearch() {
        goToTab("Home")
        app.buttons["Search"].tap()
        XCTAssertTrue(
            app.textFields["Search packs, trips, trails…"].waitForExistence(timeout: 8),
            "Home should expose broad PackRat search"
        )
    }

}

#endif
