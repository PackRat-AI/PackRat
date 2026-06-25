import XCTest

#if os(iOS)
// iOS-only suite — uses goToTab() (UITabBar) which doesnt exist on macOS.

/// E2E tests for Season Suggestions — opens from the Home tab.
final class SeasonSuggestionsTests: AppUITestCase {

    func testOpenSeasonSuggestionsFromHome() {
        goToHomeAction("Season Suggestions")

        XCTAssertTrue(
            app.navigationBars["Season Suggestions"].waitForExistence(timeout: 5)
            || app.staticTexts["Sign In for Season Suggestions"].waitForExistence(timeout: 5),
            "Season Suggestions sheet must appear"
        )

        // Dismiss
        app.buttons["Done"].tapIfExists()
    }

    func testSeasonSuggestionsHasLocationField() {
        goToHomeAction("Season Suggestions")

        XCTAssertTrue(
            app.textFields["e.g. Yosemite, Pacific Crest Trail…"].waitForExistence(timeout: 5)
            || app.staticTexts["Destination"].waitForExistence(timeout: 3)
            || app.staticTexts["Sign In for Season Suggestions"].waitForExistence(timeout: 3),
            "Location prompt must appear"
        )

        app.buttons["Done"].tapIfExists()
    }

    func testGetSuggestionsButtonDisabledWithEmptyLocation() {
        goToHomeAction("Season Suggestions")

        let getButton = app.buttons["Get Suggestions"]
        if getButton.waitForExistence(timeout: 5) {
            XCTAssertFalse(getButton.isEnabled, "Get Suggestions must be disabled until location is entered")
        }

        app.buttons["Done"].tapIfExists()
    }
}

#endif
