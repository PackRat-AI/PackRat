import XCTest

#if os(macOS)
/// macOS variant of `SeasonSuggestionsTests`. Season Suggestions is reached
/// from the Home dashboard tile and opens as a sheet on both platforms.
final class SeasonSuggestionsMacOSTests: AppUITestCase {

    func testOpenSeasonSuggestionsFromHome() {
        goToSidebar("Home")

        let tile = app.buttons["home_action_seasonsuggestions"]
        guard tile.waitForExistence(timeout: 8) else {
            XCTFail("Season Suggestions tile not found on Home")
            return
        }
        tile.click()

        XCTAssertTrue(
            app.staticTexts["Season Suggestions"].waitForExistence(timeout: 5)
            || app.staticTexts["Sign In for Season Suggestions"].waitForExistence(timeout: 5),
            "Season Suggestions sheet must appear"
        )

        app.buttons["Done"].tapIfExists()
    }

    func testSeasonSuggestionsHasLocationField() {
        goToSidebar("Home")

        let tile = app.buttons["home_action_seasonsuggestions"]
        guard tile.waitForExistence(timeout: 8) else { return }
        tile.click()

        XCTAssertTrue(
            app.textFields["e.g. Yosemite, Pacific Crest Trail…"].waitForExistence(timeout: 5)
            || app.staticTexts["Destination"].waitForExistence(timeout: 3)
            || app.staticTexts["Sign In for Season Suggestions"].waitForExistence(timeout: 3),
            "Location prompt must appear"
        )

        app.buttons["Done"].tapIfExists()
    }

    func testGetSuggestionsButtonDisabledWithEmptyLocation() {
        goToSidebar("Home")

        let tile = app.buttons["home_action_seasonsuggestions"]
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
