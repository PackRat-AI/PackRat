import XCTest

// MARK: - Base class

/// Base class for all PackRat UI tests.
///
/// Credentials flow via xcodebuild build settings → this test bundle's static
/// Info.plist → `Bundle(for: AppUITestCase.self).infoDictionary`:
///
///   bun e2e:swift                   — reads E2E_EMAIL / E2E_PASSWORD from
///                                     .env.local and forwards as
///                                     PACKRAT_E2E_EMAIL / PACKRAT_E2E_PASSWORD
///                                     xcodebuild build-setting overrides.
///   project.yml                     — UITests target's `info.properties`
///                                     declares the keys with `$(VAR)` refs
///                                     that xcodebuild substitutes at build.
///   loginIfNeeded()                 — reads them at runtime via
///                                     Bundle(for: AppUITestCase.self).
///
/// No scheme injection, no .xctestplan env entries, no file patching. Run
/// directly via xcodebuild: `xcodebuild test ... PACKRAT_E2E_EMAIL=... PACKRAT_E2E_PASSWORD=...`.
class AppUITestCase: XCTestCase {
    var app: XCUIApplication!
    var additionalLaunchArguments: [String] { [] }

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        // Disable animations so tests don't have to wait for spring physics
        app.launchArguments.append("--disable-animations")
        // Avoid macOS Keychain access prompts when Xcode repeatedly rebuilds
        // and ad-hoc signs the test host during UI test runs.
        app.launchArguments.append("--use-userdefaults-auth")
        // Feature suites need a fresh auth decision. AuthTests overrides setup
        // for guest mode. Local API runs can provide the same derived E2E
        // bearer token accepted by the worker, avoiding brittle UI sign-in
        // while still exercising authenticated API routes.
        app.launchArguments.append("--reset-auth")
        // Feature suites are not login tests. Local API runs can opt into
        // deterministic seeded auth; deployed API runs must use real login so
        // TestFlight-style failures are visible in E2E and screenshots.
        if e2eLoginSeedAllowed {
            app.launchArguments.append("--allow-e2e-login-seed")
            app.launchEnvironment["PACKRAT_E2E_ALLOW_LOGIN_SEED"] = "1"
        }
        app.launchArguments.append(contentsOf: additionalLaunchArguments)
        if let apiBaseURL = ProcessInfo.processInfo.environment["E2E_API_BASE_URL"], !apiBaseURL.isEmpty {
            app.launchEnvironment["E2E_API_BASE_URL"] = apiBaseURL
        }
        injectE2EAuthEnvironment()
        let bundle = Bundle(for: AppUITestCase.self)
        let seededAuthEmail =
            ProcessInfo.processInfo.environment["PACKRAT_E2E_EMAIL"]
            ?? (bundle.object(forInfoDictionaryKey: "PACKRAT_E2E_EMAIL") as? String)
            ?? ""
        if e2eLoginSeedAllowed && !seededAuthEmail.isEmpty {
            let runnerEnvironment = ProcessInfo.processInfo.environment
            app.launchArguments.append("--seed-e2e-auth")
            app.launchEnvironment["PACKRAT_E2E_SESSION_TOKEN"] = runnerEnvironment["PACKRAT_E2E_SESSION_TOKEN"]
                ?? (bundle.object(forInfoDictionaryKey: "PACKRAT_E2E_SESSION_TOKEN") as? String)
                ?? ""
            app.launchEnvironment["PACKRAT_E2E_EMAIL"] = runnerEnvironment["PACKRAT_E2E_EMAIL"]
                ?? (bundle.object(forInfoDictionaryKey: "PACKRAT_E2E_EMAIL") as? String)
                ?? ""
            app.launchEnvironment["PACKRAT_E2E_USER_ID"] = runnerEnvironment["PACKRAT_E2E_USER_ID"]
                ?? (bundle.object(forInfoDictionaryKey: "PACKRAT_E2E_USER_ID") as? String)
                ?? ""
        }
        app.launch()
        #if os(macOS)
        app.activate()
        #endif
        try loginIfNeeded()
    }

    // MARK: - Login helper

    var e2eLoginSeedAllowed: Bool {
        let bundle = Bundle(for: AppUITestCase.self)
        let value = ProcessInfo.processInfo.environment["PACKRAT_E2E_ALLOW_LOGIN_SEED"]
            ?? (bundle.object(forInfoDictionaryKey: "PACKRAT_E2E_ALLOW_LOGIN_SEED") as? String)
            ?? ""
        return value == "1" || value.caseInsensitiveCompare("true") == .orderedSame
    }

    /// Best-effort cross-platform "is the user logged in?" detector.
    ///
    /// iOS: tab bar is the unmistakable signal. macOS uses a NavigationSplitView
    /// sidebar — looks for the "Home" sidebar entry by accessibility label.
    var isLoggedIn: Bool {
        #if os(iOS)
        return app.tabBars.firstMatch.waitForExistence(timeout: 2)
        #elseif os(macOS)
        // The macOS sidebar exposes nav rows as static texts with the section label.
        if app.staticTexts["Home"].waitForExistence(timeout: 2) { return true }
        return app.outlines.firstMatch.exists
        #else
        return false
        #endif
    }

    func loginIfNeeded() throws {
        // Already logged in from a previous test (app not relaunched between classes)
        if isLoggedIn { return }

        // Credentials flow via xcodebuild build settings (PACKRAT_E2E_EMAIL /
        // PACKRAT_E2E_PASSWORD passed on the CLI by `bun e2e:swift`) →
        // INFOPLIST_KEY_* in project.yml → this test bundle's Info.plist →
        // Bundle(for:) at runtime. No env-var or scheme injection involved.
        let bundle = Bundle(for: AppUITestCase.self)
        let email = (bundle.object(forInfoDictionaryKey: "PACKRAT_E2E_EMAIL") as? String) ?? ""
        let password = (bundle.object(forInfoDictionaryKey: "PACKRAT_E2E_PASSWORD") as? String) ?? ""

        guard !email.isEmpty, !password.isEmpty else {
            throw XCTSkip(
                "PACKRAT_E2E_EMAIL / PACKRAT_E2E_PASSWORD must be passed as xcodebuild build settings — `bun e2e:swift` handles this automatically."
            )
        }

        let signIn = app.buttons["auth_sign_in"]
        if signIn.waitForExistence(timeout: 3) {
            signIn.tap()
        }

        let emailField = app.textFields["login_email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 10), "Login screen must appear")

        emailField.tap()
        emailField.typeText(email)

        let passwordField = app.secureTextFields["login_password"]
        passwordField.tap()
        passwordField.typeText(password)

        submitLoginForm()

        let loggedIn = waitForLoggedIn(timeout: 20)
        XCTAssertTrue(
            loggedIn,
            "Logged-in landmark must appear after login — \(visibleLoginFailureMessage())"
        )
    }

    private func injectE2EAuthEnvironment() {
        let bundle = Bundle(for: AppUITestCase.self)
        let runnerEnvironment = ProcessInfo.processInfo.environment
        app.launchEnvironment["PACKRAT_E2E_EMAIL"] = runnerEnvironment["PACKRAT_E2E_EMAIL"]
            ?? (bundle.object(forInfoDictionaryKey: "PACKRAT_E2E_EMAIL") as? String)
            ?? ""
        app.launchEnvironment["PACKRAT_E2E_PASSWORD"] = runnerEnvironment["PACKRAT_E2E_PASSWORD"]
            ?? (bundle.object(forInfoDictionaryKey: "PACKRAT_E2E_PASSWORD") as? String)
            ?? ""
        app.launchEnvironment["PACKRAT_E2E_SESSION_TOKEN"] = runnerEnvironment["PACKRAT_E2E_SESSION_TOKEN"]
            ?? (bundle.object(forInfoDictionaryKey: "PACKRAT_E2E_SESSION_TOKEN") as? String)
            ?? ""
        app.launchEnvironment["PACKRAT_E2E_USER_ID"] = runnerEnvironment["PACKRAT_E2E_USER_ID"]
            ?? (bundle.object(forInfoDictionaryKey: "PACKRAT_E2E_USER_ID") as? String)
            ?? ""
        if e2eLoginSeedAllowed {
            app.launchEnvironment["PACKRAT_E2E_ALLOW_LOGIN_SEED"] = "1"
        }
    }

    func submitLoginForm() {
        let submitButton = app.buttons["login_submit"]
        XCTAssertTrue(submitButton.waitForExistence(timeout: 5), "Login submit button must be visible")
        XCTAssertTrue(submitButton.isEnabled, "Login submit button must be enabled after credentials are filled")
        #if os(macOS)
        // macOS can show a password/autofill popover over the submit button
        // after typing into SecureField. Escape dismisses it before tapping.
        app.typeText("\u{1b}")
        submitButton.tap()
        #else
        if submitButton.isHittable {
            submitButton.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
            Thread.sleep(forTimeInterval: 0.25)
            if submitButton.exists, submitButton.isHittable, submitButton.isEnabled {
                submitButton.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
            }
        } else {
            let goButton = app.keyboards.buttons["Go"]
            let returnButton = app.keyboards.buttons["Return"]
            if goButton.waitForExistence(timeout: 1) {
                goButton.tap()
            } else if returnButton.waitForExistence(timeout: 1) {
                returnButton.tap()
            } else {
                submitButton.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
            }
        }
        #endif
    }

    func visibleLoginFailureMessage() -> String {
        let loginError = app.staticTexts["login_error"]
        if loginError.exists, !loginError.label.isEmpty {
            return "visible login error: \(loginError.label)"
        }

        let inlineError = app.staticTexts["inline_error"]
        if inlineError.exists, !inlineError.label.isEmpty {
            return "visible inline error: \(inlineError.label)"
        }

        return "no visible login error"
    }

    /// Cross-platform "is the user logged in NOW?" wait with an explicit timeout.
    /// Distinct from `isLoggedIn` (which has a short fixed wait) so login flow
    /// can wait longer than the warm-cache short-circuit check.
    @discardableResult
    func waitForLoggedIn(timeout: TimeInterval) -> Bool {
        #if os(iOS)
        return app.tabBars.firstMatch.waitForExistence(timeout: timeout)
        #elseif os(macOS)
        return app.outlines["app_sidebar"].waitForExistence(timeout: timeout)
            || app.otherElements["app_navigation"].waitForExistence(timeout: 1)
            || app.staticTexts["Home"].waitForExistence(timeout: 1)
            || app.outlines.firstMatch.waitForExistence(timeout: 1)
        #else
        return false
        #endif
    }

    // MARK: - Navigation helpers

    #if os(macOS)
    /// Navigates to a sidebar entry by label on macOS. The NavigationSplitView
    /// sidebar is a SwiftUI `List` of `Label(...)` rows — each row's accessibility
    /// label is the NavItem label. They surface as both `staticTexts` and rows
    /// inside `outlines`; this helper tries both.
    func goToSidebar(_ label: String) {
        app.activate()
        app.typeKey(XCUIKeyboardKey.escape.rawValue, modifierFlags: [])

        let identifierByLabel: [String: String] = [
            "Home": "nav_home",
            "Packs": "nav_packs",
            "Trips": "nav_trips",
            "Weather": "nav_weather",
            "Assistant": "nav_chat",
            "Catalog": "nav_catalog",
            "Templates": "nav_templates",
            "Trail Conditions": "nav_trailConditions",
            "Feed": "nav_feed",
            "Guides": "nav_guides",
            "Gear Inventory": "nav_gearInventory",
            "Wildlife": "nav_wildlife",
            "AI Packs": "nav_aiPacks",
        ]
        if let identifier = identifierByLabel[label] {
            let identifiedButton = app.buttons[identifier]
            if identifiedButton.waitForExistence(timeout: 3) {
                if identifiedButton.isHittable {
                    identifiedButton.tap()
                } else {
                    identifiedButton.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).click()
                }
                return
            }
        }

        // Try the outline (the macOS NavigationSplitView sidebar is rendered as
        // an outline view). Iterate outline rows looking for one whose label
        // matches.
        let identifiedOutline = app.outlines["app_sidebar"]
        let outline = identifiedOutline.exists ? identifiedOutline : app.outlines.firstMatch
        if outline.waitForExistence(timeout: 5) {
            let outlineRow = outline.staticTexts[label]
            if outlineRow.waitForExistence(timeout: 2) {
                if outlineRow.isHittable {
                    outlineRow.tap()
                } else {
                    outlineRow.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).click()
                }
                return
            }
        }
        // Fallback: the first staticText match in the whole window. The sidebar
        // appears in the leading column and is the most likely target.
        let any = app.staticTexts[label]
        XCTAssertTrue(
            any.waitForExistence(timeout: 5),
            "Sidebar entry '\(label)' not found in macOS sidebar"
        )
        if any.isHittable {
            any.tap()
        } else {
            any.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).click()
        }
    }
    #endif

    #if os(iOS)
    /// Navigates to a primary tab by label. Secondary feature destinations are
    /// intentionally exposed from Home rather than the iPhone tab bar.
    func goToTab(_ label: String) {
        // Dismiss any active keyboard / search focus that could obstruct
        // tab bar interaction.
        if app.keyboards.firstMatch.exists {
            app.buttons["Cancel"].tapIfExists()
            let close = app.buttons["Close"]
            if close.exists { close.tap() }
        }

        let direct = app.tabBars.buttons[label]
        if direct.waitForExistence(timeout: 5) {
            tapTabBarButton(direct)
            return
        }

        let homeActionByLegacyTab: [String: String] = [
            "Catalog": "Catalog",
            "Feed": "Community Feed",
            "Gear Inventory": "Gear Inventory",
            "Guides": "Guides",
            "Templates": "Pack Templates",
            "Pack Templates": "Pack Templates",
            "Season Suggestions": "Season Suggestions",
            "Trail Conditions": "Trail Conditions",
            "Weather": "Weather",
            "Wildlife ID": "Wildlife ID",
        ]
        if let homeAction = homeActionByLegacyTab[label] {
            goToTab("Home")
            tapHomeAction(homeAction)
            return
        }

        let moreButton = app.tabBars.buttons["More"]
        if moreButton.waitForExistence(timeout: 3) {
            moreButton.tap()
            // The More list is a CollectionView (iOS 16+), but the cell's
            // static text is queryable directly from app.staticTexts.
            let cell = app.collectionViews.staticTexts[label]
            if cell.waitForExistence(timeout: 3) {
                cell.tap()
                return
            }
            let fallback = app.staticTexts[label]
            if fallback.waitForExistence(timeout: 2) {
                fallback.tap()
                return
            }
        }

        XCTFail("Primary tab '\(label)' not found in tab bar")
    }

    func goToHomeAction(_ title: String) {
        goToTab("Home")
        tapHomeAction(title)
    }

    private func tapHomeAction(_ title: String) {
        let identifier = "home_action_\(title.lowercased().filter { $0.isLetter || $0.isNumber })"
        let action = app.buttons[identifier]

        for _ in 0..<6 {
            if action.waitForExistence(timeout: 1), action.isHittable, isSafelyVisibleAboveTabBar(action) {
                action.tap()
                return
            }
            app.swipeUp()
        }

        XCTAssertTrue(action.waitForExistence(timeout: 2), "Home action '\(title)' must exist")
        if action.isHittable {
            action.tap()
        } else {
            action.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
    }

    private func isSafelyVisibleAboveTabBar(_ element: XCUIElement) -> Bool {
        let tabBarTop = app.tabBars.firstMatch.exists ? app.tabBars.firstMatch.frame.minY : app.frame.maxY
        return element.frame.minY >= 0 && element.frame.maxY <= tabBarTop - 12
    }

    private func tapTabBarButton(_ element: XCUIElement) {
        let frame = element.frame
        guard frame.width > 0, frame.height > 0 else {
            element.tap()
            return
        }
        let coordinate = app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))
            .withOffset(CGVector(dx: frame.midX, dy: frame.midY))
        coordinate.tap()
        Thread.sleep(forTimeInterval: 0.35)
        coordinate.tap()
    }
    #endif

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

    func waitForStaticText(containing text: String, timeout: TimeInterval = 10) -> Bool {
        let predicate = NSPredicate { [weak self] _, _ in
            guard let self else { return false }
            return self.app.staticTexts.allElementsBoundByIndex.contains { element in
                element.exists && element.label.localizedCaseInsensitiveContains(text)
            }
        }
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: nil)
        return XCTWaiter.wait(for: [expectation], timeout: timeout) == .completed
    }

    func waitForElement(identifier: String, containing text: String, timeout: TimeInterval = 10) -> Bool {
        let predicate = NSPredicate { [weak self] _, _ in
            guard let self else { return false }
            return self.app.descendants(matching: .any).matching(identifier: identifier)
                .allElementsBoundByIndex
                .contains { element in
                    element.exists && element.label.localizedCaseInsensitiveContains(text)
                }
        }
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: nil)
        return XCTWaiter.wait(for: [expectation], timeout: timeout) == .completed
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
        "\(prefix) \(Int(Date().timeIntervalSince1970 * 1000))-\(UUID().uuidString.prefix(6))"
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
            if text.isEmpty {
                #if os(iOS)
                typeText(XCUIKeyboardKey.delete.rawValue)
                #else
                typeText("\u{8}")
                #endif
                return
            }
        } else {
            // Fallback: move to the visible end and backspace generously.
            coordinate(withNormalizedOffset: CGVector(dx: 0.96, dy: 0.5)).tap()
            // XCUIKeyboardKey.delete only exists on iOS; on macOS we use "\u{8}" (backspace).
            let deleteCount = max(existing.count, 256)
            #if os(iOS)
            let deleteString = String(repeating: XCUIKeyboardKey.delete.rawValue, count: deleteCount)
            #else
            let deleteString = String(repeating: "\u{8}", count: deleteCount)
            #endif
            typeText(deleteString)
        }
        typeText(text)
    }

    /// Taps the element only if it exists; silently skips otherwise.
    func tapIfExists() {
        if exists { tap() }
    }
}
