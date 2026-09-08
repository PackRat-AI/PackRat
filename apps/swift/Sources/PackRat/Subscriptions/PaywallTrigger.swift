import Observation
import SwiftUI

/// Lets a row deep inside a `Form` ask for the paywall while the screen root
/// owns the presentation.
///
/// `Section` is a nested, conditionally-rendered container: a `sheet` or
/// `fullScreenCover` attached inside one is not reliably installed on the
/// presenting controller, which is why "Upgrade to Pro" in Settings dimmed the
/// screen (the offering loaded) and then opened nothing. SwiftUI wants
/// presentation attached at the root of the hierarchy — so the request and the
/// presentation are split: the row sets `isRequested`, the screen root carries
/// `.paywall(...)`.
@Observable
final class PaywallTrigger {
    /// Set by whichever row wants the paywall. The root's `.paywall` modifier
    /// consumes it and resets it — see `PaywallPresenter`.
    var isRequested = false

    /// The gated feature this request came from, if any, so the paywall can
    /// speak to what the viewer was reaching for.
    var featureKey: String?

    func request(featureKey: String? = nil) {
        self.featureKey = featureKey
        isRequested = true
    }
}

extension Optional where Wrapped == PaywallTrigger {
    /// Requests the paywall, and in debug builds trips an assertion when the
    /// hosting screen forgot `hostsPaywall`. A nil trigger is exactly the
    /// silent no-op this whole type exists to prevent, so it should fail during
    /// development rather than ship as a dead button.
    func request(featureKey: String? = nil) {
        guard let self else {
            assertionFailure(
                "Paywall requested with no host. Add .hostsPaywall(_:) at this screen's root."
            )
            return
        }
        self.request(featureKey: featureKey)
    }
}

private struct PaywallTriggerKey: EnvironmentKey {
    static let defaultValue: PaywallTrigger? = nil
}

extension EnvironmentValues {
    /// Absent by default: a screen that has not opted in to hosting the paywall
    /// should not silently swallow a request for one.
    var paywallTrigger: PaywallTrigger? {
        get { self[PaywallTriggerKey.self] }
        set { self[PaywallTriggerKey.self] = newValue }
    }
}
