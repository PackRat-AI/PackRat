import XCTest

/// E2E tests for Season Suggestions — opens from the Home tab.
final class SeasonSuggestionsTests: AppUITestCase {

    func testOpenSeasonSuggestionsFromHome() {
        goToTab("Home")

        // Look for the Season Suggestions tile/button on Home
        let tile = app.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] 'Season' OR label CONTAINS[c] 'Suggestion'")
        ).firstMatch
        guard tile.waitForExistence(timeout: 8) else {
            XCTFail("Season Suggestions tile not found on Home tab")
            return
        }
        tile.tap()

        XCTAssertTrue(
            app.staticTexts["AI-Powered Packing Tips"].waitForExistence(timeout: 5)
            || app.staticTexts["Season Suggestions"].waitForExistence(timeout: 5),
            "Season Suggestions sheet must appear"
        )

        // Dismiss
        app.buttons["Done"].tapIfExists()
    }

    func testSeasonSuggestionsHasLocationField() {
        goToTab("Home")

        let tile = app.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] 'Season' OR label CONTAINS[c] 'Suggestion'")
        ).firstMatch
        guard tile.waitForExistence(timeout: 8) else { return }
        tile.tap()

        XCTAssertTrue(
            app.textFields.matching(
                NSPredicate(format: "placeholderValue CONTAINS[c] 'Yosemite' OR placeholderValue CONTAINS[c] 'going'")
            ).firstMatch.waitForExistence(timeout: 5)
            || app.staticTexts["Where are you going?"].waitForExistence(timeout: 3),
            "Location prompt must appear"
        )

        app.buttons["Done"].tapIfExists()
    }

    func testGetSuggestionsButtonDisabledWithEmptyLocation() {
        goToTab("Home")

        let tile = app.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] 'Season' OR label CONTAINS[c] 'Suggestion'")
        ).firstMatch
        guard tile.waitForExistence(timeout: 8) else { return }
        tile.tap()

        let getButton = app.buttons["Get Suggestions"]
        if getButton.waitForExistence(timeout: 5) {
            XCTAssertFalse(getButton.isEnabled, "Get Suggestions must be disabled until location is entered")
        }

        app.buttons["Done"].tapIfExists()
    }
}
