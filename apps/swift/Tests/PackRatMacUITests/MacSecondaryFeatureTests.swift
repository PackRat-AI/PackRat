import XCTest

final class MacSecondaryFeatureTests: MacUITestCase {
    func testAssistantInputSendAndClearControlsOnMac() {
        goToSidebar("Assistant", expected: "AI Assistant")

        XCTAssertTrue(app.staticTexts["PackRat AI"].waitForExistence(timeout: 8))
        let input = waitFor(textInput(
            "Ask about gear, trips, packing...",
            alternateLabels: ["Ask about gear, trips, packing…", "chat_input"]
        ), timeout: 5)
        let send = waitFor(firstExisting([
            app.buttons["chat_send"],
            app.buttons["Arrow Up Circle"],
            app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'Arrow Up Circle'")).firstMatch
        ], timeout: 3), timeout: 5)
        XCTAssertFalse(send.isEnabled)

        input.tap()
        input.typeText("Hi")
        XCTAssertTrue(send.isEnabled)
        send.tap()
        XCTAssertTrue(app.staticTexts["Hi"].waitForExistence(timeout: 8))

        let clear = app.buttons["Clear"].firstMatch
        if clear.exists {
            clear.tap()
        }
    }

    func testCatalogSearchAndClearControlsOnMac() {
        goToSidebar("Catalog", expected: "Search the Gear Catalog")

        let searchField = textInput(
            "Search tents, packs, sleeping bags…",
            alternateLabels: ["Search tents, packs, sleeping bags...", "catalog_search"]
        )
        waitFor(searchField, timeout: 8).tap()
        searchField.typeText("tent")

        let loading = app.activityIndicators.firstMatch
        _ = loading.waitForExistence(timeout: 2)
        waitForSearchToSettle(loading)

        XCTAssertTrue(
            app.staticTexts.matching(
                NSPredicate(format: "label CONTAINS[c] 'tent' OR label CONTAINS[c] 'oz' OR label CONTAINS[c] 'lb' OR label CONTAINS[c] 'no results'")
            ).firstMatch.waitForExistence(timeout: 10)
            || app.buttons["catalog_search_clear"].waitForExistence(timeout: 2),
            "Catalog must show search results or a no-results state"
        )

        let clearButton = app.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] 'clear' OR label CONTAINS[c] 'xmark'")
        ).firstMatch
        if clearButton.waitForExistence(timeout: 3) {
            clearButton.tap()
            XCTAssertTrue(app.staticTexts["Search the Gear Catalog"].waitForExistence(timeout: 5))
        }
    }

    func testTemplateFormControlsOnMac() {
        goToSidebar("Templates", expected: "New Template")
        waitFor(app.buttons["new_template_button"].firstMatch, timeout: 10).tap()

        XCTAssertTrue(textInput("Name", alternateLabels: ["template_name"]).waitForExistence(timeout: 5))
        XCTAssertTrue(
            app.buttons.matching(NSPredicate(format: "label CONTAINS 'Category'")).firstMatch.waitForExistence(timeout: 5)
            || app.staticTexts["Category"].waitForExistence(timeout: 2),
            "Template form must expose category controls"
        )
        app.buttons["Cancel"].macTapIfExists()
    }

    func testFeedComposerControlsOnMac() {
        goToSidebar("Feed", expected: "Community Feed")
        waitFor(app.buttons["new_post_button"].firstMatch, timeout: 10).tap()

        let editor = waitFor(app.textViews["feed_compose_caption"], timeout: 8)
        let post = waitFor(app.buttons["Post"], timeout: 5)
        XCTAssertFalse(post.isEnabled)
        XCTAssertTrue(
            app.staticTexts["feed_compose_counter"].waitForExistence(timeout: 5)
                || app.staticTexts.matching(NSPredicate(format: "label CONTAINS '/ 500'")).firstMatch.waitForExistence(timeout: 2),
            "Feed composer must show the character counter"
        )

        editor.tap()
        editor.typeText("Mac E2E composer check")
        XCTAssertTrue(post.isEnabled)
        app.buttons["Cancel"].macTapIfExists()
    }

    func testTrailReportFormControlsOnMac() {
        goToSidebar("Trail Conditions", expected: "Submit Report")
        waitFor(app.buttons["trail_submit_report_toolbar"].firstMatch, timeout: 10).tap()

        XCTAssertTrue(textInput("Trail Name", alternateLabels: ["trail_name"]).waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["Submit"].isEnabled)

        for hazard in ["Downed trees", "Muddy sections", "Ice"] {
            XCTAssertTrue(
                toggleControl(hazard, alternateLabels: ["trail_hazard_\(hazard.replacingOccurrences(of: " ", with: "_"))"])
                    .waitForExistence(timeout: 5)
            )
        }

        app.buttons["Cancel"].macTapIfExists()
    }

    private func waitForSearchToSettle(_ indicator: XCUIElement) {
        let predicate = NSPredicate(format: "exists == false")
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: indicator)
        _ = XCTWaiter.wait(for: [expectation], timeout: 15)
    }
}
