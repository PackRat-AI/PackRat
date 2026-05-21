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

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        // Disable animations so tests don't have to wait for spring physics
        app.launchArguments.append("--disable-animations")
        app.launch()
        try loginIfNeeded()
    }

    // MARK: - Login helper

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

        let emailField = app.textFields["login_email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 10), "Login screen must appear")

        emailField.tap()
        emailField.typeText(email)

        let passwordField = app.secureTextFields["login_password"]
        passwordField.tap()
        passwordField.typeText(password)

        app.buttons["login_submit"].tap()

        XCTAssertTrue(
            waitForLoggedIn(timeout: 20),
            "Logged-in landmark must appear after login — check credentials or network"
        )
    }

    /// Cross-platform "is the user logged in NOW?" wait with an explicit timeout.
    /// Distinct from `isLoggedIn` (which has a short fixed wait) so login flow
    /// can wait longer than the warm-cache short-circuit check.
    @discardableResult
    func waitForLoggedIn(timeout: TimeInterval) -> Bool {
        #if os(iOS)
        return app.tabBars.firstMatch.waitForExistence(timeout: timeout)
        #elseif os(macOS)
        return app.staticTexts["Home"].waitForExistence(timeout: timeout)
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
        // Try the outline (the macOS NavigationSplitView sidebar is rendered as
        // an outline view). Iterate outline rows looking for one whose label
        // matches.
        let outline = app.outlines.firstMatch
        if outline.waitForExistence(timeout: 5) {
            let outlineRow = outline.staticTexts[label]
            if outlineRow.waitForExistence(timeout: 2) {
                outlineRow.tap()
                return
            }
            // Some labels are exposed at the cell level rather than the static
            // text level; try outline cells directly.
            let cell = outline.cells.containing(.staticText, identifier: label).firstMatch
            if cell.exists {
                cell.tap()
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
        any.tap()
    }
    #endif

    #if os(iOS)
    /// Navigates to a tab by label. iOS shows the first 4 NavItems as tabs and
    /// the rest behind a "More" overflow tab — this helper handles both cases.
    func goToTab(_ label: String) {
        // Dismiss any active keyboard / search focus that could obstruct
        // tab bar interaction.
        if app.keyboards.firstMatch.exists {
            app.buttons["Cancel"].tapIfExists()
            let close = app.buttons["Close"]
            if close.exists { close.tap() }
        }

        let direct = app.tabBars.buttons[label]
        if direct.exists {
            direct.tap()
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

        XCTAssertTrue(
            direct.waitForExistence(timeout: 5),
            "Tab '\(label)' not found in tab bar or More overflow"
        )
        direct.tap()
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
            // Fallback: move to end and backspace.
            // XCUIKeyboardKey.delete only exists on iOS; on macOS we use "\u{8}" (backspace).
            #if os(iOS)
            let deleteString = String(repeating: XCUIKeyboardKey.delete.rawValue, count: existing.count)
            #else
            let deleteString = String(repeating: "\u{8}", count: existing.count)
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
