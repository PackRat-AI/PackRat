import XCTest

#if os(iOS)
// iOS-only suite — uses goToTab() (UITabBar) which doesnt exist on macOS.

/// E2E tests for Gear Catalog search and item detail.
final class CatalogTests: AppUITestCase {

    func testCatalogTabReachable() {
        goToCatalog()
        XCTAssertTrue(
            app.navigationBars["Gear Catalog"].waitForExistence(timeout: 8)
        )
    }

    func testCatalogShowsEmptySearchPrompt() {
        goToCatalog()
        // Initial state: empty search prompt
        XCTAssertTrue(
            app.staticTexts["Search the Gear Catalog"].waitForExistence(timeout: 8),
            "Catalog should show empty-state search prompt"
        )
    }

    func testCatalogSearchReturnsResults() {
        goToCatalog()

        let searchField = app.searchFields["Search tents, packs, sleeping bags…"]
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

        // Results appear OR the explicit no-results state.
        let hasResults = app.otherElements["catalog_results_list"].exists
            || app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'catalog_item_row_'")).count > 0
        let noResults = app.otherElements["catalog_no_results"].exists
            || app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'No Results'")).firstMatch.exists

        XCTAssertTrue(hasResults || noResults, "Catalog should show results or no-results state")
    }

    func testCatalogSearchClearable() {
        goToCatalog()

        let searchField = app.searchFields["Search tents, packs, sleeping bags…"]
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

    private func goToCatalog() {
        goToHomeAction("Catalog")
    }
}

#endif
