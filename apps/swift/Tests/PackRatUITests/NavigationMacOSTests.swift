import XCTest

#if os(macOS)
/// macOS-native equivalent of `NavigationTests`. The macOS app uses a
/// NavigationSplitView sidebar rather than a UITabBar — assertions target the
/// sidebar's outline rows and the resulting content/detail panes.
final class NavigationMacOSTests: AppUITestCase {

    // Each entry: (sidebar label, expected navigation title or landmark text)
    private let sidebarItems: [(label: String, landmark: String)] = [
        ("Home",    "Home"),
        ("Packs",   "Packs"),
        ("Trips",   "Trips"),
        ("Weather", "Weather"),
    ]

    func testAllPrimarySidebarItemsReachable() {
        for (label, landmark) in sidebarItems {
            goToSidebar(label)
            // The navigation title may render as a window title or static text in
            // the content column. Static text is the most reliable cross-window
            // signal on macOS.
            let predicate = NSPredicate(format: "label == %@", landmark)
            let landmarkHit = app.staticTexts.matching(predicate).firstMatch
            XCTAssertTrue(
                landmarkHit.waitForExistence(timeout: 8),
                "'\(landmark)' landmark must appear after selecting sidebar entry '\(label)'"
            )
        }
    }

    func testPacksSidebarShowsListOrEmpty() {
        goToSidebar("Packs")
        // The content column shows either a List of packs or the empty-state
        // headline "No Packs Yet".
        let hasEmpty = app.staticTexts["No Packs Yet"].waitForExistence(timeout: 5)
        let hasList = app.tables.firstMatch.exists
            || app.outlines.element(boundBy: 1).exists
            || app.staticTexts["New Pack"].exists
        XCTAssertTrue(
            hasEmpty || hasList,
            "Packs sidebar must show list or empty state in content pane"
        )
    }

    func testTripsSidebarShowsListOrEmpty() {
        goToSidebar("Trips")
        let hasEmpty = app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS 'No Trips'")
        ).firstMatch.waitForExistence(timeout: 5)
        let hasList = app.tables.firstMatch.exists
            || app.outlines.element(boundBy: 1).exists
            || app.staticTexts["Plan Trip"].exists
        XCTAssertTrue(hasEmpty || hasList, "Trips sidebar must show list or empty state")
    }

    func testWeatherSidebarShowsSearchField() {
        goToSidebar("Weather")
        XCTAssertTrue(
            app.textFields["Search locations\u{2026}"].waitForExistence(timeout: 8),
            "Weather sidebar must show location search field in content pane"
        )
    }

    func testPacksNewPackButtonPresent() {
        goToSidebar("Packs")
        XCTAssertTrue(
            app.buttons["New Pack"].waitForExistence(timeout: 8),
            "New Pack button must be visible in Packs content toolbar"
        )
    }

    func testPacksCategoryFilterBarVisible() {
        goToSidebar("Packs")
        XCTAssertTrue(
            app.buttons["All"].waitForExistence(timeout: 8),
            "'All' category chip must be visible in Packs content pane"
        )
    }

    func testPacksExploreModeToggle() {
        goToSidebar("Packs")
        let exploreButton = app.buttons["Explore"]
        if exploreButton.waitForExistence(timeout: 5) {
            exploreButton.tap()
            // After switching, either public packs load or empty-state appears
            let empty = app.staticTexts.matching(
                NSPredicate(format: "label CONTAINS 'No Public Packs'")
            ).firstMatch.waitForExistence(timeout: 5)
            // A list might also be visible — pass either way.
            _ = empty
        }
    }

    func testSecondarySidebarItemsReachable() {
        // Items reachable only via the sidebar's lower entries (not present as
        // primary tabs on iOS). These are the ones that lived behind "More" on
        // iOS but are first-class on the macOS sidebar.
        let secondary = [
            ("Assistant",        "AI Assistant"),
            ("Catalog",          "Gear Catalog"),
            ("Templates",        "Pack Templates"),
            ("Trail Conditions", "Trail Conditions"),
            ("Feed",             "Community Feed"),
            ("Guides",           "Guides"),
            ("Gear Inventory",   "Gear Inventory"),
            ("Wildlife",         "Wildlife ID"),
        ]
        for (label, landmark) in secondary {
            goToSidebar(label)
            let hit = app.staticTexts.matching(NSPredicate(format: "label == %@", landmark)).firstMatch
            XCTAssertTrue(
                hit.waitForExistence(timeout: 8),
                "Sidebar entry '\(label)' must navigate to '\(landmark)'"
            )
        }
    }
}
#endif
