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
        goToSidebar("Home")
        XCTAssertTrue(
            app.staticTexts["Here's your outdoor dashboard"].waitForExistence(timeout: 8)
        )
    }

    func testHomeUsesWideMacContentArea() {
        goToSidebar("Home")
        let firstTile = app.buttons["My Packs, No packs yet"]
        XCTAssertTrue(firstTile.waitForExistence(timeout: 8))
        XCTAssertGreaterThan(
            firstTile.frame.width,
            220,
            "Home cards should use the Mac detail column instead of a narrow phone-width content column"
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
