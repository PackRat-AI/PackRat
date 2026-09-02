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

    var body: some View {
        Group {
            if store.isResolved {
                if store.isAllowed(featureKey) {
                    content()
                } else {
                    gatedView
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
    }

    /// Shown when the viewer is known not to be Pro. The wording matches what
    /// Expo puts on its paywall: the feature opens to everyone later, so this
    /// is a "not yet" rather than a "never".
    private var gatedView: some View {
        VStack(spacing: 16) {
            Image(systemName: "crown.fill")
                .font(.largeTitle)
                .foregroundStyle(.orange)

            Text("Early access")
                .font(.title2.weight(.semibold))

            Text(gatedMessage)
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Text("Subscribe in the PackRat app on your phone to get it now.")
                .font(.footnote)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)

            Button("Check again") { Task { await retry() } }
                .buttonStyle(.borderedProminent)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// Shown on a cold start with nothing cached and no way to reach the API.
    /// Deliberately not the gated view: we do not know this viewer is free, and
    /// telling a paying member to subscribe would be wrong.
    private var cannotVerifyView: some View {
        VStack(spacing: 16) {
            Image(systemName: "wifi.exclamationmark")
                .font(.largeTitle)
                .foregroundStyle(.secondary)

            Text("Can't verify your access")
                .font(.title2.weight(.semibold))

            Text("We couldn't reach our servers. If you're subscribed, connect to the internet and try again.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Button("Try again") { Task { await retry() } }
                .buttonStyle(.borderedProminent)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var gatedMessage: String {
        let name = FeatureAccess.displayName(forAccessKey: featureKey)
        if let until = store.earlyAccessUntil(featureKey) {
            let date = until.formatted(date: .abbreviated, time: .omitted)
            return "\(name) is in early access for Pro members until \(date), then it's free for everyone."
        }
        return "\(name) is in early access for Pro members. It becomes free for everyone when the window ends."
    }

    private func retry() async {
        hasAttempted = false
        await store.refresh()
        hasAttempted = true
    }
}
