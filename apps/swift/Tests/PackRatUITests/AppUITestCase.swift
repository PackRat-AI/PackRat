import XCTest

// MARK: - Base class

/// Base class for all PackRat UI tests.
///
/// Credentials come from the scheme's environment variables:
///   E2E_EMAIL    — registered test account email
///   E2E_PASSWORD — registered test account password
///
/// Set them in Xcode: Edit Scheme → Run → Arguments → Environment Variables,
/// or pass via xcodebuild: -e E2E_EMAIL=... -e E2E_PASSWORD=...
class AppUITestCase: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        // Disable animations so tests don't have to wait for spring physics
        app.launchArguments.append("--disable-animations")
        app.launch()
        try loginIfNeeded()
    }

    // MARK: - Login helper

    func loginIfNeeded() throws {
        // Already logged in from a previous test (app not relaunched between classes)
        if app.tabBars.firstMatch.waitForExistence(timeout: 2) { return }

        let email = ProcessInfo.processInfo.environment["E2E_EMAIL"] ?? ""
        let password = ProcessInfo.processInfo.environment["E2E_PASSWORD"] ?? ""

        guard !email.isEmpty, !password.isEmpty else {
            throw XCTSkip("E2E_EMAIL and E2E_PASSWORD environment variables are required to run UI tests")
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
            app.tabBars.firstMatch.waitForExistence(timeout: 20),
            "Tab bar must appear after login — check credentials or network"
        )
    }

    // MARK: - Navigation helpers

    /// Navigates to a tab by label. iOS shows the first 4 NavItems as tabs and
    /// the rest behind a "More" overflow tab — this helper handles both cases.
    func goToTab(_ label: String) {
        let direct = app.tabBars.buttons[label]
        if direct.exists {
            direct.tap()
            return
        }

        let moreButton = app.tabBars.buttons["More"]
        if moreButton.waitForExistence(timeout: 3) {
            moreButton.tap()
            let cell = app.tables.staticTexts[label]
            if cell.waitForExistence(timeout: 3) {
                cell.tap()
                return
            }
        }

        XCTAssertTrue(
            direct.waitForExistence(timeout: 5),
            "Tab '\(label)' not found in tab bar or More overflow"
        )
        direct.tap()
    }

    // MARK: - Wait helpers

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

    /// Attaches a screenshot + accessibility tree dump on failure for triage.
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

    // MARK: - Unique test data

    /// Returns a name guaranteed to be unique across test runs.
    func uniqueName(_ prefix: String) -> String {
        "\(prefix) \(Int(Date().timeIntervalSince1970))"
    }
}

// MARK: - XCUIElement helpers

extension XCUIElement {
    /// Clears the current value then types the given text.
    func clearAndTypeText(_ text: String) {
        guard let existing = value as? String, !existing.isEmpty else {
            typeText(text)
            return
        }
        // Select all + delete
        tap()
        let selectAll = XCUIApplication().menuItems["Select All"]
        if selectAll.waitForExistence(timeout: 0.5) {
            selectAll.tap()
        } else {
            // Fallback: move to end and backspace
            let deleteString = String(repeating: XCUIKeyboardKey.delete.rawValue, count: existing.count)
            typeText(deleteString)
        }
        typeText(text)
    }

    /// Taps the element only if it exists; silently skips otherwise.
    func tapIfExists() {
        if exists { tap() }
    }
}
