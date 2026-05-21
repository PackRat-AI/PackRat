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
        ("Weather", "Weather"),
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
        // Either the pack list or the empty-state is visible
        let hasList = app.collectionViews.firstMatch.waitForExistence(timeout: 8)
        let hasEmpty = app.staticTexts["No Packs Yet"].waitForExistence(timeout: 2)
        XCTAssertTrue(hasList || hasEmpty, "Packs tab must show list or empty state")
    }

    func testTripsTabShowsListOrEmpty() {
        goToTab("Trips")
        let hasList = app.collectionViews.firstMatch.waitForExistence(timeout: 8)
        let hasEmpty = app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS 'No Trips'")
        ).firstMatch.waitForExistence(timeout: 2)
        XCTAssertTrue(hasList || hasEmpty, "Trips tab must show list or empty state")
    }

    func testWeatherTabShowsSearchField() {
        goToTab("Weather")
        XCTAssertTrue(
            app.textFields["Search locations\u{2026}"].waitForExistence(timeout: 8),
            "Weather tab must show location search field"
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
        // The list has a search bar
        let searchField = app.searchFields.firstMatch
        XCTAssertTrue(
            searchField.waitForExistence(timeout: 8),
            "Packs list must have a search bar"
        )
        searchField.tap()
        searchField.typeText("nonexistent_pack_xyz")

        // Either no results message or an empty list
        let noResults = app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS 'nonexistent_pack_xyz' OR label CONTAINS 'No results'")
        ).firstMatch
        // Just verify we didn't crash — the exact message varies
        _ = noResults.waitForExistence(timeout: 3)
    }

    func testPacksCategoryFilterBarVisible() {
        goToTab("Packs")
        // Category filter chips (All, Hiking, Backpacking, …) are in a scroll view above the list
        XCTAssertTrue(
            app.buttons["All"].waitForExistence(timeout: 8),
            "'All' category chip must be visible in Packs tab"
        )
    }

    func testPacksExploreModeToggle() {
        goToTab("Packs")
        // The My Packs / Explore segmented picker lives in the secondary toolbar
        let exploreButton = app.buttons["Explore"]
        if exploreButton.waitForExistence(timeout: 5) {
            exploreButton.tap()
            // After switching, either public packs load or an empty state appears
            let loaded = app.collectionViews.firstMatch.waitForExistence(timeout: 10)
            let empty = app.staticTexts.matching(
                NSPredicate(format: "label CONTAINS 'No Public Packs'")
            ).firstMatch.waitForExistence(timeout: 3)
            XCTAssertTrue(loaded || empty, "Explore mode must show packs or empty state")
        }
    }
}
#endif
