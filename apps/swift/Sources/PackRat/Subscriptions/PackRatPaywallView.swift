import RevenueCat
import SwiftUI

/// PackRat's own early-access paywall.
///
/// Packages, prices and the purchase call come from RevenueCat; every pixel is
/// ours. Prices are read from `localizedPriceString` rather than hardcoded, so
/// they stay correct in every storefront and currency.
///
/// # On the copy
///
/// The job of this screen is to convert. Two things follow from that.
///
/// The headline is an invitation, matching what Expo sends its paywall
/// ("Get early access to {feature} today"), not a description of the pricing
/// model. Nobody subscribes because they understood the graduation schedule.
///
/// And the early-access window is never framed as "free for everyone in N
/// days", which is an argument to close the screen and wait. Where the window
/// appears at all it is scarcity — this is the period during which Pro members
/// have it and others do not.
struct PackRatPaywallView: View {
    let offering: Offering
    /// The gated feature this was opened for, or nil when opened from Settings
    /// as a general upgrade.
    let featureKey: String?
    let onDismiss: () -> Void
    let onEntitlementChanged: () -> Void

    @Environment(AuthManager.self) private var authManager

    @State private var store = FeatureAccessStore.shared
    @State private var selected: Package?
    @State private var phase: Phase = .idle
    @State private var alert: PurchaseAlert?
    @State private var hasAppeared = false

    private enum Phase: Equatable {
        case idle, purchasing, restoring
        var isBusy: Bool { self != .idle }
    }

    /// The app's own accent, from the asset catalog, so the paywall belongs to
    /// PackRat rather than looking like a bolted-on subscription screen.
    private let accent = Color.accentColor

    var body: some View {
        ZStack {
            backdrop

            ScrollView {
                VStack(spacing: 0) {
                    hero
                    valueProps.padding(.top, 30)
                    planPicker.padding(.top, 26)
                }
                .padding(.horizontal, 22)
                .padding(.bottom, 250)
            }
            .scrollIndicators(.hidden)

            VStack { Spacer(); purchaseDock }
                .ignoresSafeArea(edges: .bottom)
        }
        .overlay(alignment: .topTrailing) { closeButton }
        .preferredColorScheme(.dark)
        .alert(item: $alert) {
            Alert(title: Text($0.title), message: Text($0.message),
                  dismissButton: .default(Text("OK")))
        }
        .onAppear {
            if selected == nil { selected = defaultPackage }
            withAnimation(.spring(response: 0.65, dampingFraction: 0.85)) { hasAppeared = true }
        }
    }

    // MARK: - Backdrop

    private var backdrop: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.06, green: 0.11, blue: 0.09),
                         Color(red: 0.03, green: 0.04, blue: 0.04)],
                startPoint: .top, endPoint: .bottom
            )
            RadialGradient(
                colors: [accent.opacity(0.32), .clear],
                center: UnitPoint(x: 0.5, y: 0.02),
                startRadius: 8, endRadius: 460
            )
        }
        .ignoresSafeArea()
    }

    // MARK: - Hero

    private var hero: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle().fill(accent.opacity(0.16)).frame(width: 94, height: 94)
                Circle().stroke(accent.opacity(0.34), lineWidth: 1).frame(width: 94, height: 94)
                Image(systemName: "sparkles")
                    .font(.system(size: 36, weight: .semibold))
                    .foregroundStyle(accent)
                    .shadow(color: accent.opacity(0.5), radius: 16, y: 4)
            }
            .scaleEffect(hasAppeared ? 1 : 0.88)

            VStack(spacing: 10) {
                Text("PACKRAT PRO")
                    .font(.caption.weight(.bold))
                    .tracking(1.7)
                    .foregroundStyle(accent)

                Text(headline)
                    .font(.system(size: 33, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.65)

                Text(subheadline)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.68))
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .opacity(hasAppeared ? 1 : 0)

            if let scarcity {
                HStack(spacing: 7) {
                    Image(systemName: "bolt.fill").font(.caption2.weight(.bold))
                    Text(scarcity)
                        .font(.footnote.weight(.semibold))
                }
                .foregroundStyle(accent)
                .padding(.horizontal, 15)
                .padding(.vertical, 9)
                .background(accent.opacity(0.13), in: Capsule())
                .overlay(Capsule().stroke(accent.opacity(0.28), lineWidth: 1))
            }
        }
        .padding(.top, 56)
    }

    /// An invitation, mirroring Expo's "Get early access to {feature} today".
    private var headline: String {
        guard let featureKey else { return "Unlock everything, first" }
        return "Get \(store.label(featureKey)) today"
    }

    private var subheadline: String {
        if let featureKey, let description = store.description(featureKey) {
            return description
        }
        if let featureKey {
            return "\(store.label(featureKey)) is ready now for PackRat Pro members."
        }
        return "Every new feature, the day it's ready."
    }

    /// Framed as the window during which Pro members have it and others do not.
    /// Never "free for everyone in N days" — that is a reason to close the
    /// screen, and it was on the last version of this paywall.
    private var scarcity: String? {
        guard let featureKey, let days = store.daysUntilGraduation(featureKey) else { return nil }
        return "\(days) \(days == 1 ? "day" : "days") ahead of everyone else"
    }

    // MARK: - Value props

    private var valueProps: some View {
        VStack(spacing: 10) {
            if !otherFeatures.isEmpty {
                valueRow(
                    icon: "square.stack.3d.up.fill",
                    title: "Everything else in early access",
                    detail: otherFeatures.joined(separator: " · ")
                )
            }
            valueRow(
                icon: "arrow.up.forward.circle.fill",
                title: "Every new feature first",
                detail: "New tools land for Pro members before anyone else."
            )
            valueRow(
                icon: "heart.fill",
                title: "You fund the work",
                detail: "PackRat is built by a small team. Pro is what pays for it."
            )
        }
    }

    private func valueRow(icon: String, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 13) {
            Image(systemName: icon)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(accent)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.58))
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 0)
        }
    }

    private var otherFeatures: [String] {
        store.otherEarlyAccessFeatures(excluding: featureKey ?? "")
    }

    // MARK: - Plans

    private var planPicker: some View {
        VStack(spacing: 10) {
            ForEach(offering.availablePackages, id: \.identifier) { planRow($0) }
        }
    }

    private func planRow(_ package: Package) -> some View {
        let isSelected = selected?.identifier == package.identifier
        let isBest = package.identifier == bestValuePackage?.identifier

        return Button {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { selected = package }
        } label: {
            HStack(spacing: 13) {
                ZStack {
                    Circle()
                        .strokeBorder(isSelected ? accent : .white.opacity(0.28), lineWidth: 2)
                        .frame(width: 22, height: 22)
                    if isSelected { Circle().fill(accent).frame(width: 12, height: 12) }
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(title(for: package))
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.white)
                    if let detail = detail(for: package) {
                        Text(detail)
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.55))
                    }
                }

                Spacer(minLength: 8)

                VStack(alignment: .trailing, spacing: 3) {
                    Text(package.localizedPriceString)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.white)
                    if isBest {
                        Text("BEST VALUE")
                            .font(.caption2.weight(.bold))
                            .tracking(0.5)
                            .foregroundStyle(.black)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(accent, in: Capsule())
                    }
                }
            }
            .padding(15)
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(isSelected ? accent.opacity(0.12) : Color.white.opacity(0.05))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(isSelected ? accent.opacity(0.7) : .white.opacity(0.08),
                            lineWidth: isSelected ? 1.6 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func title(for package: Package) -> String {
        let title = package.storeProduct.localizedTitle
        if !title.isEmpty { return title }

        switch package.packageType {
        case .annual: return "Yearly"
        case .monthly: return "Monthly"
        case .weekly: return "Weekly"
        case .lifetime: return "Lifetime"
        case .sixMonth: return "6 Months"
        case .threeMonth: return "3 Months"
        case .twoMonth: return "2 Months"
        default: return package.identifier.capitalized
        }
    }

    private func detail(for package: Package) -> String? {
        switch package.packageType {
        case .annual: return "Billed once a year"
        case .monthly: return "Billed monthly"
        case .weekly: return "Billed weekly"
        case .lifetime: return "One payment, yours for good"
        default: return nil
        }
    }

    /// Longest recurring plan: cheapest per month, and what a subscription app
    /// conventionally highlights. Lifetime is excluded — a different kind of
    /// purchase, not a better-value subscription.
    private var bestValuePackage: Package? {
        let ranked: [PackageType] = [.annual, .sixMonth, .threeMonth, .twoMonth, .monthly, .weekly]
        for type in ranked {
            if let match = offering.availablePackages.first(where: { $0.packageType == type }) {
                return match
            }
        }
        return nil
    }

    private var defaultPackage: Package? {
        bestValuePackage ?? offering.availablePackages.first
    }

    // MARK: - Purchase

    private var purchaseDock: some View {
        VStack(spacing: 11) {
            Button {
                if authManager.isAuthenticated {
                    Task { await purchase() }
                } else {
                    // Value first, account at the point of intent. Goes
                    // straight to sign-in rather than the welcome screen —
                    // tapping this button was already the decision.
                    authManager.signOutForSignIn()
                }
            } label: {
                ZStack {
                    if phase == .purchasing {
                        ProgressView().tint(.black)
                    } else {
                        Text(ctaTitle).font(.headline)
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 52)
                .foregroundStyle(.black)
                .background(
                    LinearGradient(colors: [accent, accent.opacity(0.86)],
                                   startPoint: .top, endPoint: .bottom),
                    in: RoundedRectangle(cornerRadius: 14)
                )
                .shadow(color: accent.opacity(0.3), radius: 14, y: 5)
            }
            .disabled(phase.isBusy || selected == nil)

            if authManager.isAuthenticated {
                Button {
                    Task { await restore() }
                } label: {
                    restoreLabel
                }
                .disabled(phase.isBusy)
            }

            Text(finePrint)
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.4))
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 22)
        .padding(.top, 16)
        .padding(.bottom, 32)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) {
            Rectangle().fill(.white.opacity(0.08)).frame(height: 1)
        }
    }

    @ViewBuilder
    private var restoreLabel: some View {
        if phase == .restoring {
            ProgressView().controlSize(.small).tint(.white)
        } else {
            Text("Restore Purchases")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.white.opacity(0.62))
        }
    }

    /// The standard App Store CTA. "Start Subscription" is not a phrase any
    /// shipping paywall uses.
    private var ctaTitle: String {
        // A guest is one step further out, and the button should say so rather
        // than promising a purchase it will not start.
        guard authManager.isAuthenticated else { return "Sign In to Subscribe" }
        guard let selected else { return "Continue" }
        return selected.packageType == .lifetime ? "Buy Lifetime Access" : "Continue"
    }

    /// Says the one thing a subscriber actually needs before paying: how to get
    /// out. Anything else here is noise.
    private var finePrint: String {
        // Tell a guest what the next tap does before they take it, so the jump
        // to sign-in is expected rather than a surprise.
        guard authManager.isAuthenticated else {
            return "Subscriptions are tied to your PackRat account, so you'll sign in first."
        }
        guard let selected, selected.packageType != .lifetime else {
            return "One payment. No subscription."
        }
        return "Auto-renews until cancelled. Cancel anytime."
    }

    private var closeButton: some View {
        Button(action: onDismiss) {
            Image(systemName: "xmark")
                .font(.footnote.weight(.bold))
                .foregroundStyle(.white.opacity(0.7))
                .frame(width: 30, height: 30)
                .background(.white.opacity(0.13), in: Circle())
        }
        .padding(.trailing, 18)
        .padding(.top, 12)
        .accessibilityLabel("Close")
    }

    private func purchase() async {
        guard let package = selected else { return }
        phase = .purchasing
        defer { phase = .idle }

        do {
            let outcome = try await SubscriptionService.shared.purchase(package: package)
            switch outcome {
            case .purchased(let customerInfo):
                store.apply(customerInfo: customerInfo)
                onEntitlementChanged()
            case .cancelled:
                // Backing out of a purchase is ordinary. Say nothing.
                break
            }
        } catch {
            alert = .purchaseFailed
        }
    }

    private func restore() async {
        phase = .restoring
        defer { phase = .idle }

        do {
            let customerInfo = try await SubscriptionService.shared.restorePurchases()
            store.apply(customerInfo: customerInfo)
            if granted {
                onEntitlementChanged()
            } else {
                alert = .nothingToRestore
            }
        } catch {
            alert = .restoreFailed
        }
    }

    private var granted: Bool {
        guard let featureKey else { return store.isPro }
        return store.isAllowed(featureKey)
    }
}

/// Copy for someone who just tried to pay. No internal vocabulary, and each one
/// says whether trying again is worthwhile.
private struct PurchaseAlert: Identifiable {
    let id = UUID()
    let title: String
    let message: String

    static let purchaseFailed = PurchaseAlert(
        title: "Purchase Didn't Go Through",
        message: "You haven't been charged. Please try again."
    )

    static let nothingToRestore = PurchaseAlert(
        title: "Nothing to Restore",
        message: "We couldn't find a subscription on this account."
    )

    static let restoreFailed = PurchaseAlert(
        title: "Restore Failed",
        message: "Please try again in a moment."
    )
}
