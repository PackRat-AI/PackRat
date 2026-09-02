import RevenueCat
import SwiftUI

/// The Subscription section for Preferences.
///
/// Mirrors the section in `apps/expo/app/(app)/settings/index.tsx`, down to the
/// wording, so the two apps describe the same subscription the same way:
/// a plan row ("PackRat Pro" / "Free Plan"), the primary action ("Manage
/// Subscription" / "Upgrade to Pro"), and "Restore Purchases".
struct SubscriptionSettingsSection: View {
    @State private var store = FeatureAccessStore.shared
    @State private var isRestoring = false
    @State private var isPaywallPresented = false
    @State private var alert: RestoreAlert?

    @Environment(\.openURL) private var openURL

    var body: some View {
        Section("Subscription") {
            planRow

            if store.isPro {
                Button("Manage Subscription") { manageSubscription() }
            } else {
                Button("Upgrade to Pro") { isPaywallPresented = true }
            }

            Button {
                Task { await restore() }
            } label: {
                HStack {
                    Text(isRestoring ? "Restoring…" : "Restore Purchases")
                        .foregroundStyle(.secondary)
                    if isRestoring {
                        Spacer()
                        ProgressView()
                    }
                }
            }
            .disabled(isRestoring)
        }
        .fullScreenCover(isPresented: $isPaywallPresented) {
            EarlyAccessPaywall(
                featureKey: nil,
                onDismiss: { isPaywallPresented = false },
                onEntitlementChanged: { isPaywallPresented = false }
            )
        }
        .alert(item: $alert) { alert in
            Alert(title: Text(alert.title), dismissButton: .default(Text("OK")))
        }
        .task { await store.refresh() }
    }

    private var planRow: some View {
        HStack(spacing: 12) {
            Image(systemName: store.isPro ? "crown.fill" : "crown")
                .font(.system(size: 20))
                .foregroundStyle(store.isPro ? .orange : .secondary)
                .frame(width: 38, height: 38)
                .background(
                    (store.isPro ? Color.orange : Color.secondary).opacity(0.14),
                    in: RoundedRectangle(cornerRadius: 10)
                )

            VStack(alignment: .leading, spacing: 2) {
                Text(store.isPro ? "PackRat Pro" : "Free Plan")
                    .font(.body.weight(.semibold))
                Text(store.isPro ? "Full access to all Pro features" : "Upgrade to unlock Pro features")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    private func manageSubscription() {
        guard let url = SubscriptionService.shared.manageSubscriptionsURL() else { return }
        openURL(url)
    }

    private func restore() async {
        isRestoring = true
        defer { isRestoring = false }

        do {
            let customerInfo = try await SubscriptionService.shared.restorePurchases()
            store.apply(customerInfo: customerInfo)
            // Same three outcomes Expo reports, with the same wording.
            alert = RestoreAlert(
                title: store.isPro ? "Pro access restored!" : "No purchases found"
            )
        } catch SubscriptionError.notConfigured {
            alert = RestoreAlert(title: "Purchases aren't available in this build.")
        } catch {
            alert = RestoreAlert(title: "Restore failed. Please try again.")
        }
    }
}

private struct RestoreAlert: Identifiable {
    let id = UUID()
    let title: String
}
