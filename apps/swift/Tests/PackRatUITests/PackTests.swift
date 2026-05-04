import XCTest

/// End-to-end tests for Pack CRUD and item management.
/// Each test creates data with a unique timestamped name and deletes it on teardown.
final class PackTests: AppUITestCase {
    private var createdPackName: String?

    override func tearDownWithError() throws {
        if let name = createdPackName {
            cleanupPack(named: name)
        }
        createdPackName = nil
        try super.tearDownWithError()
    }

    // MARK: - Create

    func testCreatePack() throws {
        let packName = uniqueName("E2E Pack")
        createdPackName = packName

        goToTab("Packs")

        let newPackButton = app.buttons["New Pack"]
        waitFor(newPackButton)
        newPackButton.tap()

        // Pack form sheet appears
        let nameField = app.textFields["Pack Name"]
        waitFor(nameField, message: "Pack Name field must appear in form")
        nameField.tap()
        nameField.typeText(packName)

        app.buttons["Create"].tap()

        // Pack should appear in the list
        let packCell = app.staticTexts[packName]
        XCTAssertTrue(
            packCell.waitForExistence(timeout: 15),
            "Created pack '\(packName)' must appear in the list"
        )
    }

    func testCreatePackWithCategory() throws {
        let packName = uniqueName("E2E Hiking Pack")
        createdPackName = packName

        goToTab("Packs")
        waitFor(app.buttons["New Pack"]).tap()

        let nameField = app.textFields["Pack Name"]
        waitFor(nameField)
        nameField.tap()
        nameField.typeText(packName)

        // Pick a category
        let categoryPicker = app.pickers["Category"]
        if categoryPicker.waitForExistence(timeout: 3) {
            categoryPicker.tap()
        } else {
            // Inline picker in Form — look for "Hiking" option
            let hikingOption = app.buttons["Hiking"].firstMatch
            if hikingOption.waitForExistence(timeout: 3) { hikingOption.tap() }
        }

        app.buttons["Create"].tap()

        XCTAssertTrue(
            app.staticTexts[packName].waitForExistence(timeout: 15),
            "Pack with category must appear in list"
        )
    }

    // MARK: - Open / Detail

    func testOpenPackShowsDetail() throws {
        let packName = uniqueName("E2E Detail Pack")
        createdPackName = packName

        createPack(named: packName)

        let packCell = waitFor(app.staticTexts[packName])
        packCell.tap()

        // On iPhone, tapping navigates into the detail view
        XCTAssertTrue(
            app.navigationBars[packName].waitForExistence(timeout: 10),
            "Pack detail navigation bar must show pack name"
        )
    }

    // MARK: - Add Item

    func testAddItemToPack() throws {
        let packName = uniqueName("E2E Item Pack")
        createdPackName = packName
        let itemName = "Tent \(Int(Date().timeIntervalSince1970))"

        createPack(named: packName)
        openPack(named: packName)

        // Tap "Add Item" in toolbar
        let addButton = app.buttons["Add Item"]
        waitFor(addButton, message: "Add Item toolbar button must be visible")
        addButton.tap()

        // Item form sheet
        let itemNameField = app.textFields["Name"]
        waitFor(itemNameField, message: "Item Name field must appear")
        itemNameField.tap()
        itemNameField.typeText(itemName)

        // Fill in weight
        let weightField = app.textFields["0"]
        if weightField.waitForExistence(timeout: 3) {
            weightField.tap()
            weightField.typeText("500")
        }

        app.buttons["Add"].tap()

        // Item appears in pack detail
        XCTAssertTrue(
            app.staticTexts[itemName].waitForExistence(timeout: 15),
            "Added item '\(itemName)' must appear in pack detail"
        )
    }

    func testAddMultipleItems() throws {
        let packName = uniqueName("E2E Multi Item Pack")
        createdPackName = packName

        createPack(named: packName)
        openPack(named: packName)

        let itemNames = ["Sleeping Bag", "Rain Jacket", "Water Filter"]
        for item in itemNames {
            let uniqueItem = "\(item) \(Int(Date().timeIntervalSince1970))"
            addItem(named: uniqueItem)
        }

        // All three items should be in the pack
        for item in itemNames {
            XCTAssertTrue(
                app.staticTexts.matching(NSPredicate(format: "label CONTAINS '\(item)'")).firstMatch
                    .waitForExistence(timeout: 5),
                "Item '\(item)' should appear in pack"
            )
        }
    }

    // MARK: - Edit Pack

    func testEditPackName() throws {
        let originalName = uniqueName("E2E Edit Pack")
        let updatedName = "\(originalName) UPDATED"
        createdPackName = updatedName  // teardown will look for updated name

        createPack(named: originalName)
        openPack(named: originalName)

        // Open the ••• menu
        let menuButton = app.buttons["More"]
            .firstMatch
        if !menuButton.waitForExistence(timeout: 3) {
            app.buttons.matching(NSPredicate(format: "label CONTAINS 'ellipsis'")).firstMatch.tap()
        } else {
            menuButton.tap()
        }

        app.buttons["Edit Pack"].tap()

        let nameField = app.textFields["Pack Name"]
        waitFor(nameField)
        nameField.clearAndTypeText(updatedName)

        app.buttons["Save"].tap()

        XCTAssertTrue(
            app.navigationBars[updatedName].waitForExistence(timeout: 10),
            "Nav bar should reflect updated pack name"
        )
    }

    // MARK: - Delete

    func testDeletePack() throws {
        let packName = uniqueName("E2E Delete Pack")
        // Don't set createdPackName — we're deleting it in the test itself

        createPack(named: packName)
        goToTab("Packs")

        let packCell = app.cells.containing(.staticText, identifier: packName).firstMatch
        waitFor(packCell, message: "Pack cell must exist before deletion")
        packCell.press(forDuration: 1.2)

        let deleteButton = app.buttons["Delete"]
        waitFor(deleteButton, timeout: 5)
        deleteButton.tap()

        waitForAbsence(app.staticTexts[packName], timeout: 10)
    }

    // MARK: - Helpers

    private func createPack(named name: String) {
        goToTab("Packs")
        waitFor(app.buttons["New Pack"]).tap()

        let nameField = app.textFields["Pack Name"]
        waitFor(nameField)
        nameField.tap()
        nameField.typeText(name)
        app.buttons["Create"].tap()

        waitFor(app.staticTexts[name], timeout: 15)
    }

    private func openPack(named name: String) {
        goToTab("Packs")
        let cell = waitFor(app.staticTexts[name])
        cell.tap()
        waitFor(app.navigationBars[name], timeout: 10)
    }

    private func addItem(named name: String) {
        waitFor(app.buttons["Add Item"]).tap()
        let nameField = app.textFields["Name"]
        waitFor(nameField)
        nameField.tap()
        nameField.typeText(name)
        app.buttons["Add"].tap()
        waitFor(app.staticTexts[name], timeout: 10)
    }

    private func cleanupPack(named name: String) {
        goToTab("Packs")
        let cell = app.cells.containing(.staticText, identifier: name).firstMatch
        guard cell.waitForExistence(timeout: 5) else { return }
        cell.press(forDuration: 1.2)
        let deleteButton = app.buttons["Delete"]
        guard deleteButton.waitForExistence(timeout: 3) else { return }
        deleteButton.tap()
    }
}
