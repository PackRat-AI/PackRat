import XCTest

/// End-to-end tests for Trips: planning, viewing, editing, deleting.
final class TripTests: AppUITestCase {
    private var createdTripName: String?

    override func tearDownWithError() throws {
        if let name = createdTripName {
            cleanupTrip(named: name)
        }
        createdTripName = nil
        try super.tearDownWithError()
    }

    func testTripsTabShowsListOrEmpty() {
        goToTab("Trips")
        XCTAssertTrue(
            app.navigationBars["Trips"].waitForExistence(timeout: 8),
            "Trips navigation must appear"
        )
    }

    func testPlanTripButtonOpensForm() {
        goToTab("Trips")
        // Either toolbar Plan Trip button or empty-state CTA
        let planButton = app.buttons["Plan Trip"]
        waitFor(planButton)
        planButton.tap()

        XCTAssertTrue(
            app.textFields["Trip Name"].waitForExistence(timeout: 5),
            "Trip Name field must appear in form"
        )
        XCTAssertTrue(app.buttons["Cancel"].exists)
    }

    func testCreateTrip() {
        let tripName = uniqueName("E2E Trip")
        createdTripName = tripName

        goToTab("Trips")
        waitFor(app.buttons["Plan Trip"]).tap()

        let nameField = app.textFields["Trip Name"]
        waitFor(nameField)
        nameField.tap()
        nameField.typeText(tripName)

        app.buttons["Create"].tap()

        XCTAssertTrue(
            app.staticTexts[tripName].waitForExistence(timeout: 15),
            "Created trip '\(tripName)' must appear in list"
        )
    }

    func testCreateTripWithDates() {
        let tripName = uniqueName("E2E Dated Trip")
        createdTripName = tripName

        goToTab("Trips")
        waitFor(app.buttons["Plan Trip"]).tap()

        let nameField = app.textFields["Trip Name"]
        waitFor(nameField)
        nameField.tap()
        nameField.typeText(tripName)

        // Toggle "Set trip dates"
        let dateToggle = app.switches["Set trip dates"]
        if dateToggle.waitForExistence(timeout: 3) { dateToggle.tap() }

        app.buttons["Create"].tap()

        XCTAssertTrue(
            app.staticTexts[tripName].waitForExistence(timeout: 15)
        )
    }

    func testOpenTripDetail() {
        let tripName = uniqueName("E2E Detail Trip")
        createdTripName = tripName

        createTrip(named: tripName)
        let row = waitFor(app.staticTexts[tripName])
        row.tap()

        XCTAssertTrue(
            app.navigationBars[tripName].waitForExistence(timeout: 10),
            "Trip detail nav bar should show trip name"
        )
    }

    func testDeleteTripViaSwipe() {
        let tripName = uniqueName("E2E Delete Trip")
        // Don't track in createdTripName — deleted in test

        createTrip(named: tripName)

        let cell = app.cells.containing(.staticText, identifier: tripName).firstMatch
        waitFor(cell)
        cell.swipeLeft()

        let deleteButton = app.buttons["Delete"]
        waitFor(deleteButton, timeout: 3)
        deleteButton.tap()

        waitForAbsence(app.staticTexts[tripName], timeout: 10)
    }

    func testTripsSearchable() {
        goToTab("Trips")
        XCTAssertTrue(
            app.searchFields.firstMatch.waitForExistence(timeout: 8),
            "Trips list must be searchable"
        )
    }

    // MARK: - Helpers

    private func createTrip(named name: String) {
        goToTab("Trips")
        waitFor(app.buttons["Plan Trip"]).tap()
        let nameField = app.textFields["Trip Name"]
        waitFor(nameField)
        nameField.tap()
        nameField.typeText(name)
        app.buttons["Create"].tap()
        waitFor(app.staticTexts[name], timeout: 15)
    }

    private func cleanupTrip(named name: String) {
        goToTab("Trips")
        let cell = app.cells.containing(.staticText, identifier: name).firstMatch
        guard cell.waitForExistence(timeout: 5) else { return }
        cell.swipeLeft()
        let deleteButton = app.buttons["Delete"]
        guard deleteButton.waitForExistence(timeout: 3) else { return }
        deleteButton.tap()
    }
}
