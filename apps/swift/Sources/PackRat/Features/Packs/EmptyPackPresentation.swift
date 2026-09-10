import Foundation

/// Copy for a pack with no items, which reads differently inside packing mode.
///
/// Start Packing used to be disabled on an empty pack, so tapping it did
/// nothing and the greyed-out row explained nothing (#2696). The button is now
/// always enabled and the screen explains itself instead. Apple's guidance is
/// not to disable or hide a control because its content is empty — show it and
/// explain the empty state inside — and the empty-state convention is to say
/// what the space is for, why it is empty, and give one next step.
///
/// Extracted from the view so the copy and the choice between the two cases are
/// directly testable.
struct EmptyPackPresentation: Equatable {
    let isPackingMode: Bool

    var title: String {
        isPackingMode ? "Nothing to Pack Yet" : "No Items Yet"
    }

    var subtitle: String {
        isPackingMode
            ? "This pack is empty, so there is nothing to check off. Add some gear and it will show up here ready to pack."
            : "Add gear to build your pack"
    }

    var systemImage: String {
        isPackingMode ? "checklist.unchecked" : "archivebox"
    }

    /// Both cases lead to the same sheet; only the wording differs, because in
    /// packing mode "Add Item" reads like it would add a checklist row.
    var actionLabel: String {
        isPackingMode ? "Add Gear" : "Add Item"
    }

    var accessibilityIdentifier: String? {
        isPackingMode ? "pack_packing_empty" : nil
    }
}
