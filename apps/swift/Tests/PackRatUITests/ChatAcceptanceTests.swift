import Foundation
import XCTest

#if os(iOS)
/// Runs only in iOS-ChatAcceptance, against the separately owned loopback fixture.
/// Deliberately does not inherit AppUITestCase's deployed-login fallback.
final class ChatAcceptanceTests: XCTestCase {
    private var app: XCUIApplication!
    private var baseURL: URL!

    override func setUpWithError() throws {
        continueAfterFailure = false
        guard ProcessInfo.processInfo.environment["PACKRAT_CHAT_FIXTURE_URL"] == "http://127.0.0.1:18793" else {
            throw FixtureError.invalidConfiguration
        }
        baseURL = URL(string: "http://127.0.0.1:18793")
        // Missing/wrong server fails before app launch. No auth or provider fallback.
        let health = try control("health", method: "GET")
        let json = try JSONSerialization.jsonObject(with: health) as? [String: String]
        guard json == ["fixture": "packrat-chat-acceptance-v1"] else {
            throw FixtureError.wrongServer
        }
    }

    override func tearDownWithError() throws {
        app?.terminate()
        app = nil
    }

    private func launch(_ scenario: String) throws {
        _ = try control("reset/\(scenario)")
        app = XCUIApplication()
        app.launchArguments = ["--disable-animations", "--use-userdefaults-auth", "--reset-auth", "--seed-e2e-auth"]
        app.launchEnvironment = [
            "E2E_API_BASE_URL": baseURL.absoluteString,
            "PACKRAT_E2E_ALLOW_LOGIN_SEED": "1",
            "PACKRAT_E2E_SESSION_TOKEN": "packrat-e2e-session",
            "PACKRAT_E2E_EMAIL": "e2e@packrat.test",
            "PACKRAT_E2E_USER_ID": "00000000-0000-4000-8000-000000000001",
            "PACKRAT_E2E_PASSWORD": "",
        ]
        app.launch()
        let assistant = app.tabBars.buttons["Assistant"]
        XCTAssertTrue(assistant.waitForExistence(timeout: 10))
        assistant.tap()
        XCTAssertTrue(app.textFields["chat_input"].waitForExistence(timeout: 5))
    }

    private func send(_ text: String) {
        let input = app.textFields["chat_input"]
        input.tap()
        input.typeText(text)
        let send = app.buttons["chat_send"]
        XCTAssertTrue(send.waitForExistence(timeout: 5))
        XCTAssertTrue(send.isEnabled)
        send.tap()
    }

    private func message(_ text: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: "chat_message_assistant")
            .matching(NSPredicate(format: "label == %@", text)).firstMatch
    }

    private func assertIdle() {
        XCTAssertTrue(app.buttons["chat_send"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["chat_cancel"].exists)
        XCTAssertFalse(app.buttons["chat_send"].isEnabled, "Empty input must remain disabled")
        XCTAssertFalse(message("Assistant is typing").exists, "No empty assistant placeholder may remain")
    }

    private func completeAnswer() throws {
        XCTAssertTrue(message("Fixture answer").waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["chat_cancel"].exists, "Partial answer must still be streaming")
        _ = try control("release")
        XCTAssertTrue(message("Fixture answer complete.").waitForExistence(timeout: 5))
        assertIdle()
        XCTAssertFalse(app.descendants(matching: .any)["inline_error"].exists)
    }

    func testVisibleStreamErrorThenSuccessfulResend() throws {
        try launch("error")
        send("Show a fixture error")
        XCTAssertTrue(app.staticTexts["Fixture chat failed. Please try again."].waitForExistence(timeout: 5))
        XCTAssertTrue(app.descendants(matching: .any)["inline_error"].exists)
        assertIdle()
        send("Try the fixture again")
        try completeAnswer()
    }

    func testCancelPartialThenImmediatelyResend() throws {
        try launch("hold")
        send("Hold the first answer")
        XCTAssertTrue(message("First partial").waitForExistence(timeout: 5))
        let cancel = app.buttons["chat_cancel"]
        XCTAssertTrue(cancel.exists)
        cancel.tap()
        // No sleep or fixture release between cancel and re-send.
        send("Start a second answer")
        try completeAnswer()
        XCTAssertTrue(message("First partial").exists, "Cancellation must preserve partial text")
        XCTAssertFalse(message("First partial complete.").exists, "Cancelled turn must not finish later")
        let deadline = Date().addingTimeInterval(3)
        while true {
            do {
                _ = try control("cancelled", method: "GET")
                break
            } catch {
                guard Date() < deadline else { throw error }
                Thread.sleep(forTimeInterval: 0.05)
            }
        }
    }

    func testMultipleDeltasFinishInIdleState() throws {
        try launch("success")
        send("Stream the fixture answer")
        try completeAnswer()
    }

    private func control(_ path: String, method: String = "POST") throws -> Data {
        var request = URLRequest(url: baseURL.appendingPathComponent("fixture/\(path)"))
        request.httpMethod = method
        request.timeoutInterval = 3
        let completed = expectation(description: "Loopback fixture \(path)")
        let result = FixtureResult()
        let session = URLSession(configuration: .ephemeral, delegate: FixtureNoRedirects(), delegateQueue: nil)
        let task = session.dataTask(with: request) { data, response, error in
            if let error {
                result.set(.failure(error))
            } else if (response as? HTTPURLResponse)?.statusCode == 200, let data {
                result.set(.success(data))
            } else {
                result.set(.failure(FixtureError.badResponse))
            }
            completed.fulfill()
        }
        task.resume()
        let outcome = XCTWaiter.wait(for: [completed], timeout: 5)
        session.invalidateAndCancel()
        guard outcome == .completed else { throw FixtureError.timeout }
        return try result.get()
    }
}

/// A different service occupying the fixture port cannot redirect control calls.
private final class FixtureNoRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

private enum FixtureError: Error {
    case invalidConfiguration, wrongServer, badResponse, timeout
}

/// URLSession's callback crosses threads; protect its single result explicitly.
private final class FixtureResult: @unchecked Sendable {
    private let lock = NSLock()
    private var value: Result<Data, Error>?
    func set(_ result: Result<Data, Error>) {
        lock.lock()
        defer { lock.unlock() }
        value = result
    }
    func get() throws -> Data {
        lock.lock()
        defer { lock.unlock() }
        guard let value else { throw FixtureError.badResponse }
        return try value.get()
    }
}
#endif
