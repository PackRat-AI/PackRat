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
struct EarlyAccessGate<Content: View>: View {
    let featureKey: String
    @ViewBuilder let content: () -> Content

    @State private var store = FeatureAccessStore.shared
    @State private var hasAttempted = false
    @State private var isPaywallPresented = false

    var body: some View {
        Group {
            if store.isResolved {
                if store.isAllowed(featureKey) {
                    content()
                } else {
                    gatedView
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
        // A full-screen modal, the way Expo presents its RevenueCat paywall and
        // the way every subscription app does it — never markup rendered inside
        // the gated screen. Dismissing leaves the viewer on the locked state
        // behind it, which explains the gate and can reopen this.
        .fullScreenCover(isPresented: $isPaywallPresented) {
            EarlyAccessPaywall(
                featureKey: featureKey,
                onDismiss: { isPaywallPresented = false },
                onEntitlementChanged: { isPaywallPresented = false }
            )
        }
    }

    /// The state behind the paywall modal. Kept deliberately quiet — the modal
    /// carries the pitch — but it has to stand on its own when the viewer
    /// dismisses, so it explains the lock and offers a way back in.
    private var gatedView: some View {
        VStack(spacing: 20) {
            ZStack {
                Circle()
                    .fill(Color.orange.opacity(0.12))
                    .frame(width: 76, height: 76)
                Image(systemName: "crown.fill")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(.orange)
            }

            VStack(spacing: 8) {
                Text(store.label(featureKey))
                    .font(.title2.weight(.semibold))
                    .multilineTextAlignment(.center)

                Text(gatedMessage)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Button {
                isPaywallPresented = true
            } label: {
                Text("See what's included")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 50)
            }
            .buttonStyle(.borderedProminent)
            .tint(.orange)
            .padding(.top, 4)
        }
        .padding(28)
        .frame(maxWidth: 420)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
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

    private var gatedMessage: String {
        if let days = store.daysUntilGraduation(featureKey) {
            let unit = days == 1 ? "day" : "days"
            return "In early access for PackRat Pro. Free for everyone in \(days) \(unit)."
        }
        return "In early access for PackRat Pro. Free for everyone once the window ends."
    }

    private func retry() async {
        hasAttempted = false
        await store.refresh()
        hasAttempted = true
    }
}
