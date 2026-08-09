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

    func testGetSuggestionsReturnsDeterministicResults() {
        goToHomeAction("Season Suggestions")

        let locationField = app.textFields["season_suggestions_location"]
        waitFor(locationField, timeout: 5, message: "Season Suggestions location field must be visible")
        locationField.tap()
        locationField.typeText("Yosemite")

        let getButton = app.buttons["season_suggestions_submit"]
        waitFor(getButton, timeout: 5)
        XCTAssertTrue(getButton.isEnabled, "Get Suggestions must enable when location is entered")
        getButton.tap()

        XCTAssertTrue(
            app.descendants(matching: .any)["season_suggestions_results"].waitForExistence(timeout: 20)
            || app.staticTexts["Shoulder Season Overnight"].waitForExistence(timeout: 2),
            "Season Suggestions must render deterministic E2E results"
        )

        app.buttons["Done"].tapIfExists()
    }
}

#endif
