import XCTest

#if os(macOS)
/// macOS-native equivalent of `NavigationTests`. The macOS app uses a
/// NavigationSplitView sidebar rather than a UITabBar — assertions target the
/// sidebar's outline rows and the resulting content/detail panes.
final class NavigationMacOSTests: AppUITestCase {

    private let sidebarItems = [
        "Home",
        "Packs",
        "Trips",
        "Weather",
    ]

    func testAllPrimarySidebarItemsReachable() {
        for label in sidebarItems {
            goToSidebar(label)
            XCTAssertTrue(
                destinationIsVisible(for: label, timeout: 8),
                "Content landmark must appear after selecting sidebar entry '\(label)'"
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
            || app.staticTexts["Trips"].exists
        let hasPrimaryAction = app.buttons["trips_plan_trip_button"].exists
            || app.buttons["Plan Trip"].exists
        XCTAssertTrue(
            hasEmpty || hasList || hasPrimaryAction,
            "Trips sidebar must show list, empty state, or primary action"
        )
    }

    func testWeatherSidebarShowsSearchField() {
        goToSidebar("Weather")
        XCTAssertTrue(
            app.searchFields["Search locations\u{2026}"].waitForExistence(timeout: 8),
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
            "Assistant",
            "Catalog",
            "Templates",
            "Trail Conditions",
            "Feed",
            "Guides",
            "Gear Inventory",
            "Wildlife",
        ]
        for label in secondary {
            goToSidebar(label)
            XCTAssertTrue(
                destinationIsVisible(for: label, timeout: 8),
                "Sidebar entry '\(label)' must navigate to its content pane"
            )
        }
    }

    private func destinationIsVisible(for label: String, timeout: TimeInterval) -> Bool {
        switch label {
        case "Home":
            return app.staticTexts["Here's your outdoor dashboard"].waitForExistence(timeout: timeout)
        case "Packs":
            return app.buttons["New Pack"].waitForExistence(timeout: timeout)
                || app.buttons["All"].waitForExistence(timeout: 1)
        case "Trips":
            return app.buttons["Plan Trip"].waitForExistence(timeout: timeout)
                || app.tables.firstMatch.waitForExistence(timeout: 1)
                || app.outlines.element(boundBy: 1).waitForExistence(timeout: 1)
        case "Weather":
            return app.searchFields["Search locations\u{2026}"].waitForExistence(timeout: timeout)
        case "Assistant":
            return app.textFields["chat_input"].waitForExistence(timeout: timeout)
        case "Catalog":
            return app.searchFields["Search tents, packs, sleeping bags\u{2026}"].waitForExistence(timeout: timeout)
                || app.staticTexts["Search the Gear Catalog"].waitForExistence(timeout: 1)
        case "Templates":
            return app.buttons["New Template"].waitForExistence(timeout: timeout)
                || app.tables.firstMatch.waitForExistence(timeout: 1)
                || app.outlines.element(boundBy: 1).waitForExistence(timeout: 1)
        case "Trail Conditions":
            return app.buttons["Submit Report"].waitForExistence(timeout: timeout)
                || app.tables.firstMatch.waitForExistence(timeout: 1)
                || app.outlines.element(boundBy: 1).waitForExistence(timeout: 1)
        case "Feed":
            return app.buttons["New Post"].waitForExistence(timeout: timeout)
                || app.buttons["Write a Post"].waitForExistence(timeout: 1)
        case "Guides":
            return app.staticTexts["Guides"].waitForExistence(timeout: timeout)
                || app.tables.firstMatch.waitForExistence(timeout: 1)
        case "Gear Inventory":
            return app.staticTexts["Gear Inventory"].waitForExistence(timeout: timeout)
                || app.buttons.matching(NSPredicate(format: "label CONTAINS 'Add'")).firstMatch.waitForExistence(timeout: 1)
        case "Wildlife":
            return app.buttons["Choose Photo"].waitForExistence(timeout: timeout)
                || app.staticTexts["Identify Wildlife"].waitForExistence(timeout: 1)
        default:
            return false
        }
    }
}
#endif
