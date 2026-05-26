import XCTest

final class AuthTests: AppUITestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments.append("--disable-animations")
        app.launchArguments.append("--use-userdefaults-auth")
        // Force logged-out state so the login screen is reachable.
        app.launchArguments.append("--reset-auth")
        app.launch()
    }

    // MARK: - Login

    func testAuthWelcomeScreenAppears() {
        XCTAssertTrue(app.buttons["auth_sign_in"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["auth_signup_free"].exists)
        XCTAssertTrue(app.buttons["auth_sign_in"].exists)
        XCTAssertTrue(app.buttons["auth_continue_without_login"].exists)
    }

    func testContinueWithoutLoginOpensAppShell() {
        let continueButton = app.buttons["auth_continue_without_login"]
        XCTAssertTrue(continueButton.waitForExistence(timeout: 10))
        continueButton.tap()

        XCTAssertTrue(waitForLoggedIn(timeout: 10), "Guest mode should enter the main app shell")
        XCTAssertFalse(app.buttons["auth_sign_in"].exists)
    }

    #if os(iOS)
    func testGuestCanCreateLocalPackAndKeepItAfterRelaunch() {
        let continueButton = app.buttons["auth_continue_without_login"]
        XCTAssertTrue(continueButton.waitForExistence(timeout: 10))
        continueButton.tap()
        XCTAssertTrue(waitForLoggedIn(timeout: 10), "Guest mode should enter the main app shell")

        let packName = uniqueName("Guest Offline Pack")
        createGuestPack(named: packName)

        app.terminate()
        app = XCUIApplication()
        app.launchArguments.append("--disable-animations")
        app.launchArguments.append("--use-userdefaults-auth")
        app.launch()

        XCTAssertTrue(waitForLoggedIn(timeout: 10), "Guest mode should be remembered after relaunch")
        goToTab("Packs")
        XCTAssertTrue(
            app.staticTexts[packName].waitForExistence(timeout: 10),
            "Locally created guest pack must persist across relaunch"
        )
    }

    func testGuestSeesNativeSignInStateForAccountBackedFeatures() {
        let continueButton = app.buttons["auth_continue_without_login"]
        XCTAssertTrue(continueButton.waitForExistence(timeout: 10))
        continueButton.tap()
        XCTAssertTrue(waitForLoggedIn(timeout: 10), "Guest mode should enter the main app shell")

        goToHomeAction("Community Feed")

        XCTAssertTrue(
            app.staticTexts["Sign In to View the Feed"].waitForExistence(timeout: 10),
            "Guest-only account-backed screens should show a native sign-in state instead of a network error"
        )
        XCTAssertFalse(app.buttons["Try Again"].exists)
    }

    func testGuestSeesNativeSignInStateForAITools() {
        let continueButton = app.buttons["auth_continue_without_login"]
        XCTAssertTrue(continueButton.waitForExistence(timeout: 10))
        continueButton.tap()
        XCTAssertTrue(waitForLoggedIn(timeout: 10), "Guest mode should enter the main app shell")

        goToTab("Assistant")
        XCTAssertTrue(app.staticTexts["Sign In to Use Assistant"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["Try Again"].exists)

        goToHomeAction("Season Suggestions")
        XCTAssertTrue(app.staticTexts["Sign In for Season Suggestions"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["Try Again"].exists)
        app.buttons["Done"].tapIfExists()

        goToHomeAction("Wildlife ID")
        XCTAssertTrue(app.staticTexts["Sign In to Identify Wildlife"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["Try Again"].exists)
    }
    #endif

    func testLoginScreenAppears() {
        openLogin()
        // Before auth, the login form must be visible
        XCTAssertTrue(app.textFields["login_email"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.secureTextFields["login_password"].exists)
        XCTAssertTrue(app.buttons["login_submit"].exists)
        XCTAssertTrue(app.buttons["forgot_password_link"].exists)
        XCTAssertTrue(app.buttons["auth_google"].exists)
        #if os(iOS)
        XCTAssertTrue(app.buttons["auth_apple"].exists)
        #endif
    }

    func testLoginWithBadCredentialShowsError() {
        openLogin()
        let emailField = app.textFields["login_email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 10))
        emailField.tap()
        emailField.typeText("notauser@invalid.test")

        let passwordField = app.secureTextFields["login_password"]
        passwordField.tap()
        passwordField.typeText("wrongpassword")

        let submit = app.buttons["login_submit"]
        XCTAssertTrue(submit.isEnabled, "Login submit should be enabled after filling both fields")
        submitLoginForm()

        // Invalid credentials must not transition into the authenticated shell.
        XCTAssertFalse(waitForLoggedIn(timeout: 5))
        XCTAssertTrue(app.textFields["login_email"].exists, "Login form should still be visible")
    }

    func testLoginButtonDisabledWithEmptyFields() {
        openLogin()
        XCTAssertTrue(app.textFields["login_email"].waitForExistence(timeout: 10))
        // Both fields empty → button disabled
        XCTAssertFalse(app.buttons["login_submit"].isEnabled)

        app.textFields["login_email"].tap()
        app.textFields["login_email"].typeText("a@b.com")
        // Only email filled → still disabled
        XCTAssertFalse(app.buttons["login_submit"].isEnabled)
    }

    func testNavigateToRegisterAndBack() {
        XCTAssertTrue(app.buttons["auth_signup_free"].waitForExistence(timeout: 10))

        let signUpButton = app.buttons["auth_signup_free"]
        XCTAssertTrue(signUpButton.waitForExistence(timeout: 5))
        signUpButton.tap()

        // Register form should appear
        XCTAssertTrue(app.textFields["register_first_name"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.textFields["register_email"].exists)
        XCTAssertTrue(app.secureTextFields["register_password"].exists)
        XCTAssertTrue(app.buttons["register_submit"].exists)

        // Tap "Already have an account" back link
        let loginLink = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Sign In' OR label CONTAINS 'Log In' OR label CONTAINS 'account'")).firstMatch
        loginLink.tapIfExists()

        XCTAssertTrue(app.textFields["login_email"].waitForExistence(timeout: 5))
    }

    func testForgotPasswordFlowNavigation() {
        openLogin()
        app.buttons["forgot_password_link"].tap()

        XCTAssertTrue(app.textFields["forgot_password_email"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["forgot_password_submit"].exists)
        XCTAssertFalse(app.buttons["forgot_password_submit"].isEnabled)

        app.textFields["forgot_password_email"].tap()
        app.textFields["forgot_password_email"].typeText("reset@example.com")
        XCTAssertTrue(app.buttons["forgot_password_submit"].isEnabled)

        app.buttons["forgot_password_back"].tap()
        XCTAssertTrue(app.textFields["login_email"].waitForExistence(timeout: 5))
    }

    func testSuccessfulLogin() throws {
        // Credentials come from this test bundle's Info.plist (populated at build
        // time from xcodebuild PACKRAT_E2E_* build settings). Same source the
        // AppUITestCase base class reads from. See AppUITestCase doc-header for
        // the full pipeline.
        let bundle = Bundle(for: AppUITestCase.self)
        let email = (bundle.object(forInfoDictionaryKey: "PACKRAT_E2E_EMAIL") as? String) ?? ""
        let password = (bundle.object(forInfoDictionaryKey: "PACKRAT_E2E_PASSWORD") as? String) ?? ""
        guard !email.isEmpty, !password.isEmpty else {
            throw XCTSkip(
                "PACKRAT_E2E_EMAIL / PACKRAT_E2E_PASSWORD must be passed as xcodebuild build settings — `bun e2e:swift` handles this automatically."
            )
        }

        let emailField = app.textFields["login_email"]
        openLogin()
        XCTAssertTrue(emailField.waitForExistence(timeout: 10))
        emailField.tap()
        emailField.typeText(email)

        let passwordField = app.secureTextFields["login_password"]
        passwordField.tap()
        passwordField.typeText(password)

        submitLoginForm()

        XCTAssertTrue(waitForLoggedIn(timeout: 20), "Logged-in landmark must appear after successful login")
        XCTAssertFalse(app.textFields["login_email"].exists, "Login form should be dismissed")
    }

    private func openLogin() {
        let signIn = app.buttons["auth_sign_in"]
        if signIn.waitForExistence(timeout: 10) {
            signIn.tap()
        }
    }

    #if os(iOS)
    private func createGuestPack(named name: String) {
        goToTab("Packs")
        waitFor(app.buttons["New Pack"].firstMatch).tap()

        let nameField = app.textFields["pack_name"].exists
            ? app.textFields["pack_name"]
            : app.textFields["Pack Name"]
        waitFor(nameField)
        nameField.tap()
        nameField.typeText(name)

        app.buttons["Create"].tap()
        waitFor(app.staticTexts[name], timeout: 10)
    }
    #endif
}
