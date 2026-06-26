import XCTest

#if os(iOS)
/// Covers top-level navigation — every tab must be reachable and show its title.
/// macOS uses a different navigation idiom (NavigationSplitView sidebar); the
/// equivalent suite lives in `NavigationMacOSTests` and is gated separately.
final class NavigationTests: AppUITestCase {

    // Each entry: (tab bar label, expected navigation title or landmark text)
    private let tabs: [(tab: String, landmark: String)] = [
        ("Home",    "Home"),
        ("Packs",   "Packs"),
        ("Trips",   "Trips"),
        ("Assistant", "AI Assistant"),
    ]

    func testAllPrimaryTabsReachable() {
        for (tab, landmark) in tabs {
            goToTab(tab)
            XCTAssertTrue(
                app.navigationBars[landmark].waitForExistence(timeout: 8),
                "'\(landmark)' navigation bar must appear when tapping '\(tab)' tab"
            )
        }
    }

    func testPacksTabShowsListOrEmpty() {
        goToTab("Packs")
        let hasList = identified("packs_list").waitForExistence(timeout: 8)
        let hasEmpty = identified("packs_empty_state").waitForExistence(timeout: 2)
        XCTAssertTrue(hasList || hasEmpty, "Packs tab must show list or empty state")
    }

    func testTripsTabShowsListOrEmpty() {
        goToTab("Trips")
        let hasList = identified("trips_list").waitForExistence(timeout: 8)
        let hasEmpty = identified("trips_empty_state").waitForExistence(timeout: 2)
        let hasError = identified("trips_error_state").waitForExistence(timeout: 2)
        let hasPrimaryAction = app.buttons["trips_plan_trip_button"].waitForExistence(timeout: 2)
        XCTAssertTrue(
            hasList || hasEmpty || hasError || hasPrimaryAction,
            "Trips tab must show list, empty state, error state, or primary trip action"
        )
    }

    func testWeatherTabShowsSearchField() {
        goToHomeAction("Weather")
        XCTAssertTrue(
            app.searchFields["Search locations\u{2026}"].waitForExistence(timeout: 8),
            "Weather destination must show location search field"
        )
    }

    func testPacksNewPackButtonPresent() {
        goToTab("Packs")
        XCTAssertTrue(
            app.buttons["New Pack"].waitForExistence(timeout: 8),
            "New Pack button must be visible in Packs tab toolbar"
        )
    }

    func testPacksSearchable() {
        goToTab("Packs")
        let searchField = app.searchFields.firstMatch
        XCTAssertTrue(
            searchField.waitForExistence(timeout: 8),
            "Packs list must have a search bar"
        )
        searchField.tap()
        searchField.typeText("nonexistent_pack_xyz")

        XCTAssertTrue(
            identified("packs_search_empty_state").waitForExistence(timeout: 5),
            "Packs search must show the native search empty state for unmatched queries"
        )
    }

    func testPacksCategoryFilterBarVisible() {
        goToTab("Packs")
        // Category filtering should use the native SwiftUI picker/menu control.
        XCTAssertTrue(
            app.buttons["packs_category_filter"].waitForExistence(timeout: 8)
                || app.popUpButtons["packs_category_filter"].waitForExistence(timeout: 2),
            "Category filter picker must be visible in Packs tab"
        )
    }

    func testPacksExploreModeToggle() {
        goToTab("Packs")
        let picker = app.segmentedControls["packs_mode_picker"]
        let exploreButton = app.buttons["packs_mode_explore"]
        XCTAssertTrue(
            picker.waitForExistence(timeout: 5) || exploreButton.waitForExistence(timeout: 1),
            "Packs mode picker must be visible"
        )

        if exploreButton.exists {
            exploreButton.tap()
        } else {
            picker.buttons["Explore"].tap()
        }

        let loaded = app.collectionViews["packs_public_list"].waitForExistence(timeout: 10)
            || identified("packs_public_list").waitForExistence(timeout: 1)
        let empty = identified("packs_public_empty_state").waitForExistence(timeout: 3)
        XCTAssertTrue(loaded || empty, "Explore mode must show public packs or empty state")
    }

    private func identified(_ identifier: String) -> XCUIElement {
        app.descendants(matching: .any)[identifier]
    }
}
#endif
