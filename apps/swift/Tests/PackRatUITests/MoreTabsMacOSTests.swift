import XCTest

#if os(macOS)
/// macOS variant of `MoreTabsTests`. On iOS the secondary sections (Home,
/// Guides, Gear Inventory, Wildlife) sit behind a "More" tab; on macOS they
/// each have their own sidebar row.
final class MoreTabsMacOSTests: AppUITestCase {

    // MARK: - Home

    func testHomeSidebarReachable() {
        goToSidebar("Home")
        XCTAssertTrue(
            app.staticTexts["Home"].waitForExistence(timeout: 8),
            "Home content header must appear"
        )
    }

    func testHomeShowsGreeting() {
        goToSidebar("Home")
        let greeting = app.staticTexts.matching(
            NSPredicate(format: "label BEGINSWITH 'Good morning' OR label BEGINSWITH 'Good afternoon' OR label BEGINSWITH 'Good evening'")
        ).firstMatch
        XCTAssertTrue(
            greeting.waitForExistence(timeout: 8),
            "Home should show a time-based greeting"
        )
    }

    func testHomeShowsDashboardSubtitle() {
        goToSidebar("Home")
        XCTAssertTrue(
            app.staticTexts["Here's your outdoor dashboard"].waitForExistence(timeout: 8)
        )
    }

    // MARK: - Guides

    func testGuidesSidebarReachable() {
        goToSidebar("Guides")
        // The Guides view sets navigationTitle("Guides"); on macOS the title
        // surfaces as a static text in the content column header.
        XCTAssertTrue(
            app.staticTexts["Guides"].waitForExistence(timeout: 8),
            "Guides header must appear"
        )
    }

    // MARK: - Gear Inventory

    func testGearInventorySidebarReachable() {
        goToSidebar("Gear Inventory")
        XCTAssertTrue(
            app.staticTexts["Gear Inventory"].waitForExistence(timeout: 8),
            "Gear Inventory header must appear"
        )
    }

    // MARK: - Wildlife

    func testWildlifeSidebarReachable() {
        goToSidebar("Wildlife")
        XCTAssertTrue(
            app.staticTexts["Wildlife ID"].waitForExistence(timeout: 8),
            "Wildlife ID header must appear"
        )
    }
}
#endif
