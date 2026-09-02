import RevenueCat
import SwiftUI

/// PackRat's own early-access paywall.
///
/// Packages, prices and the purchase call come from RevenueCat; every pixel is
/// ours. Prices are always read from `localizedPriceString` rather than
/// hardcoded, so they stay correct in every storefront and currency.
///
/// The pitch is early access, not premium. Each gated feature graduates to free
/// on its own date, so the honest hook is *sooner* — and the countdown says so
/// rather than implying the feature is paid forever.
struct PackRatPaywallView: View {
    let offering: Offering
    /// The gated feature this was opened for, or nil when opened from Settings
    /// as a general upgrade.
    let featureKey: String?
    let onDismiss: () -> Void
    let onEntitlementChanged: () -> Void

    @State private var store = FeatureAccessStore.shared
    @State private var selected: Package?
    @State private var phase: Phase = .idle
    @State private var alert: PurchaseAlert?
    @State private var hasAppeared = false

    private enum Phase: Equatable {
        case idle, purchasing, restoring
        var isBusy: Bool { self != .idle }
    }

    private let accent = Color(red: 0.98, green: 0.64, blue: 0.13)

    var body: some View {
        ZStack {
            backdrop

            ScrollView {
                VStack(spacing: 0) {
                    hero
                    if !benefits.isEmpty {
                        benefitList.padding(.top, 30)
                    }
                    planPicker.padding(.top, 28)
                }
                .padding(.horizontal, 22)
                .padding(.bottom, 240)
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
                colors: [Color(red: 0.10, green: 0.09, blue: 0.14),
                         Color(red: 0.04, green: 0.04, blue: 0.06)],
                startPoint: .top, endPoint: .bottom
            )
            RadialGradient(
                colors: [accent.opacity(0.30), .clear],
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
                Circle().fill(accent.opacity(0.15)).frame(width: 96, height: 96)
                Circle().stroke(accent.opacity(0.32), lineWidth: 1).frame(width: 96, height: 96)
                Image(systemName: "crown.fill")
                    .font(.system(size: 38, weight: .semibold))
                    .foregroundStyle(accent)
                    .shadow(color: accent.opacity(0.45), radius: 16, y: 4)
            }
            .scaleEffect(hasAppeared ? 1 : 0.88)

            VStack(spacing: 9) {
                Text("PACKRAT PRO")
                    .font(.caption.weight(.bold))
                    .tracking(1.7)
                    .foregroundStyle(accent)

                Text(headline)
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.65)

                Text(subheadline)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.65))
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .opacity(hasAppeared ? 1 : 0)

            if let days = daysRemaining {
                HStack(spacing: 7) {
                    Image(systemName: "clock.fill").font(.caption2.weight(.bold))
                    Text("Free for everyone in \(days) \(days == 1 ? "day" : "days")")
                        .font(.footnote.weight(.semibold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 15)
                .padding(.vertical, 9)
                .background(.white.opacity(0.11), in: Capsule())
                .overlay(Capsule().stroke(.white.opacity(0.15), lineWidth: 1))
            }
        }
        .padding(.top, 58)
    }

    private var headline: String {
        guard let featureKey else { return "Get every feature first" }
        return store.label(featureKey)
    }

    private var subheadline: String {
        if let featureKey, let description = store.description(featureKey) {
            return description
        }
        return "Use new features weeks before they open up to everyone."
    }

    private var daysRemaining: Int? {
        guard let featureKey else { return nil }
        return store.daysUntilGraduation(featureKey)
    }

    // MARK: - Benefits

    /// Other features currently in early access. Real cross-sell, pulled from
    /// the same config that drives the gates, so it never goes stale.
    private var benefits: [String] {
        store.otherEarlyAccessFeatures(excluding: featureKey ?? "")
    }

    private var benefitList: some View {
        VStack(alignment: .leading, spacing: 11) {
            Text("ALSO IN EARLY ACCESS")
                .font(.caption2.weight(.bold))
                .tracking(1.1)
                .foregroundStyle(.white.opacity(0.45))

            ForEach(benefits, id: \.self) { name in
                HStack(spacing: 10) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.footnote)
                        .foregroundStyle(accent)
                    Text(name)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.88))
                    Spacer(minLength: 0)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(.white.opacity(0.07), lineWidth: 1))
    }

    // MARK: - Plans

    private var planPicker: some View {
        VStack(spacing: 10) {
            ForEach(offering.availablePackages, id: \.identifier) { package in
                planRow(package)
            }
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
                    if isSelected {
                        Circle().fill(accent).frame(width: 12, height: 12)
                    }
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

                VStack(alignment: .trailing, spacing: 2) {
                    Text(package.localizedPriceString)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.white)
                    if isBest {
                        Text("BEST VALUE")
                            .font(.caption2.weight(.bold))
                            .tracking(0.5)
                            .foregroundStyle(accent)
                    }
                }
            }
            .padding(15)
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(isSelected ? accent.opacity(0.11) : Color.white.opacity(0.05))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(isSelected ? accent.opacity(0.65) : .white.opacity(0.08),
                            lineWidth: isSelected ? 1.6 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    /// Prefer the store's own product title; fall back to the package type so a
    /// dashboard with blank titles still reads sensibly.
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

    /// Longest recurring plan wins the badge — the cheapest per month, and what
    /// a subscription app conventionally highlights. Lifetime is excluded: it is
    /// a different kind of purchase, not a better-value subscription.
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
                Task { await purchase() }
            } label: {
                ZStack {
                    if phase == .purchasing {
                        ProgressView().tint(.black)
                    } else {
                        Text(ctaTitle)
                            .font(.headline)
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 52)
                .foregroundStyle(.black)
                .background(
                    LinearGradient(colors: [accent, accent.opacity(0.85)],
                                   startPoint: .top, endPoint: .bottom),
                    in: RoundedRectangle(cornerRadius: 14)
                )
                .shadow(color: accent.opacity(0.28), radius: 14, y: 5)
            }
            .disabled(phase.isBusy || selected == nil)

            Button {
                Task { await restore() }
            } label: {
                if phase == .restoring {
                    ProgressView().controlSize(.small).tint(.white)
                } else {
                    Text("Restore Purchases")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.white.opacity(0.65))
                }
            }
            .disabled(phase.isBusy)

            Text("Cancel anytime in Settings. Features you unlock stay unlocked.")
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

    private var ctaTitle: String {
        guard let selected else { return "Continue" }
        return selected.packageType == .lifetime ? "Unlock Forever" : "Start Subscription"
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

/// Copy written for someone who just tried to pay. No internal vocabulary, and
/// each one says whether trying again is worth it.
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
