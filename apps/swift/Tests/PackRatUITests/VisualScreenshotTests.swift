import XCTest

final class VisualScreenshotTests: XCTestCase {
    private var app: XCUIApplication!
    private var screenshotDirectory: URL!

    override var executionTimeAllowance: TimeInterval {
        get { 10 * 60 }
        set { _ = newValue }
    }

    override func setUpWithError() throws {
        continueAfterFailure = false
        let bundle = Bundle(for: VisualScreenshotTests.self)
        let environmentDirectory = ProcessInfo.processInfo.environment["PACKRAT_SCREENSHOT_DIR"] ?? ""
        let bundleDirectory = (bundle.object(forInfoDictionaryKey: "PACKRAT_SCREENSHOT_DIR") as? String) ?? ""
        let directory = environmentDirectory.isEmpty ? bundleDirectory : environmentDirectory
        guard !directory.isEmpty else {
            throw XCTSkip("Set PACKRAT_SCREENSHOT_DIR to enable visual screenshot capture.")
        }

        screenshotDirectory = URL(fileURLWithPath: directory, isDirectory: true)
        try? FileManager.default.createDirectory(
            at: screenshotDirectory,
            withIntermediateDirectories: true
        )

        launchLoggedOut()
    }

    func testGuestVisualSurface() throws {
        capture("00-unauth-welcome")
        captureRegisterAndLoginStates()
        enterGuestMode()
        capture("03-guest-home")

        #if os(iOS)
        capturePhoneSurface(mode: .guest)
        #elseif os(macOS)
        captureMacSurface(mode: .guest)
        #endif
    }

    func testGuestModalSurface() throws {
        enterGuestMode()

        #if os(iOS)
        capturePhoneModalSurface(mode: .guest)
        #elseif os(macOS)
        captureMacModalSurface(mode: .guest)
        #endif
    }

    func testAuthenticatedVisualSurface() throws {
        try signIn()
        capture("20-auth-home")

        #if os(iOS)
        capturePhoneSurface(mode: .authenticated)
        #elseif os(macOS)
        captureMacSurface(mode: .authenticated)
        #endif
    }

    func testAuthenticatedModalSurface() throws {
        try signIn()

        #if os(iOS)
        capturePhoneModalSurface(mode: .authenticated)
        #elseif os(macOS)
        captureMacModalSurface(mode: .authenticated)
        #endif
    }

    private func captureRegisterAndLoginStates() {
        if app.buttons["auth_signup_free"].waitForExistence(timeout: 5) {
            app.buttons["auth_signup_free"].tap()
            capture("01-unauth-register")
            restartLoggedOut()
        }

        if app.buttons["auth_sign_in"].waitForExistence(timeout: 5) {
            app.buttons["auth_sign_in"].tap()
            capture("02-unauth-login")
            if app.buttons["forgot_password_link"].waitForExistence(timeout: 3) {
                app.buttons["forgot_password_link"].tap()
                capture("02a-unauth-forgot-password")
            }
            restartLoggedOut()
        }
    }

    private func enterGuestMode() {
        let guestButton = app.buttons["auth_continue_without_login"]
        XCTAssertTrue(guestButton.waitForExistence(timeout: 10))
        guestButton.tap()

        #if os(iOS)
        XCTAssertTrue(app.tabBars.firstMatch.waitForExistence(timeout: 10))
        #elseif os(macOS)
        XCTAssertTrue(app.buttons["nav_home"].waitForExistence(timeout: 10))
        #endif
    }

    #if os(iOS)
    private func capturePhoneSurface(mode: VisualMode) {
        let prefix = mode.prefix
        let suffix = mode.suffix
        captureTab("Packs", name: "\(prefix)-packs\(suffix)")
        captureTab("Trips", name: "\(prefix)-trips\(suffix)")
        captureTab("Assistant", name: "\(prefix)-assistant\(suffix)")

        captureHomeAction("Gear Inventory", name: "\(prefix)-gear-inventory\(suffix)")
        captureHomeAction("Season Suggestions", name: "\(prefix)-season-suggestions\(suffix)")
        captureHomeAction("Pack Templates", name: "\(prefix)-pack-templates\(suffix)")
        captureHomeAction("Guides", name: "\(prefix)-guides\(suffix)")
        captureHomeAction("Catalog", name: "\(prefix)-catalog\(suffix)")
        captureHomeAction("Community Feed", name: "\(prefix)-feed\(suffix)")
        captureHomeAction("Trail Conditions", name: "\(prefix)-trail-conditions\(suffix)")
        captureHomeAction("Weather", name: "\(prefix)-weather\(suffix)")
        captureHomeAction("Wildlife ID", name: "\(prefix)-wildlife\(suffix)")
    }

    private func capturePhoneModalSurface(mode: VisualMode) {
        let prefix = mode.modalPrefix
        captureGlobalSearch(name: "\(prefix)-global-search")
        if mode == .guest {
            restartLoggedOut()
            enterGuestMode()
        }

        captureTab("Packs", name: "\(prefix)-packs-before-new-pack")
        tapAndCapture(button: "New Pack", name: "\(prefix)-new-pack-sheet")

        captureTab("Trips", name: "\(prefix)-trips-before-new-trip")
        tapAndCapture(button: "Plan Trip", name: "\(prefix)-new-trip-sheet")

        captureHomeAction("Pack Templates", name: "\(prefix)-templates-before-new-template")
        tapAndCapture(button: "New Template", name: "\(prefix)-new-template-sheet")

        captureHomeAction("Trail Conditions", name: "\(prefix)-trail-conditions-before-submit")
        tapAndCapture(button: "Submit Report", name: "\(prefix)-trail-report-sheet")

        captureHomeAction("Weather", name: "\(prefix)-weather-before-alerts")
        tapAndCapture(identifier: "weather_alerts_button", name: "\(prefix)-weather-alerts-sheet")

        if mode == .authenticated {
            captureHomeAction("Community Feed", name: "\(prefix)-feed-before-compose")
            tapAndCapture(button: "New Post", name: "\(prefix)-feed-compose-sheet")
        }
    }

    private func captureTab(_ label: String, name: String) {
        let tab = app.tabBars.buttons[label]
        if tab.waitForExistence(timeout: 5) {
            tab.tap()
            capture(name)
        }
    }

    private func captureHomeAction(_ title: String, name: String) {
        captureTab("Home", name: "home-before-\(name)")

        let identifier = "home_action_\(title.lowercased().filter { $0.isLetter || $0.isNumber })"
        let action = app.buttons[identifier]

        for _ in 0..<8 {
            if action.exists, action.isHittable {
                action.tap()
                capture(name)
                dismissPhoneDestination()
                return
            }
            app.swipeUp()
        }
    }

    private func dismissPhoneDestination() {
        if app.buttons["Done"].exists {
            app.buttons["Done"].tap()
        } else if app.navigationBars.buttons.firstMatch.exists {
            app.navigationBars.buttons.firstMatch.tap()
        }
    }
    #endif

    #if os(macOS)
    private func captureMacSurface(mode: VisualMode) {
        let prefix = mode.prefix
        let suffix = mode.suffix
        let entries = [
            ("Home", "\(prefix)-home\(suffix)"),
            ("Packs", "\(prefix)-packs\(suffix)"),
            ("Trips", "\(prefix)-trips\(suffix)"),
            ("Weather", "\(prefix)-weather\(suffix)"),
            ("Assistant", "\(prefix)-assistant\(suffix)"),
            ("Catalog", "\(prefix)-catalog\(suffix)"),
            ("Templates", "\(prefix)-pack-templates\(suffix)"),
            ("Trail Conditions", "\(prefix)-trail-conditions\(suffix)"),
            ("Feed", "\(prefix)-feed\(suffix)"),
            ("Guides", "\(prefix)-guides\(suffix)"),
            ("Gear Inventory", "\(prefix)-gear-inventory\(suffix)"),
            ("Wildlife", "\(prefix)-wildlife\(suffix)"),
            ("AI Packs", "\(prefix)-ai-packs\(suffix)"),
        ]

        for (label, name) in entries {
            selectSidebar(label)
            capture(name)
        }
    }

    private func captureMacModalSurface(mode: VisualMode) {
        let prefix = mode.modalPrefix
        captureGlobalSearch(name: "\(prefix)-global-search")

        selectSidebar("Packs")
        tapAndCapture(button: "New Pack", name: "\(prefix)-new-pack-sheet")

        selectSidebar("Trips")
        tapAndCapture(button: "Plan Trip", name: "\(prefix)-new-trip-sheet")

        selectSidebar("Templates")
        tapAndCapture(button: "New Template", name: "\(prefix)-new-template-sheet")

        selectSidebar("Trail Conditions")
        tapAndCapture(button: "Submit Report", name: "\(prefix)-trail-report-sheet")

        selectSidebar("Weather")
        tapAndCapture(identifier: "weather_alerts_button", name: "\(prefix)-weather-alerts-sheet")

        if mode == .authenticated {
            selectSidebar("Feed")
            tapAndCapture(button: "New Post", name: "\(prefix)-feed-compose-sheet")
        }
    }

    private func selectSidebar(_ label: String) {
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
            let button = app.buttons[identifier]
            if button.waitForExistence(timeout: 5) {
                if button.isHittable {
                    button.tap()
                } else {
                    button.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).click()
                }
                return
            }
        }
    }
    #endif

    private func captureGlobalSearch(name: String) {
        #if os(macOS)
        app.typeKey("f", modifierFlags: [.command])
        #else
        captureTab("Home", name: "home-before-\(name)")
        app.buttons["Search"].tapIfExists()
        #endif
        capture(name)
        dismissPresentedSurface()
    }

    private func tapAndCapture(button label: String, name: String) {
        let button = app.buttons[label]
        guard button.waitForExistence(timeout: 3) else { return }
        if button.isHittable {
            button.tap()
        } else {
            activate(button)
        }
        capture(name)
        dismissPresentedSurface()
    }

    private func tapAndCapture(identifier: String, name: String) {
        let button = app.buttons[identifier]
        guard button.waitForExistence(timeout: 3) else { return }
        if button.isHittable {
            button.tap()
        } else {
            activate(button)
        }
        capture(name)
        dismissPresentedSurface()
    }

    private func activate(_ element: XCUIElement) {
        #if os(macOS)
        element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).click()
        #else
        element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        #endif
    }

    private func dismissPresentedSurface() {
        #if os(macOS)
        app.typeKey(XCUIKeyboardKey.escape.rawValue, modifierFlags: [])
        #endif
        for label in ["Cancel", "Done", "Close"] {
            let button = app.buttons[label]
            if button.exists {
                button.tap()
                return
            }
        }
        #if os(iOS)
        app.swipeDown()
        app.swipeDown()
        if app.navigationBars.buttons.firstMatch.exists {
            app.navigationBars.buttons.firstMatch.tap()
        }
        #endif
    }

    private func signIn() throws {
        let bundle = Bundle(for: VisualScreenshotTests.self)
        let email = (bundle.object(forInfoDictionaryKey: "PACKRAT_E2E_EMAIL") as? String) ?? ""
        let password = (bundle.object(forInfoDictionaryKey: "PACKRAT_E2E_PASSWORD") as? String) ?? ""
        guard !email.isEmpty, !password.isEmpty else {
            throw XCTSkip("PACKRAT_E2E_EMAIL / PACKRAT_E2E_PASSWORD are required for authenticated screenshots.")
        }

        let signIn = app.buttons["auth_sign_in"]
        XCTAssertTrue(signIn.waitForExistence(timeout: 10))
        signIn.tap()

        let emailField = app.textFields["login_email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 10))
        emailField.tap()
        emailField.typeText(email)

        let passwordField = app.secureTextFields["login_password"]
        passwordField.tap()
        passwordField.typeText(password)

        #if os(macOS)
        app.typeText("\u{1b}")
        #endif
        app.buttons["login_submit"].tap()

        guard waitForAuthenticatedShell() else {
            capture("20-auth-sign-in-blocked")
            throw XCTSkip("Authenticated visual surface unavailable: sign-in did not reach the app shell.")
        }
    }

    private func waitForAuthenticatedShell() -> Bool {
        #if os(iOS)
        return app.tabBars.firstMatch.waitForExistence(timeout: 20)
        #elseif os(macOS)
        return app.otherElements["app_navigation"].waitForExistence(timeout: 20)
            || app.outlines["app_sidebar"].waitForExistence(timeout: 1)
            || app.buttons["nav_home"].waitForExistence(timeout: 1)
        #endif
    }

    private func launchLoggedOut() {
        app = XCUIApplication()
        app.launchArguments = [
            "--disable-animations",
            "--use-userdefaults-auth",
            "--reset-auth",
        ]
        app.launchEnvironment["PACKRAT_VISUAL_SCREENSHOTS"] = "1"
        app.launch()
        #if os(macOS)
        app.activate()
        #endif
    }

    private func restartLoggedOut() {
        app.terminate()
        launchLoggedOut()
    }

    private func capture(_ name: String) {
        Thread.sleep(forTimeInterval: 0.35)
        let screenshot = app.screenshot()
        let url = screenshotDirectory.appendingPathComponent("\(name).png")
        try? screenshot.pngRepresentation.write(to: url, options: .atomic)

        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}

private enum VisualMode {
    case guest
    case authenticated

    var prefix: String {
        switch self {
        case .guest:
            return "10-guest"
        case .authenticated:
            return "30-auth"
        }
    }

    var suffix: String {
        switch self {
        case .guest:
            return "-guest"
        case .authenticated:
            return "-auth"
        }
    }

    var modalPrefix: String {
        switch self {
        case .guest:
            return "50-guest-modal"
        case .authenticated:
            return "60-auth-modal"
        }
    }
}
