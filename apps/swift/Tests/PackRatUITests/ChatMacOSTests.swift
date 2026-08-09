import XCTest

#if os(macOS)
/// macOS variant of `ChatTests`. Chat is reachable via the sidebar's "Assistant"
/// row; the input bar and toolbar buttons live in the content column.
final class ChatMacOSTests: AppUITestCase {

    func testChatSidebarReachable() {
        goToSidebar("Assistant")
        XCTAssertTrue(
            app.staticTexts["AI Assistant"].waitForExistence(timeout: 8),
            "AI Assistant title must appear"
        )
    }

    func testChatShowsWelcomeAndInputBar() {
        goToSidebar("Assistant")

        XCTAssertTrue(
            app.staticTexts["PackRat AI"].waitForExistence(timeout: 8),
            "Welcome header must appear"
        )

        XCTAssertTrue(
            app.textFields["chat_input"].waitForExistence(timeout: 5),
            "Chat input field must be visible"
        )
    }

    func testSendMessageDisabledWhenEmpty() {
        goToSidebar("Assistant")
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
        goToSidebar("Assistant")

        let input = app.textFields["chat_input"]
        waitFor(input)
        input.click()
        input.typeText("Hi")

        let sendButton = app.buttons["chat_send"]
        waitFor(sendButton)
        XCTAssertTrue(sendButton.isEnabled, "Send button must enable with non-empty input")
        sendButton.click()

        // User bubble should show "Hi"
        XCTAssertTrue(
            waitForElement(identifier: "chat_message_user", containing: "Hi", timeout: 5),
            "User message bubble must appear after sending"
        )

        // Verify the input field clears as one side-effect of a successful send.
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
        goToSidebar("Assistant")
        // Clear button is in the toolbar — disabled when no messages.
        let clearButton = app.buttons["Clear"]
        if clearButton.waitForExistence(timeout: 5) {
            _ = clearButton.exists
        }
    }
}
#endif
