import XCTest

final class AuthTests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments.append("--disable-animations")
        app.launch()
    }

    // MARK: - Login

    func testLoginScreenAppears() {
        // Before auth, the login form must be visible
        XCTAssertTrue(app.textFields["login_email"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.secureTextFields["login_password"].exists)
        XCTAssertTrue(app.buttons["login_submit"].exists)
    }

    func testLoginWithBadCredentialShowsError() {
        let emailField = app.textFields["login_email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 10))
        emailField.tap()
        emailField.typeText("notauser@invalid.test")

        let passwordField = app.secureTextFields["login_password"]
        passwordField.tap()
        passwordField.typeText("wrongpassword")

        app.buttons["login_submit"].tap()

        // An error banner or inline error should appear — not a tab bar
        XCTAssertFalse(app.tabBars.firstMatch.waitForExistence(timeout: 5))
        // The login form should still be visible
        XCTAssertTrue(app.textFields["login_email"].exists)
    }

    func testLoginButtonDisabledWithEmptyFields() {
        XCTAssertTrue(app.textFields["login_email"].waitForExistence(timeout: 10))
        // Both fields empty → button disabled
        XCTAssertFalse(app.buttons["login_submit"].isEnabled)

        app.textFields["login_email"].tap()
        app.textFields["login_email"].typeText("a@b.com")
        // Only email filled → still disabled
        XCTAssertFalse(app.buttons["login_submit"].isEnabled)
    }

    func testNavigateToRegisterAndBack() {
        XCTAssertTrue(app.textFields["login_email"].waitForExistence(timeout: 10))

        let signUpButton = app.buttons["Don't have an account? Sign Up"]
        XCTAssertTrue(signUpButton.waitForExistence(timeout: 5))
        signUpButton.tap()

        // Register form should appear
        XCTAssertTrue(
            app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Sign Up' OR label CONTAINS 'Register' OR label CONTAINS 'Create'")).firstMatch
                .waitForExistence(timeout: 5)
        )

        // Tap "Already have an account" back link
        let loginLink = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Sign In' OR label CONTAINS 'Log In' OR label CONTAINS 'account'")).firstMatch
        loginLink.tapIfExists()

        XCTAssertTrue(app.textFields["login_email"].waitForExistence(timeout: 5))
    }

    func testSuccessfulLogin() throws {
        let email = ProcessInfo.processInfo.environment["E2E_EMAIL"] ?? ""
        let password = ProcessInfo.processInfo.environment["E2E_PASSWORD"] ?? ""
        guard !email.isEmpty, !password.isEmpty else {
            throw XCTSkip("E2E_EMAIL and E2E_PASSWORD are required for this test")
        }

        let emailField = app.textFields["login_email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 10))
        emailField.tap()
        emailField.typeText(email)

        let passwordField = app.secureTextFields["login_password"]
        passwordField.tap()
        passwordField.typeText(password)

        app.buttons["login_submit"].tap()

        XCTAssertTrue(
            app.tabBars.firstMatch.waitForExistence(timeout: 20),
            "Tab bar must appear after successful login"
        )
        XCTAssertFalse(app.textFields["login_email"].exists, "Login form should be dismissed")
    }
}
