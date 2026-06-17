import XCTest

#if os(iOS)
// iOS-only suite — uses goToTab() (UITabBar) which doesnt exist on macOS.

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

        createPack(named: packName)

        // Pack should appear in the list
        XCTAssertTrue(
            app.staticTexts[packName].waitForExistence(timeout: 5),
            "Created pack '\(packName)' must appear in the list"
        )
    }

    func testCreatePackWithCategory() throws {
        // The createPack helper already picks Hiking as the category.
        let packName = uniqueName("E2E Hiking Pack")
        createdPackName = packName

        createPack(named: packName)

        XCTAssertTrue(
            app.staticTexts[packName].waitForExistence(timeout: 5),
            "Pack with category must appear in list"
        )

        // Hiking badge should be visible on the row
        XCTAssertTrue(
            app.staticTexts["Hiking"].firstMatch.exists,
            "Hiking category label must appear on the pack row"
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

        // Two "Add Item" buttons can exist: toolbar + empty-state CTA. Use first.
        let addButton = app.buttons["Add Item"].firstMatch
        waitFor(addButton, message: "Add Item button must be visible")
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

        // Open the ••• overflow menu in the nav bar.
        // Scope to navigationBars so we don't catch the bottom tab bar's "More" tab.
        let navBar = app.navigationBars.firstMatch
        let menuButton = navBar.buttons.matching(
            NSPredicate(format: "label == 'More' OR label CONTAINS 'ellipsis'")
        ).firstMatch
        waitFor(menuButton, timeout: 5)
        menuButton.tap()

        let editButton = app.buttons["Edit Pack"]
        waitFor(editButton, timeout: 3)
        editButton.tap()

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

        // Pick a category — the API rejects pack creation with no category
        // (DB column is NOT NULL). Open the picker, choose Hiking.
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

    private func openPack(named name: String) {
        goToTab("Packs")
        let cell = waitFor(app.staticTexts[name])
        cell.tap()
        waitFor(app.navigationBars[name], timeout: 10)
    }

    private func addItem(named name: String) {
        // Prefer the nav bar's Add Item to avoid clashing with the empty-state CTA.
        let toolbarAdd = app.navigationBars.firstMatch.buttons["Add Item"]
        let addButton = toolbarAdd.exists ? toolbarAdd : app.buttons["Add Item"].firstMatch
        waitFor(addButton).tap()

        let nameField = app.textFields["Name"]
        waitFor(nameField)
        nameField.tap()
        nameField.typeText(name)

        // The DB requires non-null weight + weightUnit. Set a small weight so
        // the API doesn't reject the insert with a 500.
        let weightField = app.textFields["item_weight"]
        if weightField.waitForExistence(timeout: 3) {
            weightField.tap()
            weightField.typeText("100")
        }

        app.buttons["Add"].tap()

        // Wait for the form to dismiss (Add Item visible again).
        waitFor(toolbarAdd.exists ? toolbarAdd : app.buttons["Add Item"].firstMatch, timeout: 10)

        // Scroll the detail view if the new item is offscreen.
        // Stay within the content area (avoid bottom 15% which is the tab bar).
        let target = app.staticTexts[name]
        for _ in 0..<6 {
            if target.exists { break }
            let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.7))
            let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.25))
            start.press(forDuration: 0.05, thenDragTo: end)
        }
        waitFor(target, timeout: 10, message: "Item '\(name)' must appear in pack detail")
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

#endif
