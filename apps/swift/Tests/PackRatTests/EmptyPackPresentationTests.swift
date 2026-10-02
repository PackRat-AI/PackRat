import Foundation
import Testing
@testable import PackRat

/// Covers #2696: Start Packing was disabled on a pack with no items, so the
/// menu row sat greyed out and tapping it did nothing. The button is now always
/// enabled and the packing screen explains why it is empty, with a way forward.
@Suite("Empty pack presentation")
struct EmptyPackPresentationTests {

    private let browsing = EmptyPackPresentation(isPackingMode: false)
    private let packing = EmptyPackPresentation(isPackingMode: true)

    @Test("packing mode explains why there is nothing to check off")
    func packingCopyExplainsTheEmptiness() {
        // The reported dead end was a control that "explains nothing", so the
        // replacement has to actually state the reason.
        #expect(packing.title == "Nothing to Pack Yet")
        #expect(packing.subtitle.localizedCaseInsensitiveContains("empty"))
        #expect(packing.subtitle.localizedCaseInsensitiveContains("add"))
    }

    @Test("packing mode differs from the plain empty pack on every visible element")
    func packingDiffersFromBrowsing() {
        // Same screen, two different reasons for being empty. If any of these
        // collapsed to the same string the packing case would be indistinguishable
        // from simply having an empty pack.
        #expect(packing.title != browsing.title)
        #expect(packing.subtitle != browsing.subtitle)
        #expect(packing.systemImage != browsing.systemImage)
        #expect(packing.actionLabel != browsing.actionLabel)
    }

    @Test("both cases offer a way forward rather than a bare label")
    func bothOfferANextStep() {
        // The issue asks for "a next action on the screen — adding gear — so the
        // user is not made to back out and find the + menu themselves".
        for presentation in [browsing, packing] {
            #expect(presentation.actionLabel.isEmpty == false)
            #expect(presentation.actionLabel.localizedCaseInsensitiveContains("add"))
            #expect(presentation.title.isEmpty == false)
            #expect(presentation.subtitle.isEmpty == false)
        }
    }

    @Test("the packing empty state is addressable for UI tests")
    func packingStateHasAStableIdentifier() {
        #expect(packing.accessibilityIdentifier == "pack_packing_empty")
        // The browsing case keeps EmptyStateView's derived identifier, so it
        // must not claim the packing one.
        #expect(browsing.accessibilityIdentifier != "pack_packing_empty")
    }

    @Test("copy stays free of jargon and scolding")
    func copyToneIsPlain() {
        // House rule: no internal jargon in user-facing copy, and empty states
        // should not read as an error the user caused.
        for text in [packing.title, packing.subtitle, browsing.title, browsing.subtitle] {
            for banned in ["nil", "null", "error", "invalid", "failed", "cannot", "can't"] {
                #expect(text.localizedCaseInsensitiveContains(banned) == false,
                        "\"\(text)\" should not contain \"\(banned)\"")
            }
        }
    }
}
