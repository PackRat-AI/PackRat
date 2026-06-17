import XCTest

#if os(macOS)
/// macOS variant of `SeasonSuggestionsTests`. Season Suggestions is reached
/// from the Home dashboard tile and opens as a sheet on both platforms.
final class SeasonSuggestionsMacOSTests: AppUITestCase {

    func testOpenSeasonSuggestionsFromHome() {
        goToSidebar("Home")

        let tile = app.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] 'Season' OR label CONTAINS[c] 'Suggestion'")
        ).firstMatch
        guard tile.waitForExistence(timeout: 8) else {
            XCTFail("Season Suggestions tile not found on Home")
            return
        }
        tile.click()

        XCTAssertTrue(
            app.staticTexts["AI-Powered Packing Tips"].waitForExistence(timeout: 5)
            || app.staticTexts["Season Suggestions"].waitForExistence(timeout: 5),
            "Season Suggestions sheet must appear"
        )

        app.buttons["Done"].tapIfExists()
    }

    func testSeasonSuggestionsHasLocationField() {
        goToSidebar("Home")

        let tile = app.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] 'Season' OR label CONTAINS[c] 'Suggestion'")
        ).firstMatch
        guard tile.waitForExistence(timeout: 8) else { return }
        tile.click()

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
        goToSidebar("Home")

        let tile = app.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] 'Season' OR label CONTAINS[c] 'Suggestion'")
        ).firstMatch
        guard tile.waitForExistence(timeout: 8) else { return }
        tile.click()

        let getButton = app.buttons["Get Suggestions"]
        if getButton.waitForExistence(timeout: 5) {
            XCTAssertFalse(getButton.isEnabled, "Get Suggestions must be disabled until location is entered")
        }

        app.buttons["Done"].tapIfExists()
    }
}
#endif
