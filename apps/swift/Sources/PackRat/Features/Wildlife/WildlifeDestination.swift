import SwiftUI

/// Picks which wildlife screen the `.wildlife` nav item shows.
///
/// The offline feature is a replacement for the online-only screen, not a
/// second entry beside it — two "Wildlife ID" items in the sidebar would be a
/// worse product than either one alone. So the flag switches the destination
/// rather than adding a nav item, and with `enableOfflineWildlifeID` off the
/// app behaves exactly as it does today.
///
/// Read through `FeatureFlagStore` rather than `AppFeatureFlags` so an
/// admin-panel flip takes effect without a rebuild.
struct WildlifeDestination: View {
    var body: some View {
        if FeatureFlagStore.shared.isEnabled("enableOfflineWildlifeID") {
            OfflineWildlifeView()
        } else {
            WildlifeView()
        }
    }
}
