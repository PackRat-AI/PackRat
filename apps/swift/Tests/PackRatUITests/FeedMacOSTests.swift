import XCTest

#if os(macOS)
/// macOS variant of `FeedTests`. Feed lives behind the sidebar's "Feed" row;
/// the composer opens as a sheet from the content column toolbar.
final class FeedMacOSTests: AppUITestCase {

    func testFeedSidebarReachable() {
        goToSidebar("Feed")
        XCTAssertTrue(
            app.staticTexts["Community Feed"].waitForExistence(timeout: 8),
            "Community Feed header must appear"
        )
    }

    func testNewPostButtonOpensComposer() {
        goToSidebar("Feed")
        let newPostButton = app.buttons["New Post"]
        waitFor(newPostButton)
        newPostButton.click()

        XCTAssertTrue(
            app.textViews["feed_compose_caption"].waitForExistence(timeout: 5),
            "Compose post text editor must appear"
        )
        XCTAssertTrue(app.buttons["Cancel"].exists)
        app.buttons["Cancel"].click()
    }

    func testPostButtonDisabledWithoutCaption() {
        goToSidebar("Feed")
        waitFor(app.buttons["New Post"]).click()

        let postButton = app.buttons["Post"]
        waitFor(postButton)
        XCTAssertFalse(
            postButton.isEnabled,
            "Post button must be disabled with empty caption"
        )

        app.buttons["Cancel"].click()
    }

    func testTypingCaptionEnablesPost() {
        goToSidebar("Feed")
        waitFor(app.buttons["New Post"]).click()

        let editor = app.textViews["feed_compose_caption"]
        waitFor(editor)
        editor.click()
        editor.typeText("E2E test post — please ignore")

        let postButton = app.buttons["Post"]
        waitFor(postButton)
        XCTAssertTrue(
            postButton.isEnabled,
            "Post button must enable once caption is non-empty"
        )

        app.buttons["Cancel"].click()
    }

    func testCharacterCounterPresent() {
        goToSidebar("Feed")
        waitFor(app.buttons["New Post"]).click()

        XCTAssertTrue(
            app.staticTexts.matching(NSPredicate(format: "label CONTAINS '/ 500'")).firstMatch
                .waitForExistence(timeout: 5),
            "Character counter must be visible"
        )

        app.buttons["Cancel"].click()
    }
}
#endif
