import XCTest

#if os(macOS)
/// macOS variant of `PackTests`. On macOS the Packs feature is a 3-column
/// NavigationSplitView: sidebar ("Packs") -> content (List<Pack>) -> detail
/// (PackDetailView). Selecting a pack populates the detail column rather than
/// navigating, so the assertions check detail-column landmarks.
final class PackMacOSTests: AppUITestCase {
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

        XCTAssertTrue(
            app.staticTexts[packName].waitForExistence(timeout: 5),
            "Created pack '\(packName)' must appear in the list"
        )
    }

    func testCreatePackWithCategory() throws {
        let packName = uniqueName("E2E Hiking Pack")
        createdPackName = packName

        createPack(named: packName)

        XCTAssertTrue(
            app.staticTexts[packName].waitForExistence(timeout: 5),
            "Pack with category must appear in list"
        )

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
        packCell.click()

        // On macOS the detail column shows the pack name in its content. The
        // "Total" weight card label is a stable landmark for the PackDetailView.
        XCTAssertTrue(
            app.staticTexts["Total"].waitForExistence(timeout: 10)
            || app.buttons["Add Item"].waitForExistence(timeout: 5),
            "Pack detail content must appear in the trailing column"
        )
    }

    // MARK: - Add Item

    func testAddItemToPack() throws {
        let packName = uniqueName("E2E Item Pack")
        createdPackName = packName
        let itemName = "Tent \(Int(Date().timeIntervalSince1970))"

        createPack(named: packName)
        openPack(named: packName)

        let addButton = app.buttons["Add Item"].firstMatch
        waitFor(addButton, message: "Add Item button must be visible")
        addButton.click()

        let itemNameField = app.textFields["pack_item_name"]
        waitFor(itemNameField, message: "Item Name field must appear")
        itemNameField.click()
        itemNameField.typeText(itemName)

        let weightField = app.textFields["item_weight"]
        if weightField.waitForExistence(timeout: 3) {
            weightField.click()
            weightField.typeText("500")
        }

        app.buttons["Add"].click()

        XCTAssertTrue(
            packItemRow(containing: itemName).waitForExistence(timeout: 15),
            "Added item '\(itemName)' must appear in pack detail"
        )
    }

    func testAddMultipleItems() throws {
        let packName = uniqueName("E2E Multi Item Pack")
        createdPackName = packName

        createPack(named: packName)
        openPack(named: packName)

        let itemNames = ["Sleeping Bag", "Rain Jacket", "Water Filter"]
        var uniqueItems: [String] = []
        for item in itemNames {
            let uniqueItem = "\(item) \(Int(Date().timeIntervalSince1970))"
            uniqueItems.append(uniqueItem)
            addItem(named: uniqueItem)
        }

        for item in uniqueItems {
            XCTAssertTrue(
                packItemRow(containing: item)
                    .waitForExistence(timeout: 10),
                "Item '\(item)' should appear in pack"
            )
        }
    }

    // MARK: - Edit Pack

    func testEditPackName() throws {
        let originalName = uniqueName("E2E Edit Pack")
        let updatedName = "\(originalName) UPDATED"
        createdPackName = updatedName

        createPack(named: originalName)
        openPack(named: originalName)

        // Open the detail-column ••• overflow menu. On macOS the toolbar lives
        // in the detail column window chrome; the menu icon is the
        // "ellipsis.circle" image button.
        let menuButton = app.menuButtons["pack_detail_more_menu"].exists
            ? app.menuButtons["pack_detail_more_menu"]
            : app.menuButtons["ellipsis.circle"]
        waitFor(menuButton, timeout: 5)
        menuButton.click()

        let editButton = app.menuItems["Edit Pack"].exists
            ? app.menuItems["Edit Pack"]
            : app.buttons["pack_detail_edit_pack"]
        waitFor(editButton, timeout: 3)
        editButton.click()

        let nameField = app.textFields["pack_name"]
        waitFor(nameField)
        nameField.clearAndTypeText(updatedName)

        app.buttons["Save"].click()

        XCTAssertTrue(
            app.staticTexts[updatedName].waitForExistence(timeout: 10),
            "Detail column should reflect updated pack name"
        )
    }

    // MARK: - Delete

    func testDeletePack() throws {
        let packName = uniqueName("E2E Delete Pack")

        createPack(named: packName)
        goToSidebar("Packs")

        let cell = waitFor(app.staticTexts[packName])
        // Right-click invokes the context menu on macOS.
        cell.rightClick()

        let deleteButton = rowDeleteMenuItem()
        waitFor(deleteButton, timeout: 5)
        deleteButton.click()

        waitForAbsence(app.staticTexts[packName], timeout: 10)
    }

    // MARK: - Helpers

    private func createPack(named name: String) {
        goToSidebar("Packs")
        waitFor(app.buttons["packs_new_pack_button"].firstMatch).click()

        let nameField = app.textFields["pack_name"]
        waitFor(nameField)
        nameField.click()
        nameField.typeText(name)

        app.buttons["Create"].click()
        waitFor(app.staticTexts[name], timeout: 15)
    }

    private func openPack(named name: String) {
        goToSidebar("Packs")
        let cell = waitFor(app.staticTexts[name])
        cell.click()
        // Detail column shows the weight summary "Total" label once loaded.
        waitFor(app.staticTexts["Total"], timeout: 10)
    }

    private func addItem(named name: String) {
        let addButton = app.buttons["Add Item"].firstMatch
        waitFor(addButton).click()

        let nameField = app.textFields["pack_item_name"]
        waitFor(nameField)
        nameField.click()
        nameField.typeText(name)

        let weightField = app.textFields["item_weight"]
        if weightField.waitForExistence(timeout: 3) {
            weightField.click()
            weightField.typeText("100")
        }

        app.buttons["Add"].click()

        // Wait for the form sheet to dismiss (Add Item button visible again).
        waitFor(app.buttons["Add Item"].firstMatch, timeout: 10)

        let target = packItemRow(containing: name)
        waitFor(target, timeout: 10, message: "Item '\(name)' must appear in pack detail")
    }

    private func cleanupPack(named name: String) {
        goToSidebar("Packs")
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

    private func packItemRow(containing text: String) -> XCUIElement {
        app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@", "pack_item_row_", text)
        ).firstMatch
    }
}
#endif
