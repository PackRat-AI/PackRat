import XCTest

class MacUITestCase: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments.append("--disable-animations")
        app.launchArguments.append("--ui-testing")
        app.launchArguments.append("--reset-auth")
        if let apiBaseURL = ProcessInfo.processInfo.environment["E2E_API_BASE_URL"], !apiBaseURL.isEmpty {
            app.launchEnvironment["E2E_API_BASE_URL"] = apiBaseURL
        }
        app.launch()
        try loginIfNeeded()
    }

    override func tearDownWithError() throws {
        app.terminate()
        try super.tearDownWithError()
    }

    func loginIfNeeded() throws {
        if app.staticTexts["Home"].waitForExistence(timeout: 2) { return }

        let email = ProcessInfo.processInfo.environment["E2E_EMAIL"] ?? ""
        let password = ProcessInfo.processInfo.environment["E2E_PASSWORD"] ?? ""
        guard !email.isEmpty, !password.isEmpty else {
            throw XCTSkip("E2E_EMAIL and E2E_PASSWORD are required for macOS UI tests")
        }

        let emailField = app.textFields["login_email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 10), "Login screen must appear")
        emailField.tap()
        emailField.typeText(email)

        let passwordField = app.secureTextFields["login_password"]
        passwordField.tap()
        passwordField.typeText(password)

        app.buttons["login_submit"].tap()
        XCTAssertTrue(
            app.staticTexts["Home"].waitForExistence(timeout: 20),
            "Home content must appear after login"
        )
    }

    func goToSidebar(_ label: String, expected: String? = nil) {
        let destinations = [
            "Home": "home",
            "Packs": "packs",
            "Trips": "trips",
            "Weather": "weather",
            "Assistant": "chat",
            "Catalog": "catalog",
            "Templates": "templates",
            "Trail Conditions": "trailConditions",
            "Feed": "feed",
            "Guides": "guides",
            "Gear Inventory": "gearInventory",
            "Wildlife": "wildlife"
        ]
        guard let rawValue = destinations[label] else {
            XCTFail("Unknown sidebar item '\(label)'")
            return
        }

        waitFor(app.buttons["sidebar_nav_\(rawValue)"], timeout: 5, message: "\(label) sidebar item must exist").tap()
        waitFor(app.descendants(matching: .any)["screen_\(rawValue)"], timeout: 8, message: "\(label) screen must appear after sidebar selection")

        if let expectedLabel = expected {
            XCTAssertTrue(
                firstExisting([
                    app.staticTexts[expectedLabel],
                    app.buttons[expectedLabel],
                    app.searchFields[expectedLabel],
                    app.textFields[expectedLabel]
                ], timeout: 8).exists,
                "\(expectedLabel) content must appear after selecting \(label)"
            )
        }
    }

    func firstExisting(_ elements: [XCUIElement], timeout: TimeInterval = 5) -> XCUIElement {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            if let element = elements.first(where: { $0.exists }) {
                return element
            }
            RunLoop.current.run(until: Date().addingTimeInterval(0.1))
        } while Date() < deadline

        return elements.first ?? app.staticTexts.firstMatch
    }

    func textInput(_ label: String, alternateLabels: [String] = []) -> XCUIElement {
        let labels = [label] + alternateLabels
        let candidates = labels.flatMap { candidate in
            [
                app.textFields[candidate],
                app.searchFields[candidate],
                app.secureTextFields[candidate],
                app.textViews[candidate],
                app.descendants(matching: .any)[candidate]
            ]
        }
        return firstExisting(candidates, timeout: 3)
    }

    func toggleControl(_ label: String, alternateLabels: [String] = []) -> XCUIElement {
        let labels = [label] + alternateLabels
        let candidates = labels.flatMap { candidate in
            [
                app.switches[candidate],
                app.checkBoxes[candidate],
                app.buttons[candidate],
                app.descendants(matching: .any)[candidate]
            ]
        }
        return firstExisting(candidates, timeout: 3)
    }

    @discardableResult
    func waitFor(_ element: XCUIElement, timeout: TimeInterval = 10, message: String? = nil) -> XCUIElement {
        let msg = message ?? "\(element.description) did not appear within \(timeout)s"
        XCTAssertTrue(element.waitForExistence(timeout: timeout), msg)
        return element
    }

    func waitForAbsence(_ element: XCUIElement, timeout: TimeInterval = 10) {
        let predicate = NSPredicate(format: "exists == false")
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
        let result = XCTWaiter.wait(for: [expectation], timeout: timeout)
        XCTAssertEqual(result, .completed, "\(element.description) should have disappeared")
    }

    func uniqueName(_ prefix: String) -> String {
        "\(prefix) \(Int(Date().timeIntervalSince1970))"
    }

    override func tearDown() {
        if let testRun, testRun.totalFailureCount > 0 {
            let screenshot = XCUIScreen.main.screenshot()
            let attachment = XCTAttachment(screenshot: screenshot)
            attachment.name = "Failure-\(name)"
            attachment.lifetime = .keepAlways
            add(attachment)

            let dump = app?.debugDescription ?? "no app"
            let textAttachment = XCTAttachment(string: dump)
            textAttachment.name = "Hierarchy-\(name)"
            textAttachment.lifetime = .keepAlways
            add(textAttachment)
        }
        super.tearDown()
    }
}

extension XCUIElement {
    func macTapIfExists() {
        if exists { tap() }
    }
}
