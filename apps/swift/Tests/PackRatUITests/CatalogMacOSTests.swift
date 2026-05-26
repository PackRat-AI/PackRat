import XCTest

#if os(macOS)
/// macOS variant of `CatalogTests`. Catalog is reachable via the sidebar's
/// "Catalog" row; the content column renders `CatalogView` directly (no nav
/// bar — title is the window title or content-column header).
final class CatalogMacOSTests: AppUITestCase {

    func testCatalogSidebarReachable() {
        goToSidebar("Catalog")
        // navigationTitle becomes a static text in the content column header.
        XCTAssertTrue(
            app.staticTexts["Gear Catalog"].waitForExistence(timeout: 8),
            "Gear Catalog header must appear"
        )
    }

    func testCatalogShowsEmptySearchPrompt() {
        goToSidebar("Catalog")
        XCTAssertTrue(
            app.staticTexts["Search the Gear Catalog"].waitForExistence(timeout: 8),
            "Catalog should show empty-state search prompt"
        )
    }

    func testCatalogSearchReturnsResults() {
        goToSidebar("Catalog")

        let searchField = app.searchFields["Search tents, packs, sleeping bags…"]
        waitFor(searchField)
        searchField.click()
        searchField.typeText("tent")

        let progressIndicator = app.progressIndicators.firstMatch
        _ = progressIndicator.waitForExistence(timeout: 2)

        // Wait for any loading to settle.
        let predicate = NSPredicate(format: "exists == false")
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: progressIndicator)
        _ = XCTWaiter.wait(for: [expectation], timeout: 15)

        let hasResults = app.descendants(matching: .any)["catalog_results_list"]
        let noResults = app.descendants(matching: .any)["catalog_no_results"]
        let resolved = hasResults.waitForExistence(timeout: 15) || noResults.waitForExistence(timeout: 1)

        XCTAssertTrue(resolved, "Catalog should show results or no-results state")
    }

    func testCatalogSearchClearable() {
        goToSidebar("Catalog")

        let searchField = app.searchFields["Search tents, packs, sleeping bags…"]
        waitFor(searchField)
        searchField.click()
        searchField.typeText("backpack")

        let clearButton = app.buttons.matching(
            NSPredicate(format: "label CONTAINS 'xmark'")
        ).firstMatch
        if clearButton.waitForExistence(timeout: 5) {
            clearButton.click()
            XCTAssertTrue(
                app.staticTexts["Search the Gear Catalog"].waitForExistence(timeout: 5),
                "Empty state should return after clearing search"
            )
        }
    }
}
#endif
