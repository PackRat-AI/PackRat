import XCTest

/// E2E tests for Gear Catalog search and item detail.
final class CatalogTests: AppUITestCase {

    func testCatalogTabReachable() {
        goToTab("Catalog")
        XCTAssertTrue(
            app.navigationBars["Gear Catalog"].waitForExistence(timeout: 8)
        )
    }

    func testCatalogShowsEmptySearchPrompt() {
        goToTab("Catalog")
        // Initial state: empty search prompt
        XCTAssertTrue(
            app.staticTexts["Search the Gear Catalog"].waitForExistence(timeout: 8),
            "Catalog should show empty-state search prompt"
        )
    }

    func testCatalogSearchReturnsResults() {
        goToTab("Catalog")

        let searchField = app.textFields["Search tents, packs, sleeping bags…"]
        waitFor(searchField)
        searchField.tap()
        searchField.typeText("tent")

        // Either results load or "no results" — but loading should complete
        let progressIndicator = app.activityIndicators.firstMatch
        // Wait briefly for search debounce + API
        _ = progressIndicator.waitForExistence(timeout: 2)

        // Eventually the loading state ends — give it 15s for API
        let predicate = NSPredicate(format: "exists == false")
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: progressIndicator)
        _ = XCTWaiter.wait(for: [expectation], timeout: 15)

        // Results appear OR the no-results state
        let hasResults = app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] 'tent' OR label CONTAINS 'oz' OR label CONTAINS 'lb'")
        ).count > 0
        let noResults = app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS 'No results'")
        ).firstMatch.exists

        XCTAssertTrue(hasResults || noResults, "Catalog should show results or no-results state")
    }

    func testCatalogSearchClearable() {
        goToTab("Catalog")

        let searchField = app.textFields["Search tents, packs, sleeping bags…"]
        waitFor(searchField)
        searchField.tap()
        searchField.typeText("backpack")

        // The clear (xmark) button should appear
        let clearButton = app.buttons.matching(
            NSPredicate(format: "label CONTAINS 'xmark'")
        ).firstMatch
        if clearButton.waitForExistence(timeout: 5) {
            clearButton.tap()
            // Empty-state prompt should reappear
            XCTAssertTrue(
                app.staticTexts["Search the Gear Catalog"].waitForExistence(timeout: 5),
                "Empty state should return after clearing search"
            )
        }
    }
}
