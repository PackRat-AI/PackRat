import SwiftUI

/// Keeps feature flags and feature access current while the app is in use.
///
/// Cold launch alone is not enough. Phones are rarely relaunched — an app can
/// sit suspended for days — so a flag flipped in the admin panel would not
/// reach a device until the process was killed and started again. Anything
/// decided server-side (a feature turned on, an early-access window closing, a
/// subscription bought or lapsed on another device) would be invisible until
/// then.
///
/// Both refreshes are safe to repeat: each replaces its state wholesale on
/// success and swallows failures, leaving the cached answer in place. That is
/// what makes resuming a fine moment to re-ask.
private struct FeatureRefreshModifier: ViewModifier {
    @Environment(\.scenePhase) private var scenePhase

    func body(content: Content) -> some View {
        content
            .onChange(of: scenePhase) { previous, phase in
                // .active is also entered on the very first foreground, where
                // AuthGateView's .task already refreshes. Requiring a previous
                // phase of .background or .inactive keeps this to genuine
                // resumes rather than duplicating the launch fetch.
                guard phase == .active, previous == .background || previous == .inactive else {
                    return
                }
                Task {
                    // Access first: it decides who may use a feature, and is the
                    // one that changes without us — a subscription bought on
                    // another device, or a lapse.
                    await FeatureAccessStore.shared.refresh()
                    await FeatureFlagStore.shared.refresh()
                }
            }
    }
}

extension View {
    /// Attach once, above the app's content, to re-resolve feature flags and
    /// access whenever the app returns to the foreground.
    func refreshesFeatureStatesOnForeground() -> some View {
        modifier(FeatureRefreshModifier())
    }
}
