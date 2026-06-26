import XCTest

final class MacPackTripTests: MacUITestCase {
    func testCreateOpenAndAddItemToPack() {
        let packName = uniqueName("Mac E2E Pack")
        let itemName = "Mac Tent \(Int(Date().timeIntervalSince1970))"

        createPack(named: packName)
        waitFor(app.staticTexts[packName], timeout: 15).tap()

        let addItem = app.buttons["Add Item"].firstMatch
        waitFor(addItem, timeout: 10).tap()

        let itemNameField = waitFor(textInput("Name", alternateLabels: ["item_name"]), timeout: 10)
        itemNameField.tap()
        itemNameField.typeText(itemName)

        let weightField = app.textFields["0"].exists ? app.textFields["0"] : app.textFields["item_weight"]
        if weightField.waitForExistence(timeout: 3) {
            weightField.tap()
            weightField.typeText("500")
        }

        app.buttons["Add"].tap()
        XCTAssertTrue(app.staticTexts[itemName].waitForExistence(timeout: 15))
    }

    func testCreateOpenAndDeleteTrip() {
        let tripName = uniqueName("Mac E2E Trip")
        createTrip(named: tripName)

        waitFor(app.staticTexts[tripName], timeout: 15).tap()
        XCTAssertTrue(app.staticTexts[tripName].waitForExistence(timeout: 10))

        goToSidebar("Trips")
        let cell = app.cells.containing(.staticText, identifier: tripName).firstMatch
        if cell.waitForExistence(timeout: 5) {
            cell.swipeLeft()
            let deleteButton = app.buttons["Delete"]
            if deleteButton.waitForExistence(timeout: 3) {
                deleteButton.tap()
                waitForAbsence(app.staticTexts[tripName], timeout: 10)
            }
        }
    }

    private func createPack(named name: String) {
        goToSidebar("Packs")
        waitFor(app.buttons["new_pack_button"].firstMatch, timeout: 10).tap()

        let nameField = waitFor(textInput("Pack Name", alternateLabels: ["pack_name"]), timeout: 10)
        nameField.tap()
        nameField.typeText(name)

        let categoryButton = app.buttons.matching(
            NSPredicate(format: "label CONTAINS 'Category' OR label == 'None'")
        ).firstMatch
        if categoryButton.waitForExistence(timeout: 3) {
            categoryButton.tap()
            let hiking = app.buttons["Hiking"].firstMatch
            if hiking.waitForExistence(timeout: 3) { hiking.tap() }
        }

        app.buttons["Create"].tap()
        waitFor(app.staticTexts[name], timeout: 15)
    }

    private func createTrip(named name: String) {
        goToSidebar("Trips")
        waitFor(app.buttons["plan_trip_button"].firstMatch, timeout: 10).tap()
        let nameField = waitFor(textInput("Trip Name", alternateLabels: ["trip_name"]), timeout: 10)
        nameField.tap()
        nameField.typeText(name)
        app.buttons["Create"].tap()
        waitFor(app.staticTexts[name], timeout: 15)
    }
}
