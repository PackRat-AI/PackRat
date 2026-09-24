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

    /// The contextual banner's one trigger condition: an active alert for a
    /// location not already watched. Fixture forecasts always carry an
    /// alert, so searching for a not-yet-watched location and selecting it
    /// on the main Weather screen should surface the banner.
    func testAddToWatchListBannerAppearsForUnwatchedLocationWithActiveAlert() {
        goToWeather()

        let searchField = app.searchFields.firstMatch
        XCTAssertTrue(searchField.waitForExistence(timeout: 5))
        searchField.tap()
        searchField.typeText("Salt Lake City")

        let result = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Salt Lake City'")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 8))
        result.tap()

        XCTAssertTrue(
            app.otherElements["watch_location_prompt_banner"].waitForExistence(timeout: 8),
            "Banner should offer to watch a location with an active alert that isn't watched yet"
        )
    }

    func testDismissingBannerHidesItForTheSession() {
        goToWeather()

        let searchField = app.searchFields.firstMatch
        XCTAssertTrue(searchField.waitForExistence(timeout: 5))
        searchField.tap()
        searchField.typeText("Salt Lake City")

        let result = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Salt Lake City'")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 8))
        result.tap()

        let banner = app.otherElements["watch_location_prompt_banner"]
        XCTAssertTrue(banner.waitForExistence(timeout: 8))

        app.buttons["watch_location_prompt_dismiss_button"].tap()
        XCTAssertFalse(banner.waitForExistence(timeout: 3), "Banner should disappear once dismissed")
    }

    // MARK: - Helpers

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
