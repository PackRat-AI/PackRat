import XCTest

#if os(iOS)
// iOS-only suite — uses goToTab() (UITabBar) which doesnt exist on macOS.

/// E2E tests for Community Feed: browsing, composing, deleting posts.
final class FeedTests: AppUITestCase {

    func testFeedTabReachable() {
        goToTab("Feed")
        XCTAssertTrue(
            app.navigationBars["Community Feed"].waitForExistence(timeout: 8)
        )
    }

    func testNewPostButtonOpensComposer() {
        goToTab("Feed")
        let newPostButton = app.buttons["New Post"]
        waitFor(newPostButton)
        newPostButton.tap()

        XCTAssertTrue(
            app.textViews["feed_compose_caption"].waitForExistence(timeout: 5),
            "Compose post text editor must appear"
        )
        XCTAssertTrue(app.buttons["Cancel"].exists)
        app.buttons["Cancel"].tap()
    }

    func testPostButtonDisabledWithoutCaption() {
        goToTab("Feed")
        waitFor(app.buttons["New Post"]).tap()

        let postButton = app.buttons["Post"]
        waitFor(postButton)
        XCTAssertFalse(
            postButton.isEnabled,
            "Post button must be disabled with empty caption"
        )

        app.buttons["Cancel"].tap()
    }

    func testTypingCaptionEnablesPost() {
        goToTab("Feed")
        waitFor(app.buttons["New Post"]).tap()

        let editor = app.textViews["feed_compose_caption"]
        waitFor(editor)
        editor.tap()
        editor.typeText("E2E test post — please ignore")

        let postButton = app.buttons["Post"]
        waitFor(postButton)
        XCTAssertTrue(
            postButton.isEnabled,
            "Post button must enable once caption is non-empty"
        )

        app.buttons["Cancel"].tap()
    }

    func testCharacterCounterPresent() {
        goToTab("Feed")
        waitFor(app.buttons["New Post"]).tap()

        XCTAssertTrue(
            app.staticTexts.matching(NSPredicate(format: "label CONTAINS '/ 500'")).firstMatch
                .waitForExistence(timeout: 5),
            "Character counter must be visible"
        )

        app.buttons["Cancel"].tap()
    }
}

#endif
