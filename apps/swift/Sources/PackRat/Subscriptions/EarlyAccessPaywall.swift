import RevenueCat
import RevenueCatUI
import SwiftUI

/// The early-access paywall — RevenueCat's own paywall, presented full screen.
///
/// This renders the same dashboard-configured template the Expo app presents
/// (`apps/expo/app/(app)/paywall.tsx`), fed the same `earlyaccessmodel`
/// offering, so both platforms sell identical packages with identical copy and
/// pricing. Changing the paywall in the RevenueCat dashboard updates iOS,
/// macOS and Expo together, with no app release on any of them.
///
/// Purchases and restores complete inside this view via the SDK. On success the
/// customer info is pushed straight into `FeatureAccessStore` so the gate
/// behind the paywall re-resolves immediately rather than waiting for the next
/// refresh.
struct EarlyAccessPaywall: View {
    /// The gated feature this paywall was opened for, or nil when opened from
    /// Settings as a general upgrade. Only affects when a restore is treated as
    /// success: a feature gate closes once that feature unlocks, while Settings
    /// closes once the account is Pro at all.
    let featureKey: String?
    let onDismiss: () -> Void
    let onEntitlementChanged: () -> Void

    @State private var offering: Offering?
    @State private var loadFailed = false

    var body: some View {
        Group {
            if let offering {
                PaywallView(offering: offering)
                    .onPurchaseCompleted { customerInfo in
                        FeatureAccessStore.shared.apply(customerInfo: customerInfo)
                        onEntitlementChanged()
                    }
                    .onRestoreCompleted { customerInfo in
                        // Restore reports completion even when the account owns
                        // nothing, so only close if it actually granted access.
                        FeatureAccessStore.shared.apply(customerInfo: customerInfo)
                        if didRestoreGrantAccess() { onEntitlementChanged() }
                    }
            } else if loadFailed {
                unavailableView
            } else {
                loadingView
            }
        }
        .task { await loadOffering() }
        .overlay(alignment: .topTrailing) {
            // The template has no dismiss affordance of its own when presented
            // this way, so the gate always stays escapable.
            if offering == nil { dismissButton }
        }
    }

    private var loadingView: some View {
        ZStack {
            Color(.systemBackground).ignoresSafeArea()
            ProgressView().controlSize(.large)
        }
    }

    /// Offerings could not be fetched — almost always offline, since the
    /// paywall needs live pricing from the store. Never silently strand the
    /// viewer on a blank screen.
    private var unavailableView: some View {
        ZStack {
            Color(.systemBackground).ignoresSafeArea()

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
                    Text("Can't reach the store")
                        .font(.title3.weight(.semibold))

                    Text("Plans and prices need a connection. Reconnect and try again.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Button {
                    Task { await loadOffering() }
                } label: {
                    Text("Try again")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 50)
                }
                .buttonStyle(.borderedProminent)

                Button("Not now", action: onDismiss)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
            }
            .padding(28)
            .frame(maxWidth: 420)
        }
    }

    private var dismissButton: some View {
        Button(action: onDismiss) {
            Image(systemName: "xmark")
                .font(.footnote.weight(.bold))
                .foregroundStyle(.secondary)
                .frame(width: 30, height: 30)
                .background(.regularMaterial, in: Circle())
        }
        .padding(.trailing, 20)
        .padding(.top, 14)
        .accessibilityLabel("Close")
    }

    /// Whether a completed restore actually changed anything for this viewer.
    private func didRestoreGrantAccess() -> Bool {
        guard let featureKey else { return FeatureAccessStore.shared.isPro }
        return FeatureAccessStore.shared.isAllowed(featureKey)
    }

    private func loadOffering() async {
        loadFailed = false
        do {
            offering = try await SubscriptionService.shared.earlyAccessOffering()
            // A configured SDK with no matching offering is a dashboard problem,
            // not a network one, but it looks the same to the viewer.
            if offering == nil { loadFailed = true }
        } catch {
            loadFailed = true
        }
    }
}
