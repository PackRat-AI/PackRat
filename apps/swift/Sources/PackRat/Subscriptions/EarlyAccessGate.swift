import SwiftUI

/// Gates a feature by its early-access state, mirroring `EarlyAccessGate` in
/// `apps/expo/features/purchases/components/EarlyAccessGate.tsx`.
///
/// While a feature sits inside its early-access window, Pro members pass and
/// everyone else is held back. Once the window graduates the gate becomes a
/// no-op and simply renders the feature, so nothing has to be flipped a second
/// time.
///
/// # The states, in the order they are decided
///
/// 1. **Unresolved** — signals have not landed yet. Shows a spinner and never a
///    decision, because guessing either way is wrong: paywalling a subscriber
///    is as bad as leaking a gated feature.
/// 2. **Cannot verify** — nothing cached and the fetch failed, so Pro status is
///    genuinely unknown. Shows "Can't verify your access" with a retry rather
///    than assuming.
/// 3. **Gated** — resolved, and this viewer is not Pro. Shows the upgrade
///    prompt.
/// 4. **Allowed** — renders the feature.
///
/// Swift has no paywall to present (buying lives in the Expo app), so where
/// Expo opens a RevenueCat sheet this shows an in-place explanation instead.
/// That is the one deliberate difference; the decision logic is the same, and
/// both sides run the identical resolver from `packages/config`.
struct EarlyAccessGate<Gated: View>: View {
    let featureKey: String
    @ViewBuilder let content: () -> Gated

    @Environment(AppState.self) private var appState

    @State private var store = FeatureAccessStore.shared
    @State private var hasAttempted = false
    @State private var isPaywallPresented = false

    var body: some View {
        Group {
            if store.isResolved {
                if store.isAllowed(featureKey) {
                    content()
                } else {
                    // Nothing behind the paywall. Blank, not a placeholder
                    // pretending to be a screen the viewer can use.
                    // Platform-neutral: systemBackground is UIKit-only, and
                    // this view builds for macOS too.
                    Color.clear
                        .ignoresSafeArea()
                        // Guests see the paywall too. Value first, account at
                        // the point of intent — the CTA routes them to sign in
                        // rather than the screen refusing to open. Bouncing
                        // someone out with no explanation reads as a bug.
                        .onAppear { isPaywallPresented = true }
                }
            } else if hasAttempted {
                // A refresh ran and still left the store unresolved, so the
                // fetch genuinely failed. Only now is "can't verify" honest.
                cannotVerifyView
            } else {
                // Signals in flight. Never decide here — paywalling a
                // subscriber is as wrong as leaking a gated feature.
                ProgressView().controlSize(.large)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .task {
            // Resolve on appear. Cheap when already resolved — the store keeps
            // its answer and this just refreshes it.
            await store.refresh()
            hasAttempted = true
        }
        // Loads the offering first and only opens once there is something to
        // show; a failure keeps the viewer here with an alert. See the modifier.
        .paywall(
            isPresented: $isPaywallPresented,
            featureKey: featureKey,
            onEntitlementChanged: { Task { await store.refresh() } }
        )
        .onChange(of: isPaywallPresented) { wasPresented, isPresented in
            // Dismissed without unlocking: leave, rather than stranding the
            // viewer on a screen they have no access to.
            guard wasPresented, !isPresented, !store.isAllowed(featureKey) else { return }
            appState.navItem = .home
        }
    }

    /// Cold start with nothing cached and the fetch failed, so Pro status is
    /// genuinely unknown. Deliberately not the gated state: telling a paying
    /// member to subscribe would be worse than admitting we cannot tell.
    private var cannotVerifyView: some View {
        VStack(spacing: 20) {
            ZStack {
                Circle()
                    .fill(Color.secondary.opacity(0.12))
                    .frame(width: 76, height: 76)
                Image(systemName: "wifi.exclamationmark")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: 8) {
                Text("Can't verify your access")
                    .font(.title3.weight(.semibold))

                Text("We couldn't reach our servers. If you're subscribed, reconnect and try again.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Button {
                Task { await retry() }
            } label: {
                Text("Try again")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 50)
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 4)
        }
        .padding(28)
        .frame(maxWidth: 420)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func retry() async {
        hasAttempted = false
        await store.refresh()
        hasAttempted = true
    }
}
