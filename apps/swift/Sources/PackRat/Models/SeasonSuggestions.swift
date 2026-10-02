// Extensions for generated SeasonSuggestion* types.
// Core struct definitions live in Models/Generated.swift.

import SwiftUI

extension SeasonSuggestion: Identifiable {
    var id: String { name }
}

extension SeasonSuggestionItem: Identifiable {
    var id: String { name }

    /// The item's own stored weight and unit, unconverted.
    ///
    /// Prefer `displayWeight(in:)` for UI so the app-wide preference applies.
    var displayWeight: String {
        guard let w = weight, w > 0, let u = weightUnit else { return "" }
        return "\(w) \(u)"
    }

    /// The item's weight converted into the user's preferred unit.
    ///
    /// The suggestion payload carries the unit as a free-form string rather than
    /// the `WeightUnit` enum, so it goes through `WeightUnit(apiValue:)`, which
    /// also absorbs the legacy spellings ("lbs", "grams", …). An unrecognized
    /// unit falls back to the unconverted string rather than silently claiming
    /// the wrong unit.
    func displayWeight(in unit: AppWeightUnit) -> String {
        guard let w = weight, w > 0, let u = weightUnit else { return "" }
        guard let source = WeightUnit(apiValue: u) else { return "\(w) \(u)" }
        return unit.display(w, from: source)
    }
}
