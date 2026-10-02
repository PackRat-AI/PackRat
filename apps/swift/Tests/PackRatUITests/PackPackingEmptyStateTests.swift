import XCTest

/// Covers #2696 on a real device run: Start Packing was disabled on a pack with
/// no items, so the row sat greyed out and tapping it did nothing.
///
/// Runs in guest mode, which needs no credentials — a locally created guest
/// pack starts empty, which is exactly the reported case.
final class PackPackingEmptyStateTests: AppUITestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments.append("--disable-animations")
        app.launchArguments.append("--use-userdefaults-auth")
        app.launchArguments.append("--reset-auth")
        app.launch()
    }

    #if os(iOS)
    func testStartPackingOpensEmptyStateOnAnEmptyPack() {
        enterGuestMode()

        let packName = uniqueName("Packing Empty State")
        createEmptyGuestPack(named: packName)
        waitFor(app.staticTexts[packName], timeout: 10).tap()

        // The pack has no items, so the reported symptom would be a disabled row.
        let menu = waitFor(app.buttons["pack_detail_more_menu"].firstMatch, timeout: 10)
        menu.tap()

        let startPacking = waitFor(app.buttons["pack_detail_start_packing"], timeout: 10)
        XCTAssertTrue(
            startPacking.isEnabled,
            "Start Packing must stay enabled on an empty pack (#2696) — a greyed-out row explains nothing"
        )
        startPacking.tap()

        // The screen must open and explain itself rather than doing nothing.
        XCTAssertTrue(
            app.staticTexts["Nothing to Pack Yet"].waitForExistence(timeout: 10),
            "Packing an empty pack should open an empty state that says why it is empty"
        )

        // And it must offer the way forward, not make the user back out.
        XCTAssertTrue(
            app.buttons["Add Gear"].firstMatch.waitForExistence(timeout: 5),
            "The packing empty state should offer Add Gear as the next step"
        )

        // The progress card would read "0 of 0 packed" at 0%, which reads like a bug.
        XCTAssertEqual(
            packingHeaderElements.count, 0,
            "The progress card should be hidden when there is nothing to pack"
        )

        // The packing toolbar acts on items, so it has nothing to do here.
        XCTAssertFalse(
            app.buttons["pack_packing_reset"].exists,
            "Reset should not be offered when there is nothing packed to reset"
        )
        XCTAssertFalse(
            app.buttons["pack_packing_mark_all"].exists,
            "Mark All Packed should not be offered when there is nothing to pack"
        )

        // Attached so the fixed screen is visible in the result bundle rather
        // than only asserted on.
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "2696-packing-empty-state"
        shot.lifetime = .keepAlways
        add(shot)
    }

    /// The regression guard for the toolbar change: with items present the
    /// packing screen must still show progress and the Reset / Mark All Packed
    /// controls, so hiding them on an empty pack cannot hide them everywhere.
    func testPackingKeepsProgressAndToolbarWhenThePackHasItems() {
        enterGuestMode()

        let packName = uniqueName("Packing With Items")
        createEmptyGuestPack(named: packName)
        waitFor(app.staticTexts[packName], timeout: 10).tap()

        addItem(named: "Tent")

        waitFor(app.buttons["pack_detail_more_menu"].firstMatch, timeout: 10).tap()
        waitFor(app.buttons["pack_detail_start_packing"], timeout: 10).tap()

        // The identifier lands on the card's children (the count label, the bar,
        // the filter) rather than a container, so match on any element type.
        XCTAssertTrue(
            packingHeaderElements.firstMatch.waitForExistence(timeout: 10),
            "A pack with items must still show the packing progress card"
        )
        XCTAssertTrue(
            app.buttons["pack_packing_mark_all"].waitForExistence(timeout: 5),
            "A pack with items must still offer Mark All Packed"
        )
        XCTAssertFalse(
            app.staticTexts["Nothing to Pack Yet"].exists,
            "A pack with items is not the empty case"
        )
    }

    #endif

    // MARK: - Helpers

    /// Every element carrying the progress card's identifier, of any type.
    private var packingHeaderElements: XCUIElementQuery {
        app.descendants(matching: .any).matching(identifier: "pack_packing_header")
    }

    private func enterGuestMode() {
        let continueButton = app.buttons["auth_continue_without_login"]
        XCTAssertTrue(continueButton.waitForExistence(timeout: 15))
        continueButton.tap()
        XCTAssertTrue(waitForLoggedIn(timeout: 15), "Guest mode should enter the main app shell")
    }

    #if os(iOS)
    private func createEmptyGuestPack(named name: String) {
        goToTab("Packs")
        waitFor(app.buttons["New Pack"].firstMatch, timeout: 15).tap()

        let nameField = app.textFields["pack_name"]
        waitFor(nameField, timeout: 10)
        nameField.tap()
        nameField.typeText(name)

        app.buttons["Create"].tap()
        waitFor(app.staticTexts[name], timeout: 15)
    }

    private func addItem(named name: String) {
        waitFor(app.buttons["pack_detail_add_item_button"], timeout: 10).tap()
        waitFor(app.buttons["pack_detail_add_manually"], timeout: 10).tap()

        let nameField = app.textFields["pack_item_name"]
        waitFor(nameField, timeout: 10)
        nameField.tap()
        nameField.typeText(name)

        app.buttons["Add"].firstMatch.tap()
        waitFor(app.staticTexts[name], timeout: 15)
    }
    #endif
}
