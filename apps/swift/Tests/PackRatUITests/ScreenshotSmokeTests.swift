import XCTest

/// Focused visual smoke pass for producing reviewable simulator screenshots.
///
/// Run with `-only-testing:PackRatUITests/ScreenshotSmokeTests`. Screenshots
/// are attached to the `.xcresult`; host-side PNG capture can be done with
/// `xcrun simctl io <device> screenshot`.
final class ScreenshotSmokeTests: AppUITestCase {
    func testCaptureCoreScreens() throws {
        capture("02-home")

        goToTab("Packs")
        XCTAssertTrue(app.navigationBars["Packs"].waitForExistence(timeout: 8))
        capture("03-packs")

        goToTab("Weather")
        XCTAssertTrue(app.navigationBars["Weather"].waitForExistence(timeout: 8))
        let searchField = app.textFields["Search locations..."].exists
            ? app.textFields["Search locations..."]
            : app.textFields["Search locations…"]
        XCTAssertTrue(searchField.waitForExistence(timeout: 10))
        searchField.tap()
        searchField.typeText("Denver")
        let firstResult = app.buttons.matching(
            NSPredicate(format: "label CONTAINS 'Denver' AND label CONTAINS ','")
        ).firstMatch
        XCTAssertTrue(firstResult.waitForExistence(timeout: 10))
        firstResult.tap()
        XCTAssertTrue(app.staticTexts["10-Day Forecast"].waitForExistence(timeout: 20))
        if app.keyboards.firstMatch.exists {
            app.keyboards.buttons["Return"].tapIfExists()
        }
        waitForAbsence(app.keyboards.firstMatch, timeout: 3)
        capture("04-weather")
    }

    private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
