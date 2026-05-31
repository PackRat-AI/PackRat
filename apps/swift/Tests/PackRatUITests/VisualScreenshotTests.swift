import XCTest

final class VisualScreenshotTests: XCTestCase {
    private var app: XCUIApplication!
    private var screenshotDirectory: URL!

    private enum MacSurfaceScope {
        case all
        case primary
        case secondary
    }

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

        #if os(macOS)
        addUIInterruptionMonitor(withDescription: "System onboarding dialogs") { [weak self] interruption in
            self?.dismissInterruption(in: interruption) ?? false
        }
        #endif

        launchLoggedOut()
    }

    private var isPadVisualRun: Bool {
        #if os(iOS)
        ProcessInfo.processInfo.environment["PACKRAT_VISUAL_PLATFORM"] == "ipad"
            || screenshotDirectory?.path.contains("ipad") == true
        #else
        false
        #endif
    }

    func testGuestVisualSurface() throws {
        capture("00-unauth-welcome")
        captureRegisterAndLoginStates()
        enterGuestMode()
        capture("03-guest-home")

        #if os(iOS)
        isPadVisualRun ? captureMacSurface(mode: .guest) : capturePhoneCoreSurface(mode: .guest)
        #elseif os(macOS)
        captureMacSurface(mode: .guest, scope: .primary)
        #endif
    }

    #if os(macOS)
    func testGuestSecondaryVisualSurface() throws {
        enterGuestMode()
        captureMacSurface(mode: .guest, scope: .secondary)
    }
    #endif

    #if os(iOS)
    func testGuestPrimaryHomeActionVisualSurface() throws {
        if isPadVisualRun { throw XCTSkip("Compact Home action catalog is covered by iPhone; iPad uses sidebar visual coverage.") }
        enterGuestMode()
        capturePhoneHomeActionSurface(mode: .guest, actions: primaryPhoneHomeActions)
    }

    func testGuestExploreHomeActionVisualSurface() throws {
        if isPadVisualRun { throw XCTSkip("Compact Home action catalog is covered by iPhone; iPad uses sidebar visual coverage.") }
        enterGuestMode()
        capturePhoneHomeActionSurface(mode: .guest, actions: explorePhoneHomeActions)
    }

    func testGuestDeepHomeActionVisualSurface() throws {
        if isPadVisualRun { throw XCTSkip("Compact Home action catalog is covered by iPhone; iPad uses sidebar visual coverage.") }
        enterGuestMode()
        capturePhoneHomeActionSurface(mode: .guest, actions: deepPhoneHomeActions)
    }
    #endif

    func testGuestModalSurface() throws {
        enterGuestMode()

        #if os(iOS)
        isPadVisualRun ? captureMacModalSurface(mode: .guest) : capturePhoneModalCoreSurface(mode: .guest)
        #elseif os(macOS)
        captureMacModalSurface(mode: .guest)
        #endif
    }

    #if os(iOS)
    func testGuestPlanningModalSurface() throws {
        if isPadVisualRun { throw XCTSkip("Planning modals are covered by the iPad sidebar modal sweep.") }
        enterGuestMode()
        capturePhoneModalPlanningSurface(mode: .guest)
    }

    func testGuestConnectedModalSurface() throws {
        if isPadVisualRun { throw XCTSkip("Connected modals are covered by the iPad sidebar modal sweep.") }
        enterGuestMode()
        capturePhoneModalConnectedSurface(mode: .guest)
    }
    #endif

    func testAuthenticatedVisualSurface() throws {
        launchAuthenticated()
        capture("20-auth-home")

        #if os(iOS)
        isPadVisualRun ? captureMacSurface(mode: .authenticated) : capturePhoneCoreSurface(mode: .authenticated)
        #elseif os(macOS)
        captureMacSurface(mode: .authenticated, scope: .primary)
        #endif
    }

    #if os(macOS)
    func testAuthenticatedSecondaryVisualSurface() throws {
        launchAuthenticated()
        captureMacSurface(mode: .authenticated, scope: .secondary)
    }
    #endif

    #if os(iOS)
    func testAuthenticatedPrimaryHomeActionVisualSurface() throws {
        if isPadVisualRun { throw XCTSkip("Compact Home action catalog is covered by iPhone; iPad uses sidebar visual coverage.") }
        launchAuthenticated()
        capturePhoneHomeActionSurface(mode: .authenticated, actions: primaryPhoneHomeActions)
    }

    func testAuthenticatedExploreHomeActionVisualSurface() throws {
        if isPadVisualRun { throw XCTSkip("Compact Home action catalog is covered by iPhone; iPad uses sidebar visual coverage.") }
        launchAuthenticated()
        capturePhoneHomeActionSurface(mode: .authenticated, actions: explorePhoneHomeActions)
    }

    func testAuthenticatedDeepHomeActionVisualSurface() throws {
        if isPadVisualRun { throw XCTSkip("Compact Home action catalog is covered by iPhone; iPad uses sidebar visual coverage.") }
        launchAuthenticated()
        capturePhoneHomeActionSurface(mode: .authenticated, actions: deepPhoneHomeActions)
    }
    #endif

    func testAuthenticatedSampleDataVisualSurface() throws {
        launchAuthenticated(sampleData: true)
        capture("70-data-home")

        #if os(iOS)
        isPadVisualRun ? captureMacSurface(mode: .sampleData) : capturePhoneCoreSurface(mode: .sampleData)
        #elseif os(macOS)
        captureMacSurface(mode: .sampleData, scope: .primary)
        #endif
    }

    #if os(macOS)
    func testAuthenticatedSampleDataSecondaryVisualSurface() throws {
        launchAuthenticated(sampleData: true)
        captureMacSurface(mode: .sampleData, scope: .secondary)
    }
    #endif

    #if os(iOS)
    func testAuthenticatedSampleDataPrimaryHomeActionVisualSurface() throws {
        if isPadVisualRun { throw XCTSkip("Compact Home action catalog is covered by iPhone; iPad uses sidebar visual coverage.") }
        launchAuthenticated(sampleData: true)
        capturePhoneHomeActionSurface(mode: .sampleData, actions: primaryPhoneHomeActions)
    }

    func testAuthenticatedSampleDataExploreHomeActionVisualSurface() throws {
        if isPadVisualRun { throw XCTSkip("Compact Home action catalog is covered by iPhone; iPad uses sidebar visual coverage.") }
        launchAuthenticated(sampleData: true)
        capturePhoneHomeActionSurface(mode: .sampleData, actions: explorePhoneHomeActions)
    }

    func testAuthenticatedSampleDataDeepHomeActionVisualSurface() throws {
        if isPadVisualRun { throw XCTSkip("Compact Home action catalog is covered by iPhone; iPad uses sidebar visual coverage.") }
        launchAuthenticated(sampleData: true)
        capturePhoneHomeActionSurface(mode: .sampleData, actions: deepPhoneHomeActions)
    }
    #endif

    func testAuthenticatedSampleDataDetailSurface() throws {
        launchAuthenticated(sampleData: true)

        #if os(iOS)
        isPadVisualRun ? captureMacSampleDataDetails() : capturePhoneSampleDataDetails()
        #elseif os(macOS)
        captureMacSampleDataDetails()
        #endif
    }

    func testAuthenticatedModalSurface() throws {
        launchAuthenticated()

        #if os(iOS)
        isPadVisualRun ? captureMacModalSurface(mode: .authenticated) : capturePhoneModalCoreSurface(mode: .authenticated)
        #elseif os(macOS)
        captureMacModalSurface(mode: .authenticated)
        #endif
    }

    #if os(iOS)
    func testAuthenticatedPlanningModalSurface() throws {
        if isPadVisualRun { throw XCTSkip("Planning modals are covered by the iPad sidebar modal sweep.") }
        launchAuthenticated()
        capturePhoneModalPlanningSurface(mode: .authenticated)
    }

    func testAuthenticatedConnectedModalSurface() throws {
        if isPadVisualRun { throw XCTSkip("Connected modals are covered by the iPad sidebar modal sweep.") }
        launchAuthenticated()
        capturePhoneModalConnectedSurface(mode: .authenticated)
    }
    #endif

    func testAuthenticatedSampleDataModalSurface() throws {
        launchAuthenticated(sampleData: true)

        #if os(iOS)
        isPadVisualRun ? captureMacModalSurface(mode: .sampleData) : capturePhoneModalCoreSurface(mode: .sampleData)
        #elseif os(macOS)
        captureMacModalSurface(mode: .sampleData)
        #endif
    }

    #if os(iOS)
    func testAuthenticatedSampleDataPlanningModalSurface() throws {
        if isPadVisualRun { throw XCTSkip("Planning modals are covered by the iPad sidebar modal sweep.") }
        launchAuthenticated(sampleData: true)
        capturePhoneModalPlanningSurface(mode: .sampleData)
    }

    func testAuthenticatedSampleDataConnectedModalSurface() throws {
        if isPadVisualRun { throw XCTSkip("Connected modals are covered by the iPad sidebar modal sweep.") }
        launchAuthenticated(sampleData: true)
        capturePhoneModalConnectedSurface(mode: .sampleData)
    }
    #endif

    func testAuthenticatedSampleDataPackExpandedStateSurface() throws {
        launchAuthenticated(sampleData: true)

        #if os(iOS)
        isPadVisualRun ? captureMacExpandedPackStates() : capturePhoneExpandedPackStates()
        #elseif os(macOS)
        captureMacExpandedPackStates()
        #endif
    }

    func testAuthenticatedSampleDataPlanningExpandedStateSurface() throws {
        launchAuthenticated(sampleData: true)

        #if os(iOS)
        isPadVisualRun ? captureMacExpandedPlanningStates() : capturePhoneExpandedPlanningStates()
        #elseif os(macOS)
        captureMacExpandedPlanningStates(includeCatalog: false)
        #endif
    }

    #if os(macOS)
    func testAuthenticatedSampleDataCatalogExpandedStateSurface() throws {
        launchAuthenticated(sampleData: true)
        captureMacExpandedCatalogStates()
    }
    #endif

    func testAuthenticatedSampleDataConnectedExpandedStateSurface() throws {
        launchAuthenticated(sampleData: true)

        #if os(iOS)
        isPadVisualRun ? captureMacExpandedConnectedStates() : capturePhoneExpandedConnectedStates()
        #elseif os(macOS)
        captureMacExpandedConnectedStates()
        #endif
    }

    func testOfflineVisualSurface() throws {
        launchLoggedOut(forceOffline: true)
        enterGuestMode()
        capture("40-offline-guest-home")

        launchAuthenticated(forceOffline: true)
        capture("41-offline-auth-home")

        launchAuthenticated(sampleData: true, forceOffline: true)
        capture("42-offline-data-home")

        #if os(iOS)
        if isPadVisualRun {
            selectSidebar("Packs")
            capture("43-offline-data-packs")
            selectSidebar("Trips")
            capture("44-offline-data-trips")
            selectSidebar("Assistant")
            capture("45-offline-data-assistant")
            selectSidebar("Weather")
            capture("46-offline-data-weather")
        } else {
            captureTab("Packs", name: "43-offline-data-packs")
            captureTab("Trips", name: "44-offline-data-trips")
            captureTab("Assistant", name: "45-offline-data-assistant")
            captureHomeAction("Weather", name: "46-offline-data-weather")
        }
        #elseif os(macOS)
        selectSidebar("Packs")
        capture("43-offline-data-packs")
        selectSidebar("Trips")
        capture("44-offline-data-trips")
        selectSidebar("Assistant")
        capture("45-offline-data-assistant")
        selectSidebar("Weather")
        capture("46-offline-data-weather")
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
        if isPadVisualRun {
            XCTAssertTrue(app.buttons["nav_home"].waitForExistence(timeout: 10))
        } else {
            XCTAssertTrue(app.tabBars.firstMatch.waitForExistence(timeout: 10))
        }
        #elseif os(macOS)
        XCTAssertTrue(app.buttons["nav_home"].waitForExistence(timeout: 10))
        #endif
    }

    #if os(iOS)
    private func capturePhoneCoreSurface(mode: VisualMode) {
        let prefix = mode.prefix
        let suffix = mode.suffix
        captureTab("Packs", name: "\(prefix)-packs\(suffix)")
        captureTab("Trips", name: "\(prefix)-trips\(suffix)")
        captureTab("Assistant", name: "\(prefix)-assistant\(suffix)")
    }

    private typealias PhoneHomeActionScreenshot = (title: String, slug: String)

    private var primaryPhoneHomeActions: [PhoneHomeActionScreenshot] {
        [
            ("AI Packs", "ai-packs"),
            ("Gear Inventory", "gear-inventory"),
            ("Season Suggestions", "season-suggestions"),
            ("Pack Templates", "pack-templates"),
            ("Guides", "guides"),
        ]
    }

    private var explorePhoneHomeActions: [PhoneHomeActionScreenshot] {
        var actions: [PhoneHomeActionScreenshot] = [
            ("Catalog", "catalog"),
            ("Trail Conditions", "trail-conditions"),
            ("Weather", "weather"),
        ]
        if UITestFeatureFlags.enableFeed {
            actions.append(("Community Feed", "feed"))
        }
        if UITestFeatureFlags.enableShoppingList {
            actions.append(("Shopping List", "shopping-list"))
        }
        return actions
    }

    private var deepPhoneHomeActions: [PhoneHomeActionScreenshot] {
        UITestFeatureFlags.enableWildlifeIdentification ? [("Wildlife ID", "wildlife")] : []
    }

    private func capturePhoneHomeActionSurface(
        mode: VisualMode,
        actions: [PhoneHomeActionScreenshot]
    ) {
        let prefix = mode.prefix
        let suffix = mode.suffix
        for action in actions {
            captureHomeAction(action.title, name: "\(prefix)-\(action.slug)\(suffix)")
        }
    }

    private func capturePhoneModalSurface(mode: VisualMode) {
        capturePhoneModalCoreSurface(mode: mode)
        capturePhoneModalPlanningSurface(mode: mode)
        capturePhoneModalConnectedSurface(mode: mode)
    }

    private func capturePhoneModalCoreSurface(mode: VisualMode) {
        let prefix = mode.modalPrefix
        captureGlobalSearch(name: "\(prefix)-global-search", query: mode == .sampleData ? "Alpine" : nil)
        resetPhoneModalState(mode)

        captureTab("Packs", name: "\(prefix)-packs-before-new-pack")
        tapAndCapture(identifier: "packs_new_pack_button", fallbackButton: "New Pack", name: "\(prefix)-new-pack-sheet")

        resetPhoneModalState(mode)
        captureTab("Trips", name: "\(prefix)-trips-before-new-trip")
        tapAndCapture(identifier: "trips_plan_trip_button", fallbackButton: "Plan Trip", name: "\(prefix)-new-trip-sheet")
    }

    private func capturePhoneModalPlanningSurface(mode: VisualMode) {
        let prefix = mode.modalPrefix
        resetPhoneModalState(mode)
        if mode == .guest {
            captureGuestLimitedHomeAction("Pack Templates", name: "50-guest-limit-new-template")
        } else {
            captureHomeAction(
                "Pack Templates",
                name: "\(prefix)-templates-before-new-template",
                dismissAfterCapture: false,
                destinationIdentifier: "templates_new_template_button"
            )
            tapAndCapture(identifier: "templates_new_template_button", fallbackButton: "New Template", name: "\(prefix)-new-template-sheet")
        }

        resetPhoneModalState(mode)
        if mode == .guest {
            captureGuestLimitedHomeAction("Trail Conditions", name: "50-guest-limit-trail-report")
        } else {
            captureHomeAction(
                "Trail Conditions",
                name: "\(prefix)-trail-conditions-before-submit",
                dismissAfterCapture: false,
                destinationIdentifier: "trail_conditions_submit_report_button"
            )
            tapAndCapture(identifier: "trail_conditions_submit_report_button", fallbackButton: "Submit Report", name: "\(prefix)-trail-report-sheet")
        }
    }

    private func capturePhoneModalConnectedSurface(mode: VisualMode) {
        let prefix = mode.modalPrefix
        resetPhoneModalState(mode)
        captureHomeAction("Weather", name: "\(prefix)-weather-before-alerts", dismissAfterCapture: false)

        if mode != .guest && UITestFeatureFlags.enableFeed {
            resetPhoneModalState(mode)
            captureHomeAction(
                "Community Feed",
                name: "\(prefix)-feed-before-compose",
                dismissAfterCapture: false,
                destinationIdentifier: "feed_new_post_button"
            )
            tapAndCapture(identifier: "feed_new_post_button", fallbackButton: "New Post", name: "\(prefix)-feed-compose-sheet")
        }
    }

    private func capturePhoneSampleDataDetails() {
        captureTab("Packs", name: "71-data-packs-list")
        tapTextAndCapture("Alpine Weekend", name: "72-data-pack-detail")
        dismissPhoneDestination()

        captureTab("Trips", name: "73-data-trips-list")
        tapTextAndCapture("Enchantments Thru-Hike", name: "74-data-trip-detail")
        dismissPhoneDestination()

        captureHomeAction("Pack Templates", name: "75-data-templates-list", dismissAfterCapture: false)
        tapTextAndCapture("Weekend Backpacking", name: "76-data-template-detail")
        dismissPhoneDestination()

        captureHomeAction("Trail Conditions", name: "77-data-trail-conditions-list", dismissAfterCapture: false)
        tapTextAndCapture("Colchuck Lake Trail", name: "78-data-trail-condition-detail")
        dismissPhoneDestination()

        captureHomeAction("Catalog", name: "79-data-catalog-results")
    }

    private func capturePhoneExpandedPackStates() {
        captureTab("Packs", name: "home-before-81-data-pack-expanded")
        tapTextAndCapture("Alpine Weekend", name: "81-data-pack-detail-expanded")
        tapAndCapture(identifier: "pack_detail_add_item_button", fallbackButton: "Add Item", name: "82-data-pack-add-item-sheet")
        openMenuAndCapture(identifier: "pack_detail_more_menu", fallbackButton: "More", name: "83-data-pack-more-menu")
        captureTab("Packs", name: "home-before-84-data-pack-item-detail")
        tapTextAndCapture("Alpine Weekend", name: "84-data-pack-detail-before-item")
        scrollToElement(identifier: "pack_item_row_visual-item-shelter")
        tapElementAndCapture(identifier: "pack_item_row_visual-item-shelter", name: "84-data-pack-item-detail", dismissAfterCapture: false)
        tapAndCapture(identifier: "pack_item_detail_edit_button", fallbackButton: "Edit", name: "85-data-pack-item-edit-sheet")
        dismissPhoneDestination()
    }

    private func capturePhoneExpandedPlanningStates() {
        captureTab("Trips", name: "home-before-86-data-trip-expanded")
        tapTextAndCapture("Enchantments Thru-Hike", name: "86-data-trip-detail-expanded")
        tapAndCapture(identifier: "trip_detail_edit_button", fallbackButton: "Edit", name: "87-data-trip-edit-sheet")
        dismissPhoneDestination()

        captureHomeAction("Pack Templates", name: "home-before-88-data-template-expanded", dismissAfterCapture: false)
        tapTextAndCapture("Weekend Backpacking", name: "88-data-template-detail-expanded")
        tapAndCapture(button: "Apply to Pack", name: "89-data-template-apply-sheet")
        dismissPhoneDestination()

        captureHomeAction(
            "Catalog",
            name: "home-before-90-data-catalog-expanded",
            dismissAfterCapture: false,
            destinationIdentifier: "catalog_item_row_7001"
        )
        tapElementAndCapture(identifier: "catalog_item_row_7001", name: "90-data-catalog-item-detail", dismissAfterCapture: false)
        tapAndCapture(identifier: "catalog_detail_add_to_pack_button", fallbackButton: "Add to Pack", name: "91-data-catalog-add-to-pack-sheet")
        dismissPhoneDestination()
    }

    private func capturePhoneExpandedConnectedStates() {
        captureHomeAction(
            "Weather",
            name: "home-before-92-data-weather-expanded",
            dismissAfterCapture: false
        )
        tapAndCapture(identifier: "weather_alerts_button", fallbackButton: "Alerts", name: "92-data-weather-alerts-sheet")
        tapAndCapture(identifier: "weather_alert_preferences_button", fallbackButton: "Alert Preferences", name: "93-data-weather-alert-preferences")

        if UITestFeatureFlags.enableFeed {
            captureHomeAction(
                "Community Feed",
                name: "home-before-94-data-feed-expanded",
                dismissAfterCapture: false,
                destinationIdentifier: "feed_comments_button_9001"
            )
            tapElementAndCapture(identifier: "feed_comments_button_9001", name: "94-data-feed-comments-sheet")
        }

        captureHomeAction(
            "AI Packs",
            name: "home-before-95-data-ai-packs-expanded",
            dismissAfterCapture: false,
            destinationIdentifier: "ai_packs_generate_button"
        )
        scrollToElement(identifier: "ai_packs_view_results_button", maxSwipes: 3)
        tapAndCapture(identifier: "ai_packs_view_results_button", fallbackButton: "View", name: "95-data-ai-packs-results-sheet")
    }

    private func resetPhoneModalState(_ mode: VisualMode) {
        if mode == .guest {
            restartLoggedOut()
            enterGuestMode()
        } else {
            launchAuthenticated(sampleData: mode == .sampleData)
        }
    }

    private func captureTab(_ label: String, name: String) {
        let tab = app.tabBars.buttons[label]
        XCTAssertTrue(tab.waitForExistence(timeout: 5), "Expected tab '\(label)' for screenshot \(name)")
        tab.tap()
        capture(name)
    }

    private func captureHomeAction(
        _ title: String,
        name: String,
        dismissAfterCapture: Bool = true,
        destinationIdentifier: String? = nil
    ) {
        let baselineName = name.hasPrefix("home-before-") ? name : "home-before-\(name)"
        captureTab("Home", name: baselineName)

        let identifier = "home_action_\(title.lowercased().filter { $0.isLetter || $0.isNumber })"
        let action = app.buttons[identifier]
        var visibleCandidate: XCUIElement?

        if title == "Wildlife ID" {
            openHomeActionUsingSearch(title: title, identifier: identifier)
            capture(name)
            if dismissAfterCapture {
                dismissPhoneDestination()
            }
            return
        }

        for _ in 0..<12 {
            if action.exists {
                visibleCandidate = action
            }
            if action.exists, action.isHittable, actionIsClearOfBottomBar(action) {
                activate(action)
                if let destinationIdentifier {
                    let destination = app.descendants(matching: .any).matching(identifier: destinationIdentifier).firstMatch
                    XCTAssertTrue(
                        destination.waitForExistence(timeout: 5),
                        "Expected Home action '\(title)' to open '\(destinationIdentifier)' for screenshot \(name)"
                    )
                }
                capture(name)
                if dismissAfterCapture {
                    dismissPhoneDestination()
                }
                return
            }
            if action.exists, action.frame.minY < 140 {
                smallScrollDown()
            } else {
                smallScrollUp()
            }
        }
        if let visibleCandidate, visibleCandidate.exists, actionIsClearOfBottomBar(visibleCandidate) {
            activate(visibleCandidate)
            if let destinationIdentifier {
                let destination = app.descendants(matching: .any).matching(identifier: destinationIdentifier).firstMatch
                XCTAssertTrue(
                    destination.waitForExistence(timeout: 5),
                    "Expected Home action '\(title)' to open '\(destinationIdentifier)' for screenshot \(name)"
                )
            }
            capture(name)
            if dismissAfterCapture {
                dismissPhoneDestination()
            }
            return
        }
        XCTFail("Expected Home action '\(title)' for screenshot \(name)")
    }

    private func openHomeActionUsingSearch(title: String, identifier: String) {
        let searchField = app.searchFields.firstMatch
        XCTAssertTrue(searchField.waitForExistence(timeout: 3), "Expected Home search field before opening '\(title)'")
        activate(searchField)
        searchField.typeText(title)
        if app.keyboards.buttons["Search"].exists {
            app.keyboards.buttons["Search"].tap()
        }

        let action = app.buttons[identifier]
        XCTAssertTrue(action.waitForExistence(timeout: 5), "Expected filtered Home action '\(title)'")
        activate(action)

        if title == "Wildlife ID" {
            XCTAssertTrue(
                app.navigationBars["Wildlife ID"].waitForExistence(timeout: 5),
                "Expected Home action '\(title)' to open Wildlife ID"
            )
        }
    }

    private func actionIsClearOfBottomBar(_ element: XCUIElement) -> Bool {
        #if os(iOS)
        element.frame.minY > 140 && element.frame.midY < app.frame.maxY - 170
        #else
        true
        #endif
    }

    private func smallScrollUp() {
        #if os(iOS)
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.72))
        let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.56))
        start.press(forDuration: 0.01, thenDragTo: end)
        #else
        app.swipeUp()
        #endif
    }

    private func smallScrollDown() {
        #if os(iOS)
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.38))
        let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.54))
        start.press(forDuration: 0.01, thenDragTo: end)
        #else
        app.swipeDown()
        #endif
    }

    private func captureGuestLimitedHomeAction(_ title: String, name: String) {
        captureHomeAction(title, name: name, dismissAfterCapture: false)
        assertExpectedAccountRequiredState(for: name)
        dismissPhoneDestination()
    }

    private func dismissPhoneDestination() {
        if app.buttons["Done"].exists {
            app.buttons["Done"].tap()
        } else if app.navigationBars.buttons.firstMatch.exists {
            app.navigationBars.buttons.firstMatch.tap()
        }
    }
    #endif

    #if os(macOS) || os(iOS)
    private func captureMacSurface(mode: VisualMode, scope: MacSurfaceScope = .all) {
        let prefix = mode.prefix
        let suffix = mode.suffix
        let primaryEntries = [
            ("Home", "\(prefix)-home\(suffix)"),
            ("Packs", "\(prefix)-packs\(suffix)"),
            ("Trips", "\(prefix)-trips\(suffix)"),
            ("Weather", "\(prefix)-weather\(suffix)"),
            ("Assistant", "\(prefix)-assistant\(suffix)"),
            ("Catalog", "\(prefix)-catalog\(suffix)"),
        ]
        var secondaryEntries = [
            ("Templates", "\(prefix)-pack-templates\(suffix)"),
            ("Trail Conditions", "\(prefix)-trail-conditions\(suffix)"),
            ("Guides", "\(prefix)-guides\(suffix)"),
            ("Gear Inventory", "\(prefix)-gear-inventory\(suffix)"),
            ("AI Packs", "\(prefix)-ai-packs\(suffix)"),
        ]
        if UITestFeatureFlags.enableFeed {
            secondaryEntries.append(("Feed", "\(prefix)-feed\(suffix)"))
        }
        if UITestFeatureFlags.enableWildlifeIdentification {
            secondaryEntries.append(("Wildlife", "\(prefix)-wildlife\(suffix)"))
        }
        let entries: [(String, String)]
        switch scope {
        case .all:
            entries = primaryEntries + secondaryEntries
        case .primary:
            entries = primaryEntries
        case .secondary:
            entries = secondaryEntries
        }

        for (label, name) in entries {
            selectSidebar(label)
            capture(name)
        }

        if scope != .primary {
            captureMacHomeAction("Season Suggestions", name: "\(prefix)-season-suggestions\(suffix)")
        }
    }

    private func captureMacSampleDataDetails() {
        selectSidebar("Packs")
        capture("71-data-pack-detail")

        selectSidebar("Trips")
        capture("72-data-trip-detail")

        selectSidebar("Templates")
        capture("73-data-template-detail")

        selectSidebar("Trail Conditions")
        capture("74-data-trail-condition-detail")

        selectSidebar("AI Packs")
        capture("76-data-ai-packs-results")
        tapAndCapture(identifier: "ai_packs_generate_button", fallbackButton: "Generate 3 Packs", name: "77-data-ai-packs-confirm")
    }

    private func captureMacModalSurface(mode: VisualMode) {
        let prefix = mode.modalPrefix
        captureGlobalSearch(name: "\(prefix)-global-search", query: mode == .sampleData ? "Alpine" : nil)

        selectSidebar("Packs")
        tapAndCapture(identifier: "packs_new_pack_button", fallbackButton: "New Pack", name: "\(prefix)-new-pack-sheet")

        selectSidebar("Trips")
        tapAndCapture(identifier: "trips_plan_trip_button", fallbackButton: "Plan Trip", name: "\(prefix)-new-trip-sheet")

        selectSidebar("Templates")
        if mode == .guest {
            capture("50-guest-limit-new-template")
            assertExpectedAccountRequiredState(for: "50-guest-limit-new-template")
        } else {
            tapAndCapture(identifier: "templates_new_template_button", fallbackButton: "New Template", name: "\(prefix)-new-template-sheet")
        }

        selectSidebar("Trail Conditions")
        if mode == .guest {
            capture("50-guest-limit-trail-report")
            assertExpectedAccountRequiredState(for: "50-guest-limit-trail-report")
        } else {
            tapAndCapture(identifier: "trail_conditions_submit_report_button", fallbackButton: "Submit Report", name: "\(prefix)-trail-report-sheet")
        }

        selectSidebar("Weather")
        capture("\(prefix)-weather-before-alerts")

        if mode != .guest && UITestFeatureFlags.enableFeed {
            selectSidebar("Feed")
            tapAndCapture(identifier: "feed_new_post_button", fallbackButton: "New Post", name: "\(prefix)-feed-compose-sheet")
        }
    }

    private func captureMacExpandedPackStates() {
        resetMacSampleDataSidebar("Packs")
        capture("81-data-pack-detail-expanded")
        tapAndCapture(identifier: "pack_detail_add_item_button", fallbackButton: "Add Item", name: "82-data-pack-add-item-sheet")
        resetMacSampleDataSidebar("Packs")
        scrollToElement(identifier: "pack_item_row_visual-item-shelter")
        if isPadVisualRun {
            openMenuAndCapture(identifier: "pack_detail_more_menu", fallbackButton: "More", name: "83-data-pack-more-menu")
        } else {
            openContextMenuAndCapture(identifier: "pack_item_row_visual-item-shelter", name: "83-data-pack-more-menu")
        }
        resetMacSampleDataSidebar("Packs")
        scrollToElement(identifier: "pack_item_row_visual-item-shelter")
        tapElementAndCapture(identifier: "pack_item_row_visual-item-shelter", name: "84-data-pack-item-detail", dismissAfterCapture: false)
        tapAndCapture(identifier: "pack_item_detail_edit_button", fallbackButton: "Edit", name: "85-data-pack-item-edit-sheet")
    }

    private func captureMacExpandedPlanningStates(includeCatalog: Bool = true) {
        resetMacSampleDataSidebar("Trips")
        capture("86-data-trip-detail-expanded")
        tapAndCapture(identifier: "trip_detail_edit_button", fallbackButton: "Edit", name: "87-data-trip-edit-sheet", dismissAfterCapture: false)
        tapElementAndCapture(identifier: "trip_location_search_button", name: "87a-data-trip-location-search-sheet")

        resetMacSampleDataSidebar("Templates")
        capture("88-data-template-detail-expanded")
        tapAndCapture(button: "Apply to Pack", name: "89-data-template-apply-sheet")
        resetMacSampleDataSidebar("Templates")
        tapElementAndCapture(identifier: "template_row_visual-template-day", name: "89a-data-custom-template-detail", dismissAfterCapture: false)
        tapAndCapture(identifier: "template_detail_add_item_button", fallbackButton: "Add Item", name: "89b-data-template-add-item-sheet")
        resetMacSampleDataSidebar("Templates")
        tapElementAndCapture(identifier: "template_row_visual-template-day", name: "89c-data-custom-template-before-edit", dismissAfterCapture: false)
        tapAndCapture(identifier: "template_detail_edit_button", fallbackButton: "Edit", name: "89d-data-template-edit-sheet")

        if includeCatalog {
            captureMacExpandedCatalogStates()
        }
    }

    private func captureMacExpandedCatalogStates() {
        resetMacSampleDataSidebar("Catalog")
        tapElementAndCapture(identifier: "catalog_item_row_7001", name: "90-data-catalog-item-detail", dismissAfterCapture: false)
        resetMacSampleDataSidebar("Catalog")
        tapElementAndCapture(identifier: "catalog_item_row_7001", name: "90a-data-catalog-item-before-add", dismissAfterCapture: false)
        tapAndCapture(identifier: "catalog_detail_add_to_pack_button", fallbackButton: "Add to Pack", name: "91-data-catalog-add-to-pack-sheet")
    }

    private func captureMacExpandedConnectedStates() {
        resetMacSampleDataSidebar("Weather")
        tapAndCapture(identifier: "weather_alerts_button", fallbackButton: "Alerts", name: "92-data-weather-alerts-sheet")
        resetMacSampleDataSidebar("Weather")
        tapElementAndCapture(identifier: "weather_alert_preferences_button", name: "93-data-weather-alert-preferences", dismissAfterCapture: false)

        if UITestFeatureFlags.enableFeed {
            resetMacSampleDataSidebar("Feed")
            tapElementAndCapture(identifier: "feed_comments_button_9001", name: "94-data-feed-comments-sheet")
        }

        resetMacSampleDataSidebar("AI Packs")
        scrollToElement(identifier: "ai_packs_view_results_button", maxSwipes: 3)
        tapAndCapture(identifier: "ai_packs_view_results_button", fallbackButton: "View", name: "95-data-ai-packs-results-sheet")

        if UITestFeatureFlags.enableShoppingList {
            captureMacHomeAction("Shopping List", name: "96-data-shopping-list", dismissAfterCapture: false)
            tapAndCapture(identifier: "shopping_add_item_button", fallbackButton: "Add Item", name: "97-data-shopping-add-item-sheet")
        }
    }

    private func resetMacSampleDataSidebar(_ label: String) {
        launchAuthenticated(sampleData: true)
        selectSidebar(label)
    }

    private func selectSidebar(_ label: String) {
        dismissSystemInterruptions()
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
            XCTAssertTrue(button.waitForExistence(timeout: 5), "Expected sidebar item '\(label)'")
            activate(button)
            dismissSystemInterruptions()
            return
        }
        XCTFail("No sidebar identifier mapped for '\(label)'")
    }

    private func captureMacHomeAction(_ title: String, name: String, dismissAfterCapture: Bool = true) {
        selectSidebar("Home")
        let identifier = "home_action_\(title.lowercased().filter { $0.isLetter || $0.isNumber })"
        let action = app.buttons[identifier]

        for _ in 0..<8 {
            if action.exists, action.isHittable {
                activate(action)
                capture(name)
                if dismissAfterCapture {
                    dismissPresentedSurface()
                }
                return
            }
            app.swipeUp()
        }
        XCTFail("Expected Home action '\(title)' for screenshot \(name)")
    }
    #endif

    private func captureGlobalSearch(name: String, query: String? = nil) {
        #if os(macOS)
        app.typeKey("f", modifierFlags: [.command])
        #else
        if isPadVisualRun {
            selectSidebar("Home")
            capture("home-before-\(name)")
        } else {
            captureTab("Home", name: "home-before-\(name)")
        }
        let search = app.buttons["Search"]
        XCTAssertTrue(search.waitForExistence(timeout: 5), "Expected global Search button for screenshot \(name)")
        search.tap()
        #endif
        capture(name)
        if let query {
            let searchField = app.searchFields["Search packs, trips, trails…"].firstMatch
            XCTAssertTrue(searchField.waitForExistence(timeout: 5), "Expected global search field for screenshot \(name)")
            activate(searchField)
            searchField.typeText(query)
            let sampleResult = app.descendants(matching: .any)
                .matching(identifier: "global_search_result_pack-visual-pack-alpine")
                .firstMatch
            let resultExists = sampleResult.waitForExistence(timeout: 5)
            capture("\(name)-results")
            XCTAssertTrue(resultExists, "Expected global search to show sample pack result")
        }
        dismissPresentedSurface()
    }

    private func tapAndCapture(button label: String, name: String) {
        guard let button = findButton(label: label, timeout: 3) else {
            XCTFail("Expected button '\(label)' for screenshot \(name)")
            return
        }
        activate(button)
        capture(name)
        dismissPresentedSurface()
    }

    private func tapElementAndCapture(
        identifier: String,
        name: String,
        dismissAfterCapture: Bool = true
    ) {
        let element = app.descendants(matching: .any).matching(identifier: identifier).firstMatch
        XCTAssertTrue(element.waitForExistence(timeout: 5), "Expected element identifier '\(identifier)' for screenshot \(name)")
        activate(element)
        capture(name)
        if dismissAfterCapture {
            dismissPresentedSurface()
        }
    }

    private func scrollToElement(identifier: String, maxSwipes: Int = 5) {
        let element = app.descendants(matching: .any).matching(identifier: identifier).firstMatch
        for _ in 0..<maxSwipes where !element.exists {
            app.swipeUp()
        }
    }

    private func openMenuAndCapture(identifier: String, fallbackButton label: String, name: String) {
        guard let button = findButton(identifier: identifier, timeout: 3) ?? findButton(label: label, timeout: 2) else {
            XCTFail("Expected menu identifier '\(identifier)' or label '\(label)' for screenshot \(name)")
            return
        }
        activate(button)
        capture(name)
        dismissPresentedSurface()
    }

    private func openContextMenuAndCapture(identifier: String, name: String) {
        let element = app.descendants(matching: .any).matching(identifier: identifier).firstMatch
        XCTAssertTrue(element.waitForExistence(timeout: 5), "Expected context menu element identifier '\(identifier)' for screenshot \(name)")
        #if os(macOS)
        element.rightClick()
        #else
        element.press(forDuration: 1)
        #endif
        capture(name)
        dismissPresentedSurface()
    }

    private func tapAndCapture(identifier: String, name: String) {
        guard let button = findButton(identifier: identifier, timeout: 3) else {
            XCTFail("Expected button identifier '\(identifier)' for screenshot \(name)")
            return
        }
        activate(button)
        capture(name)
        dismissPresentedSurface()
    }

    private func tapAndCapture(
        identifier: String,
        fallbackButton label: String,
        name: String,
        dismissAfterCapture: Bool = true
    ) {
        let button = findButton(identifier: identifier, timeout: 1) ?? findButton(label: label, timeout: 3)
        guard let button else {
            XCTFail("Expected button identifier '\(identifier)' or label '\(label)' for screenshot \(name)")
            return
        }
        activate(button)
        capture(name)
        if dismissAfterCapture {
            dismissPresentedSurface()
        }
    }

    private func tapTextAndCapture(_ label: String, name: String) {
        let text = app.staticTexts.matching(NSPredicate(format: "label == %@", label)).firstMatch
        XCTAssertTrue(text.waitForExistence(timeout: 5), "Expected text '\(label)' for screenshot \(name)")
        activate(text)
        capture(name)
    }

    private func findButton(label: String, timeout: TimeInterval) -> XCUIElement? {
        let query = app.buttons.matching(NSPredicate(format: "label == %@", label))
        return findConcreteElement(in: query, timeout: timeout)
    }

    private func findButton(identifier: String, timeout: TimeInterval) -> XCUIElement? {
        let query = app.buttons.matching(identifier: identifier)
        return findConcreteElement(in: query, timeout: timeout)
    }

    private func findConcreteElement(in query: XCUIElementQuery, timeout: TimeInterval) -> XCUIElement? {
        guard query.firstMatch.waitForExistence(timeout: timeout) else { return nil }
        for element in query.allElementsBoundByIndex where element.exists && element.isHittable {
            return element
        }
        return query.firstMatch.exists ? query.firstMatch : nil
    }

    private func activate(_ element: XCUIElement) {
        dismissSystemInterruptions()
        #if os(macOS)
        if element.isHittable {
            element.click()
        } else {
            element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).click()
        }
        #else
        if element.isHittable {
            element.tap()
        } else {
            element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
        #endif
        dismissSystemInterruptions()
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

    private func launchAuthenticated(sampleData: Bool = false, forceOffline: Bool = false) {
        let bundle = Bundle(for: VisualScreenshotTests.self)
        let email = (bundle.object(forInfoDictionaryKey: "PACKRAT_E2E_EMAIL") as? String)
            ?? "e2e@packrat.test"
        let userId = ProcessInfo.processInfo.environment["E2E_TEST_USER_ID"]
            ?? "00000000-0000-4000-8000-000000000001"

        app.terminate()
        app = XCUIApplication()
        app.launchArguments = [
            "--disable-animations",
            "--use-userdefaults-auth",
            "--reset-auth",
            "--seed-e2e-auth",
        ]
        app.launchEnvironment["PACKRAT_VISUAL_SCREENSHOTS"] = "1"
        app.launchEnvironment["PACKRAT_E2E_EMAIL"] = email
        app.launchEnvironment["PACKRAT_E2E_USER_ID"] = userId
        if sampleData {
            app.launchArguments.append("--visual-sample-data")
            app.launchEnvironment["PACKRAT_VISUAL_SAMPLE_DATA"] = "1"
        }
        if forceOffline {
            app.launchArguments.append("--force-offline")
        }
        app.launchEnvironment["PACKRAT_E2E_ROLE"] = "ADMIN"
        app.launch()
        #if os(macOS)
        app.activate()
        dismissSystemInterruptions()
        #endif
        XCTAssertTrue(waitForAuthenticatedShell(), "Authenticated visual shell must launch from seeded E2E state")
    }

    private func waitForAuthenticatedShell() -> Bool {
        #if os(iOS)
        if isPadVisualRun {
            return app.buttons["nav_home"].waitForExistence(timeout: 20)
                || app.buttons["nav_packs"].waitForExistence(timeout: 2)
        }
        return app.tabBars.firstMatch.waitForExistence(timeout: 20)
        #elseif os(macOS)
        return app.buttons["nav_home"].waitForExistence(timeout: 10)
            || app.buttons["nav_packs"].waitForExistence(timeout: 2)
        #endif
    }

    private func launchLoggedOut(forceOffline: Bool = false) {
        app = XCUIApplication()
        app.launchArguments = [
            "--disable-animations",
            "--use-userdefaults-auth",
            "--reset-auth",
        ]
        if forceOffline {
            app.launchArguments.append("--force-offline")
        }
        app.launchEnvironment["PACKRAT_VISUAL_SCREENSHOTS"] = "1"
        app.launch()
        #if os(macOS)
        app.activate()
        dismissSystemInterruptions()
        #endif
    }

    private func restartLoggedOut() {
        app.terminate()
        launchLoggedOut()
    }

    private func capture(_ name: String) {
        Thread.sleep(forTimeInterval: 0.35)
        dismissSystemInterruptions()
        assertNoUnexpectedErrorState(for: name)
        #if os(macOS)
        app.activate()
        dismissSystemInterruptions()
        let window = app.windows.firstMatch
        let screenshot = window.waitForExistence(timeout: 2) ? window.screenshot() : app.screenshot()
        #else
        let screenshot = app.screenshot()
        #endif
        let url = screenshotDirectory.appendingPathComponent("\(name).png")
        try? screenshot.pngRepresentation.write(to: url, options: .atomic)

        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func assertNoUnexpectedErrorState(for screenshotName: String) {
        guard shouldRequireHealthyContent(for: screenshotName) else { return }

        let forbiddenIdentifiers = [
            "connection_needed_state",
            "temporary_error_state",
            "account_required_error_state",
            "account_required_state",
            "guest_limited_state",
            "inline_error",
        ]
        for identifier in forbiddenIdentifiers {
            XCTAssertFalse(
                app.descendants(matching: .any)[identifier].exists,
                "Screenshot \(screenshotName) captured unexpected error/account-required state: \(identifier)"
            )
        }

        for label in ["Connection Needed", "Temporarily Unavailable", "Sign In Required"] {
            XCTAssertFalse(
                app.staticTexts[label].exists,
                "Screenshot \(screenshotName) captured unexpected error text: \(label)"
            )
        }
    }

    private func assertExpectedAccountRequiredState(for screenshotName: String) {
        let expectedIdentifiers = [
            "guest_limited_state",
            "account_required_state",
            "account_required_error_state",
        ]
        let hasExpectedIdentifier = expectedIdentifiers.contains { identifier in
            app.descendants(matching: .any)[identifier].exists
        }
        let hasExpectedText = app.staticTexts["Sign In Required"].exists
            || app.staticTexts["Requires an Account"].exists
            || app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "Requires an Account")).firstMatch.exists
        XCTAssertTrue(
            hasExpectedIdentifier || hasExpectedText,
            "Screenshot \(screenshotName) should show an intentional guest/account-required state"
        )
    }

    private func shouldRequireHealthyContent(for screenshotName: String) -> Bool {
        if screenshotName.hasPrefix("00-")
            || screenshotName.hasPrefix("01-")
            || screenshotName.hasPrefix("02-")
            || screenshotName.hasPrefix("02a-")
            || screenshotName.hasPrefix("03-")
            || screenshotName.hasPrefix("10-guest-")
            || screenshotName.hasPrefix("40-offline-")
            || screenshotName.hasPrefix("41-offline-")
            || screenshotName.hasPrefix("42-offline-")
            || screenshotName.hasPrefix("43-offline-")
            || screenshotName.hasPrefix("44-offline-")
            || screenshotName.hasPrefix("45-offline-")
            || screenshotName.hasPrefix("46-offline-")
            || screenshotName.hasPrefix("50-guest-") {
            return false
        }
        return true
    }

    @discardableResult
    private func dismissInterruption(in container: XCUIElement) -> Bool {
        #if os(macOS)
        for label in ["Remind Me Later", "Not Now", "Continue", "OK", "Allow", "Dismiss", "Close"] {
            let button = container.buttons[label]
            if button.exists {
                if button.isHittable {
                    button.click()
                } else {
                    button.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).click()
                }
                return true
            }
        }
        #endif
        return false
    }

    private func dismissSystemInterruptions() {
        #if os(macOS)
        for bundleIdentifier in [
            "com.apple.ContinuityCaptureOnboardingUI",
            "com.apple.UserNotificationCenter",
            "com.apple.systempreferences",
        ] {
            let systemApp = XCUIApplication(bundleIdentifier: bundleIdentifier)
            if systemApp.exists, dismissInterruption(in: systemApp) {
                Thread.sleep(forTimeInterval: 0.2)
            }
        }
        #endif
    }
}

private enum VisualMode {
    case guest
    case authenticated
    case sampleData

    var prefix: String {
        switch self {
        case .guest:
            return "10-guest"
        case .authenticated:
            return "30-auth"
        case .sampleData:
            return "70-data"
        }
    }

    var suffix: String {
        switch self {
        case .guest:
            return "-guest"
        case .authenticated:
            return "-auth"
        case .sampleData:
            return "-data"
        }
    }

    var modalPrefix: String {
        switch self {
        case .guest:
            return "50-guest-modal"
        case .authenticated:
            return "60-auth-modal"
        case .sampleData:
            return "80-data-modal"
        }
    }
}
