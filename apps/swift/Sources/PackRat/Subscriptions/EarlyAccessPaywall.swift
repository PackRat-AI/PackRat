import SwiftUI

/// The early-access paywall — a full-screen modal presented when a free viewer
/// opens a feature still inside its Pro-only window.
///
/// Carries the same content the Expo app feeds into its RevenueCat paywall
/// template (feature name, description, days until it opens to everyone, and
/// other features currently in early access), rendered natively because the
/// Swift client has no RevenueCat paywall UI.
///
/// The pitch is "early access", not "premium". Every gated feature graduates to
/// free on its own date, so the offer is getting it sooner — never getting it at
/// all. The countdown is the hook, and it is the honest one.
struct EarlyAccessPaywall: View {
    let featureKey: String
    let onDismiss: () -> Void
    let onEntitlementChanged: () -> Void

    @State private var store = FeatureAccessStore.shared
    @State private var isWorking = false
    @State private var errorMessage: String?
    @State private var hasAppeared = false

    @Environment(\.dynamicTypeSize) private var typeSize

    private let brand = Color(red: 0.98, green: 0.62, blue: 0.11)

    var body: some View {
        ZStack {
            backdrop

            ScrollView {
                VStack(spacing: 0) {
                    hero
                    countdownPill
                        .padding(.top, 28)
                    benefits
                        .padding(.top, 32)
                    if !otherFeatures.isEmpty {
                        alsoUnlocks
                            .padding(.top, 20)
                    }
                    Spacer(minLength: 32)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 220)
            }
            .scrollIndicators(.hidden)

            VStack(spacing: 0) {
                Spacer()
                actionDock
            }
            .ignoresSafeArea(edges: .bottom)
        }
        .overlay(alignment: .topTrailing) { dismissButton }
        .preferredColorScheme(.dark)
        .onAppear {
            withAnimation(.spring(response: 0.7, dampingFraction: 0.8)) { hasAppeared = true }
        }
    }

    // MARK: - Backdrop

    /// A warm vertical gradient with a soft radial bloom behind the crown, so
    /// the screen reads as a considered surface rather than a plain sheet.
    private var backdrop: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.09, green: 0.08, blue: 0.13),
                    Color(red: 0.05, green: 0.05, blue: 0.07),
                ],
                startPoint: .top,
                endPoint: .bottom
            )

            RadialGradient(
                colors: [brand.opacity(0.34), .clear],
                center: UnitPoint(x: 0.5, y: 0.08),
                startRadius: 4,
                endRadius: 420
            )
        }
        .ignoresSafeArea()
    }

    // MARK: - Hero

    private var hero: some View {
        VStack(spacing: 18) {
            ZStack {
                Circle()
                    .fill(brand.opacity(0.16))
                    .frame(width: 104, height: 104)
                    .blur(radius: 2)

                Circle()
                    .stroke(brand.opacity(0.35), lineWidth: 1)
                    .frame(width: 104, height: 104)

                Image(systemName: "crown.fill")
                    .font(.system(size: 42, weight: .semibold))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [brand, brand.opacity(0.75)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .shadow(color: brand.opacity(0.5), radius: 18, y: 4)
            }
            .scaleEffect(hasAppeared ? 1 : 0.86)
            .opacity(hasAppeared ? 1 : 0)

            VStack(spacing: 10) {
                Text("EARLY ACCESS")
                    .font(.caption.weight(.bold))
                    .tracking(1.6)
                    .foregroundStyle(brand)

                Text(store.label(featureKey))
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.7)

                Text(
                    store.description(featureKey)
                        ?? "Be first to use \(store.label(featureKey)) — weeks before everyone else."
                )
                .font(.body)
                .foregroundStyle(.white.opacity(0.68))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            }
            .opacity(hasAppeared ? 1 : 0)
            .offset(y: hasAppeared ? 0 : 12)
        }
        .padding(.top, 56)
    }

    // MARK: - Countdown

    /// The single most persuasive true fact on the screen: this is temporary.
    private var countdownPill: some View {
        HStack(spacing: 10) {
            Image(systemName: "clock.fill")
                .font(.footnote.weight(.semibold))
            Text(countdownText)
                .font(.subheadline.weight(.semibold))
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 18)
        .padding(.vertical, 11)
        .background(.white.opacity(0.10), in: Capsule())
        .overlay(Capsule().stroke(.white.opacity(0.14), lineWidth: 1))
    }

    private var countdownText: String {
        guard let days = store.daysUntilGraduation(featureKey) else {
            return "Free for everyone soon"
        }
        return "Free for everyone in \(days) \(days == 1 ? "day" : "days")"
    }

    // MARK: - Benefits

    private var benefits: some View {
        VStack(spacing: 14) {
            benefitRow(
                icon: "bolt.fill",
                title: "Use it now",
                detail: "Skip the wait on \(store.label(featureKey)) and everything else in early access."
            )
            benefitRow(
                icon: "lock.open.fill",
                title: "Nothing is taken away",
                detail: "Features only ever move from Pro-first to free. You never lose access."
            )
            benefitRow(
                icon: "arrow.triangle.2.circlepath",
                title: "Cancel anytime",
                detail: "Managed by the App Store, alongside your other subscriptions."
            )
        }
    }

    private func benefitRow(icon: String, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.footnote.weight(.bold))
                .foregroundStyle(brand)
                .frame(width: 30, height: 30)
                .background(brand.opacity(0.14), in: RoundedRectangle(cornerRadius: 9))

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.6))
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 0)
        }
        .padding(14)
        .background(.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(.white.opacity(0.07), lineWidth: 1)
        )
    }

    // MARK: - Cross-sell

    private var alsoUnlocks: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Also in early access")
                .font(.caption.weight(.semibold))
                .tracking(0.6)
                .foregroundStyle(.white.opacity(0.5))

            VStack(alignment: .leading, spacing: 9) {
                ForEach(otherFeatures, id: \.self) { name in
                    HStack(spacing: 9) {
                        Image(systemName: "checkmark")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(brand)
                        Text(name)
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.85))
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(.white.opacity(0.07), lineWidth: 1)
        )
    }

    // MARK: - Actions

    /// Pinned to the bottom over a material blur so the primary action stays
    /// reachable however far the content scrolls.
    private var actionDock: some View {
        VStack(spacing: 12) {
            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.75))
                    .multilineTextAlignment(.center)
                    .transition(.opacity)
            }

            Button {
                Task { await checkAccess() }
            } label: {
                ZStack {
                    if isWorking {
                        ProgressView().tint(.black)
                    } else {
                        Text("I already subscribed")
                            .font(.headline)
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 52)
                .foregroundStyle(.black)
                .background(
                    LinearGradient(
                        colors: [brand, brand.opacity(0.86)],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    in: RoundedRectangle(cornerRadius: 14)
                )
                .shadow(color: brand.opacity(0.3), radius: 16, y: 6)
            }
            .disabled(isWorking)

            // Buying happens in the Expo app — the Swift client reads
            // entitlements but has no purchase flow — so the screen says where
            // to subscribe rather than offering a button that cannot work.
            Text("Subscribe in PackRat on your phone. Your subscription applies here automatically.")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.45))
                .multilineTextAlignment(.center)

            Button("Maybe later", action: onDismiss)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.white.opacity(0.6))
                .padding(.top, 2)
        }
        .padding(.horizontal, 24)
        .padding(.top, 18)
        .padding(.bottom, 34)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(.white.opacity(0.08))
                .frame(height: 1)
        }
    }

    private var dismissButton: some View {
        Button(action: onDismiss) {
            Image(systemName: "xmark")
                .font(.footnote.weight(.bold))
                .foregroundStyle(.white.opacity(0.75))
                .frame(width: 30, height: 30)
                .background(.white.opacity(0.12), in: Circle())
        }
        .padding(.trailing, 20)
        .padding(.top, 14)
        .accessibilityLabel("Close")
    }

    private var otherFeatures: [String] {
        store.otherEarlyAccessFeatures(excluding: featureKey)
    }

    private func checkAccess() async {
        isWorking = true
        errorMessage = nil
        await store.refresh()
        isWorking = false

        if store.isAllowed(featureKey) {
            onEntitlementChanged()
        } else {
            withAnimation {
                errorMessage = "No active subscription found for this account."
            }
        }
    }
}
