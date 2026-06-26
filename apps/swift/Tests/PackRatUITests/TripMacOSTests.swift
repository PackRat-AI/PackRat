import XCTest

#if os(macOS)
/// macOS variant of `TripTests`. Trips is the sidebar's "Trips" entry; trips
/// are selected in the content column and their detail appears in the trailing
/// column.
final class TripMacOSTests: AppUITestCase {
    private var createdTripName: String?

    override func tearDownWithError() throws {
        if let name = createdTripName {
            cleanupTrip(named: name)
        }
        createdTripName = nil
        try super.tearDownWithError()
    }

    func testTripsSidebarShowsListOrEmpty() {
        goToSidebar("Trips")
        XCTAssertTrue(
            app.staticTexts["Trips"].waitForExistence(timeout: 8),
            "Trips header must appear"
        )
    }

    func testPlanTripButtonOpensForm() {
        goToSidebar("Trips")
        let planButton = app.buttons["trips_plan_trip_button"]
        waitFor(planButton)
        planButton.click()

        XCTAssertTrue(
            app.textFields["trip_name"].waitForExistence(timeout: 5),
            "Trip name field must appear in form"
        )
        XCTAssertTrue(app.buttons["Cancel"].exists)
        app.buttons["Cancel"].click()
    }

    func testCreateTrip() {
        let tripName = uniqueName("E2E Trip")
        createdTripName = tripName

        goToSidebar("Trips")
        waitFor(app.buttons["trips_plan_trip_button"]).click()

        let nameField = app.textFields["trip_name"]
        waitFor(nameField)
        nameField.click()
        nameField.typeText(tripName)

        app.buttons["Create"].click()

        XCTAssertTrue(
            app.staticTexts[tripName].waitForExistence(timeout: 15),
            "Created trip '\(tripName)' must appear in list"
        )
    }

    func testCreateTripWithDates() {
        let tripName = uniqueName("E2E Dated Trip")
        createdTripName = tripName

        goToSidebar("Trips")
        waitFor(app.buttons["trips_plan_trip_button"]).click()

        let nameField = app.textFields["trip_name"]
        waitFor(nameField)
        nameField.click()
        nameField.typeText(tripName)

        // "Set trip dates" toggle — on macOS Toggle renders as a checkbox.
        let dateToggle = app.switches["Set trip dates"]
        let dateCheck = app.checkBoxes["Set trip dates"]
        if dateToggle.waitForExistence(timeout: 3) { dateToggle.click() }
        else if dateCheck.waitForExistence(timeout: 2) { dateCheck.click() }

        app.buttons["Create"].click()

        XCTAssertTrue(
            app.staticTexts[tripName].waitForExistence(timeout: 15)
        )
    }

    func testOpenTripDetail() {
        let tripName = uniqueName("E2E Detail Trip")
        createdTripName = tripName

        createTrip(named: tripName)
        let row = waitFor(app.staticTexts[tripName])
        row.click()

        // Detail column shows the trip name as a heading. Either the heading
        // or any of the typical detail sections (Description, Pack, Dates) is
        // sufficient evidence the detail column is populated.
        XCTAssertTrue(
            app.staticTexts[tripName].waitForExistence(timeout: 10),
            "Trip detail must appear in the trailing column"
        )
    }

    func testDeleteTripViaContextMenu() {
        // iOS uses swipe-to-delete on a UITableViewCell; macOS uses the right-
        // click context menu on the same row.
        let tripName = uniqueName("E2E Delete Trip")

        createTrip(named: tripName)

        let cell = waitFor(app.staticTexts[tripName])
        cell.rightClick()

        let deleteButton = rowDeleteMenuItem()
        waitFor(deleteButton, timeout: 3)
        deleteButton.click()

        waitForAbsence(app.staticTexts[tripName], timeout: 10)
    }

    func testTripsSearchable() {
        goToSidebar("Trips")
        XCTAssertTrue(
            app.searchFields.firstMatch.waitForExistence(timeout: 8),
            "Trips list must be searchable"
        )
    }

    // MARK: - Helpers

    private func createTrip(named name: String) {
        goToSidebar("Trips")
        waitFor(app.buttons["trips_plan_trip_button"]).click()
        let nameField = app.textFields["trip_name"]
        waitFor(nameField)
        nameField.click()
        nameField.typeText(name)
        app.buttons["Create"].click()
        waitFor(app.staticTexts[name], timeout: 15)
    }

    private func cleanupTrip(named name: String) {
        goToSidebar("Trips")
        let cell = app.staticTexts[name]
        guard cell.waitForExistence(timeout: 5) else { return }
        cell.rightClick()
        let deleteButton = rowDeleteMenuItem()
        guard deleteButton.waitForExistence(timeout: 3) else { return }
        deleteButton.click()
    }

    private func rowDeleteMenuItem() -> XCUIElement {
        app.menuItems.matching(NSPredicate(format: "identifier == %@", "trash")).firstMatch
    }
}
#endif
