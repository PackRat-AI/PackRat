import XCTest

/// Smoke + interaction tests for the secondary tabs that don't have
/// their own dedicated suites: Home, Guides, Gear Inventory, Wildlife.
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
        // Greeting starts with one of the time-of-day phrases
        let greeting = app.staticTexts.matching(
            NSPredicate(format: "label BEGINSWITH 'Good morning' OR label BEGINSWITH 'Good afternoon' OR label BEGINSWITH 'Good evening'")
        ).firstMatch
        XCTAssertTrue(
            greeting.waitForExistence(timeout: 8),
            "Home should show a time-based greeting"
        )
    }

    func testHomeShowsDashboardSubtitle() {
        goToTab("Home")
        XCTAssertTrue(
            app.staticTexts["Here's your outdoor dashboard"].waitForExistence(timeout: 8)
        )
    }

    // MARK: - Guides

    func testGuidesTabReachable() {
        goToTab("Guides")
        XCTAssertTrue(
            app.navigationBars["Guides"].waitForExistence(timeout: 8),
            "Guides navigation must appear"
        )
    }

    // MARK: - Gear Inventory

    func testGearInventoryTabReachable() {
        goToTab("Gear Inventory")
        XCTAssertTrue(
            app.navigationBars["Gear Inventory"].waitForExistence(timeout: 8),
            "Gear Inventory navigation must appear"
        )
    }

    // MARK: - Wildlife

    func testWildlifeTabReachable() {
        goToTab("Wildlife")
        XCTAssertTrue(
            app.navigationBars["Wildlife ID"].waitForExistence(timeout: 8),
            "Wildlife ID navigation must appear"
        )
    }
}
