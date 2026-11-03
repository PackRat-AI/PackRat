import SwiftUI

extension WatchWeatherAlertSnapshot {
    /// Severity colour, matching the phone forecast's alert section so a
    /// hazard reads the same on the wrist as it does on the phone.
    var severityColor: Color {
        switch severity?.lowercased() {
        case "extreme": return .red
        case "severe": return .orange
        case "moderate": return .yellow
        default: return .blue
        }
    }

    /// Footer for the other saved locations also carrying an unread alert.
    var othersText: String? {
        switch otherCount {
        case ..<1: return nil
        case 1: return "1 more place has an alert."
        default: return "\(otherCount) more places have alerts."
        }
    }
}

/// Deep link from a complication into the watch app's Weather page.
enum WatchDeepLink {
    static let scheme = "packratwatch"
    static let weather = URL(string: "\(scheme)://weather")!
}
