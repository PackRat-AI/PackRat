import XCTest

final class AuthTests: AppUITestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments.append("--disable-animations")
        app.launchArguments.append("--use-userdefaults-auth")
        // Force logged-out state so the login screen is reachable.
        app.launchArguments.append("--reset-auth")
        if e2eLoginSeedAllowed {
            app.launchArguments.append("--allow-e2e-login-seed")
            app.launchEnvironment["PACKRAT_E2E_ALLOW_LOGIN_SEED"] = "1"
        }
        if let apiBaseURL = ProcessInfo.processInfo.environment["E2E_API_BASE_URL"], !apiBaseURL.isEmpty {
            app.launchEnvironment["E2E_API_BASE_URL"] = apiBaseURL
        }
        injectE2EAuthEnvironment()
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

        goToHomeAction("Pack Templates")

        expectGuestAuthwall(titled: "Sign In to Use Templates")

        app.buttons["Done"].tapIfExists()
        goToHomeAction("Catalog")
        expectGuestAuthwall(titled: "Sign In to Search Gear")

        app.buttons["Done"].tapIfExists()
        goToHomeAction("Weather")
        expectGuestAuthwall(titled: "Sign In for Weather")
    }

    func testGuestSeesNativeSignInStateForAITools() {
        let continueButton = app.buttons["auth_continue_without_login"]
        XCTAssertTrue(continueButton.waitForExistence(timeout: 10))
        continueButton.tap()
        XCTAssertTrue(waitForLoggedIn(timeout: 10), "Guest mode should enter the main app shell")

        goToTab("Assistant")
        expectGuestAuthwall(titled: "Sign In to Ask the Assistant")

        goToHomeAction("Season Suggestions")
        expectGuestAuthwall(titled: "Sign In for Season Suggestions")
        app.buttons["Done"].tapIfExists()

        if UITestFeatureFlags.enableWildlifeIdentification {
            goToHomeAction("Wildlife ID")
            expectGuestAuthwall(titled: "Sign In to Identify Wildlife")
        } else {
            goToTab("Home")
            XCTAssertFalse(app.buttons["home_action_wildlifeid"].waitForExistence(timeout: 2))
        }
    }
    #endif

    func testLoginScreenAppears() {
        openLogin()
        // Before auth, the login form must be visible
        XCTAssertTrue(app.textFields["login_email"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.secureTextFields["login_password"].exists)
        XCTAssertTrue(app.buttons["login_submit"].exists)
        XCTAssertTrue(app.buttons["forgot_password_link"].exists)
        // Sign in with Apple ships on both platforms — App Store guideline 4.8
        // requires it wherever a third-party login is offered.
        XCTAssertTrue(app.buttons["auth_apple"].exists)
        // Google is iOS-only: its SDK needs UIKit, so macOS offers email plus
        // Sign in with Apple instead.
        #if os(iOS)
        XCTAssertTrue(app.buttons["auth_google"].exists)
        #else
        XCTAssertFalse(app.buttons["auth_google"].exists)
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

        let loggedIn = waitForLoggedIn(timeout: 20)
        XCTAssertTrue(
            loggedIn,
            "Logged-in landmark must appear after successful login — \(visibleLoginFailureMessage())"
        )
        XCTAssertFalse(app.textFields["login_email"].exists, "Login form should be dismissed")
    }

    private func openLogin() {
        let signIn = app.buttons["auth_sign_in"]
        if signIn.waitForExistence(timeout: 10) {
            signIn.tap()
        }
    }

    private func injectE2EAuthEnvironment() {
        let bundle = Bundle(for: AppUITestCase.self)
        app.launchEnvironment["PACKRAT_E2E_EMAIL"] =
            (bundle.object(forInfoDictionaryKey: "PACKRAT_E2E_EMAIL") as? String) ?? ""
        app.launchEnvironment["PACKRAT_E2E_PASSWORD"] =
            (bundle.object(forInfoDictionaryKey: "PACKRAT_E2E_PASSWORD") as? String) ?? ""
        app.launchEnvironment["PACKRAT_E2E_SESSION_TOKEN"] =
            (bundle.object(forInfoDictionaryKey: "PACKRAT_E2E_SESSION_TOKEN") as? String) ?? ""
        app.launchEnvironment["PACKRAT_E2E_USER_ID"] =
            (bundle.object(forInfoDictionaryKey: "PACKRAT_E2E_USER_ID") as? String) ?? ""
        if e2eLoginSeedAllowed {
            app.launchEnvironment["PACKRAT_E2E_ALLOW_LOGIN_SEED"] = "1"
        }
    }

    /// Asserts a guest sees the native sign-in state on an account-backed
    /// screen, rather than a network error.
    ///
    /// Anchored on `guest_limited_state` / `guest_limited_sign_in` rather than
    /// the visible copy. These tests broke because the authwall titles were
    /// rewritten in e43fd07b1 and the assertions were not, so asserting the
    /// strings again would rebuild the same trap for the next rewrite; the house
    /// rule is to prefer app-controlled test IDs over visible text. The title is
    /// still checked, because the identifier alone cannot tell one screen's
    /// authwall from another's.
    ///
    /// The negative half asserts `connection_needed_state` is absent instead of
    /// a "Try Again" label: that label is a default argument
    /// (`retryTitle: String = "Try Again"`), so a rename would make a
    /// label-based assertion pass vacuously and quietly stop protecting the
    /// distinction this test exists to protect.
    private func expectGuestAuthwall(
        titled title: String,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertTrue(
            app.descendants(matching: .any)
                .matching(identifier: "guest_limited_state")
                .firstMatch
                .waitForExistence(timeout: 10),
            "\(title): a guest should get the native sign-in state, not a network error",
            file: file,
            line: line
        )
        XCTAssertTrue(
            app.staticTexts[title].exists,
            "\(title): the authwall should be the one belonging to this screen",
            file: file,
            line: line
        )
        XCTAssertTrue(
            app.buttons["guest_limited_sign_in"].exists,
            "\(title): the authwall should offer a way to sign in",
            file: file,
            line: line
        )
        XCTAssertFalse(
            app.descendants(matching: .any)
                .matching(identifier: "connection_needed_state")
                .firstMatch
                .exists,
            "\(title): a signed-out guest is not an offline device",
            file: file,
            line: line
        )
    }

    #if os(iOS)
    private func createGuestPack(named name: String) {
        goToTab("Packs")
        waitFor(app.buttons["New Pack"].firstMatch).tap()

        let nameField = app.textFields["pack_name"]
        waitFor(nameField)
        nameField.tap()
        nameField.typeText(name)

        app.buttons["Create"].tap()
        waitFor(app.staticTexts[name], timeout: 10)
    }
    #endif
}
