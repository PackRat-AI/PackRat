import XCTest

#if os(iOS)
// iOS-only suite — same tab-bar navigation dependency as WeatherSubFlowTests.

/// Proactive weather monitoring: the watch list screen, the contextual
/// add-to-watch-list banner, and their gating behind `enableWeatherMonitoring`.
/// Runs against `--ui-test-fixtures` data (`VisualSampleData.watchedLocations`
/// and the fixture forecast's always-present alert), never live network —
/// see WeatherViewModel's `VisualSampleData.isUITestFixturesEnabled` checks.
final class WeatherWatchListTests: AppUITestCase {
    override var additionalLaunchArguments: [String] {
        ["--ui-test-fixtures"]
    }

    func testWatchListButtonReachableFromWeatherToolbar() {
        goToWeather()

        let watchListButton = app.buttons["Watch List"]
        if !watchListButton.waitForExistence(timeout: 2) {
            openOverflowMenuIfNeeded()
        }
        guard watchListButton.waitForExistence(timeout: 8) else {
            XCTFail("Watch List button must be in Weather toolbar when enableWeatherMonitoring is on")
            return
        }
        watchListButton.tap()

        XCTAssertTrue(
            app.navigationBars["Weather Alerts Watch List"].waitForExistence(timeout: 5),
            "Watch List screen must appear"
        )
    }

    func testWatchListShowsFixtureLocation() {
        goToWeather()
        openWatchList()

        XCTAssertTrue(
            app.staticTexts["Denver"].waitForExistence(timeout: 5),
            "Fixture watch list should show the pre-watched Denver location"
        )
    }

    func testAddLocationFromWatchListSearch() {
        goToWeather()
        openWatchList()

        let addButton = app.buttons["weather_watch_list_add_button"]
        XCTAssertTrue(addButton.waitForExistence(timeout: 5))
        addButton.tap()

        let searchField = app.searchFields.firstMatch
        XCTAssertTrue(searchField.waitForExistence(timeout: 5))
        searchField.tap()
        searchField.typeText("Seattle")

        let result = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Seattle'")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 8), "Search should surface the Seattle fixture location")
        result.tap()

        // Sheet dismisses on selection; Seattle should now be in the list.
        XCTAssertTrue(
            app.navigationBars["Weather Alerts Watch List"].waitForExistence(timeout: 5),
            "Should return to the watch list after adding a location"
        )
        XCTAssertTrue(
            app.staticTexts["Seattle"].waitForExistence(timeout: 5),
            "Newly added Seattle should appear in the watch list"
        )
    }

    func testRemoveLocationFromWatchListBySwipe() {
        goToWeather()
        openWatchList()

        let denverRow = app.staticTexts["Denver"]
        XCTAssertTrue(denverRow.waitForExistence(timeout: 5))
        denverRow.swipeLeft()

        let removeButton = app.buttons["Remove"]
        XCTAssertTrue(removeButton.waitForExistence(timeout: 5))
        removeButton.tap()

        XCTAssertTrue(
            app.staticTexts["No Watched Locations"].waitForExistence(timeout: 5)
                || !denverRow.waitForExistence(timeout: 2),
            "Denver should no longer be listed after removal"
        )
    }

    /// An active alert renders as a section inside the forecast, carrying the
    /// watch call to action while the location is not yet watched (ADR-006).
    /// Fixture forecasts always carry an alert, so selecting a not-yet-watched
    /// location surfaces both the section and its CTA.
    func testForecastAlertSectionAppearsForLocationWithActiveAlert() {
        goToWeather()
        selectSearchResult("Salt Lake City")

        XCTAssertTrue(
            app.otherElements["forecast_alert_section"].waitForExistence(timeout: 8),
            "An active alert should render as a section inside the forecast"
        )
        XCTAssertTrue(
            app.buttons["forecast_alert_watch_button"].waitForExistence(timeout: 3),
            "The alert section should offer to watch a location that isn't watched yet"
        )
    }

    /// The alert section is part of the forecast, not an interruption laid
    /// over it — there is no way to dismiss it (ADR-006).
    func testForecastAlertSectionCannotBeDismissed() {
        goToWeather()
        selectSearchResult("Salt Lake City")

        let section = app.otherElements["forecast_alert_section"]
        XCTAssertTrue(section.waitForExistence(timeout: 8))
        XCTAssertFalse(
            app.buttons["watch_location_prompt_dismiss_button"].exists,
            "The inline alert section should expose no dismiss affordance"
        )
    }

    /// Watching must not depend on catching a hazard in progress: the toolbar
    /// control is present on any selected location (ADR-006).
    func testWatchToggleIsAvailableOnASelectedLocation() {
        goToWeather()
        selectSearchResult("Salt Lake City")

        let toggle = app.buttons["weather_watch_toggle_button"]
        XCTAssertTrue(
            toggle.waitForExistence(timeout: 8),
            "The watch toggle should be available on any selected location"
        )
        toggle.tap()

        XCTAssertTrue(
            app.otherElements["forecast_alert_watched_confirmation"].waitForExistence(timeout: 8),
            "Watching from the toolbar should retire the alert section's call to action"
        )
        XCTAssertFalse(
            app.buttons["forecast_alert_watch_button"].exists,
            "The in-section CTA and the toolbar control should never both be actionable"
        )
    }

    // MARK: - Helpers

    private func selectSearchResult(_ name: String) {
        let searchField = app.searchFields.firstMatch
        XCTAssertTrue(searchField.waitForExistence(timeout: 5))
        searchField.tap()
        searchField.typeText(name)

        let result = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", name)).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 8))
        result.tap()
    }

    private func goToWeather() {
        goToHomeAction("Weather")
        XCTAssertTrue(app.navigationBars["Weather"].waitForExistence(timeout: 8))
    }

    private func openWatchList() {
        let watchListButton = app.buttons["Watch List"]
        if !watchListButton.waitForExistence(timeout: 2) {
            openOverflowMenuIfNeeded()
        }
        guard watchListButton.waitForExistence(timeout: 8) else {
            XCTFail("Watch List button must be reachable")
            return
        }
        watchListButton.tap()
        XCTAssertTrue(app.navigationBars["Weather Alerts Watch List"].waitForExistence(timeout: 5))
    }

    /// Alert Preferences/Watch List collapse into the nav-bar overflow menu on
    /// iPhone (.secondaryAction placement) — same pattern as WeatherSubFlowTests.
    private func openOverflowMenuIfNeeded() {
        let overflow = app.navigationBars.firstMatch.buttons.matching(
            NSPredicate(format: "label == 'More' OR label CONTAINS 'ellipsis'")
        ).firstMatch
        if overflow.waitForExistence(timeout: 5) { overflow.tap() }
    }
}

#endif
