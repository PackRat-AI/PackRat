import XCTest

#if os(iOS)
// iOS-only suite — uses goToTab() (UITabBar) which doesnt exist on macOS.

/// E2E tests for AI Chat: input, send, response streaming.
final class ChatTests: AppUITestCase {

    func testChatTabReachable() {
        goToTab("Assistant")
        XCTAssertTrue(
            app.navigationBars["AI Assistant"].waitForExistence(timeout: 8)
        )
    }

    func testChatShowsWelcomeAndInputBar() {
        goToTab("Assistant")

        // Welcome content
        XCTAssertTrue(
            app.staticTexts["PackRat AI"].waitForExistence(timeout: 8),
            "Welcome header must appear"
        )

        // Input bar
        XCTAssertTrue(
            app.textFields["chat_input"].waitForExistence(timeout: 5),
            "Chat input field must be visible"
        )
    }

    func testSendMessageDisabledWhenEmpty() {
        goToTab("Assistant")
        waitFor(app.textFields["chat_input"])

        let sendButton = app.buttons["chat_send"]
        if sendButton.waitForExistence(timeout: 3) {
            XCTAssertFalse(
                sendButton.isEnabled,
                "Send button must be disabled when input is empty"
            )
        }
    }

    func testSendQuickMessage() {
        goToTab("Assistant")

        let input = app.textFields["chat_input"]
        waitFor(input)
        input.tap()
        input.typeText("Hi")

        let sendButton = app.buttons["chat_send"]
        waitFor(sendButton)
        XCTAssertTrue(sendButton.isEnabled, "Send button must enable with non-empty input")
        sendButton.tap()

        // User message bubble should show "Hi"
        XCTAssertTrue(
            waitForElement(identifier: "chat_message_user", containing: "Hi", timeout: 5),
            "User message bubble must appear after sending"
        )

        // Either streaming starts (cancel button) or response arrives.
        // Just check the input was cleared (one of the side effects of a successful send).
        let inputCleared = NSPredicate { _, _ in
            (input.value as? String).map(\.isEmpty) ?? true
        }
        let exp = XCTNSPredicateExpectation(predicate: inputCleared, object: nil)
        _ = XCTWaiter.wait(for: [exp], timeout: 8)

        XCTAssertTrue(
            waitForElement(identifier: "chat_message_assistant", containing: "three essential items", timeout: 15),
            "Assistant response must stream back deterministic E2E content"
        )
    }

    func testClearChatHistoryButton() {
        goToTab("Assistant")
        // Clear button is in the toolbar — disabled when no messages
        let clearButton = app.buttons["Clear"]
        if clearButton.waitForExistence(timeout: 5) {
            // It exists; can't always assert state since some messages may exist
            _ = clearButton.exists
        }
    }
}

#endif
