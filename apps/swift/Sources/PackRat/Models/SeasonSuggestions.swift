// Extensions for generated SeasonSuggestion* types.
// Core struct definitions live in Models/Generated.swift.

import SwiftUI

extension SeasonSuggestion: Identifiable {
    var id: String { name }
}

extension SeasonSuggestionItem: Identifiable {
    var id: String { name }

    var displayWeight: String {
        guard let w = weight, w > 0, let u = weightUnit else { return "" }
        return "\(w) \(u)"
    }
}
