import XCTest

final class MacSmokeTests: XCTestCase {
    func testLoginScreenAppearsOnMac() {
        let app = XCUIApplication()
        app.launchArguments.append("--disable-animations")
        app.launchArguments.append("--reset-auth")
        app.launch()
        defer { app.terminate() }

        XCTAssertTrue(
            app.textFields["login_email"].waitForExistence(timeout: 10),
            "macOS app should launch to the login screen when auth is reset"
        )
        XCTAssertTrue(app.secureTextFields["login_password"].exists)
        XCTAssertTrue(app.buttons["login_submit"].exists)
    }

    func testSuccessfulLoginOnMacReachesPrimaryChrome() throws {
        let app = XCUIApplication()
        app.launchArguments.append("--disable-animations")
        app.launchArguments.append("--reset-auth")
        if let apiBaseURL = ProcessInfo.processInfo.environment["E2E_API_BASE_URL"], !apiBaseURL.isEmpty {
            app.launchEnvironment["E2E_API_BASE_URL"] = apiBaseURL
        }
        app.launch()
        defer { app.terminate() }

        let email = ProcessInfo.processInfo.environment["E2E_EMAIL"] ?? ""
        let password = ProcessInfo.processInfo.environment["E2E_PASSWORD"] ?? ""
        guard !email.isEmpty, !password.isEmpty else {
            throw XCTSkip("E2E_EMAIL and E2E_PASSWORD are required for macOS UI smoke tests")
        }

        let emailField = app.textFields["login_email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 10))
        emailField.tap()
        emailField.typeText(email)

        let passwordField = app.secureTextFields["login_password"]
        passwordField.tap()
        passwordField.typeText(password)

        app.buttons["login_submit"].tap()

        let homeTitle = app.staticTexts["Home"]
        XCTAssertTrue(
            homeTitle.waitForExistence(timeout: 20),
            "macOS app should reach the authenticated primary interface after login"
        )
    }
}
