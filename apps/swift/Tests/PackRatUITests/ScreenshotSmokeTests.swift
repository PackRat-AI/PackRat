import XCTest

/// Focused visual smoke pass for producing reviewable simulator screenshots.
///
/// Run with `-only-testing:PackRatUITests/ScreenshotSmokeTests`. Screenshots
/// are attached to the `.xcresult`; host-side PNG capture can be done with
/// `xcrun simctl io <device> screenshot`.
final class ScreenshotSmokeTests: AppUITestCase {
    override var additionalLaunchArguments: [String] { ["--ui-test-fixtures"] }

    func testCaptureCoreScreens() throws {
        capture("02-home")

        goToDestination("Packs")
        assertDestinationLoaded("Packs")
        capture("03-packs")

        goToDestination("Weather")
        assertDestinationLoaded("Weather")
        let searchField = app.searchFields["Search locations…"]
        XCTAssertTrue(searchField.waitForExistence(timeout: 10))
        searchField.tap()
        searchField.typeText("Denver")
        let firstResult = app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH 'weather_search_result_' AND label CONTAINS 'Denver'")
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

    private func goToDestination(_ label: String) {
        #if os(macOS)
        goToSidebar(label)
        #else
        goToTab(label)
        #endif
    }

    private func assertDestinationLoaded(_ label: String, file: StaticString = #filePath, line: UInt = #line) {
        #if os(macOS)
        switch label {
        case "Packs":
            XCTAssertTrue(app.buttons["New Pack"].waitForExistence(timeout: 8), file: file, line: line)
        case "Weather":
            XCTAssertTrue(app.searchFields["Search locations…"].waitForExistence(timeout: 8), file: file, line: line)
        default:
            XCTAssertTrue(app.staticTexts[label].waitForExistence(timeout: 8), file: file, line: line)
        }
        #else
        XCTAssertTrue(app.navigationBars[label].waitForExistence(timeout: 8), file: file, line: line)
        #endif
    }
}
