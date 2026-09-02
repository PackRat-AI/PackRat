import RevenueCat
import SwiftUI

/// Loads the offering, then presents the paywall — the pattern every
/// subscription app follows.
///
/// A paywall only opens once there is something to show. When offerings cannot
/// be fetched the viewer stays where they were and gets a short alert, rather
/// than being pushed into a full-screen error they did not ask for.
private struct PaywallPresenter: ViewModifier {
    @Binding var isPresented: Bool
    let featureKey: String?
    let onEntitlementChanged: () -> Void

    @State private var offering: Offering?
    @State private var isLoading = false
    @State private var failure: PaywallFailure?

    func body(content: Content) -> some View {
        content
            .onChange(of: isPresented) { _, wanted in
                if wanted {
                    Task { await load() }
                } else {
                    offering = nil
                }
            }
            .overlay {
                // A brief inline spinner while offerings load. Deliberately not
                // a full-screen takeover — the viewer has tapped once and
                // nothing has been committed yet.
                if isLoading {
                    ZStack {
                        Color.black.opacity(0.12).ignoresSafeArea()
                        ProgressView()
                            .controlSize(.large)
                            .padding(22)
                            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
                    }
                }
            }
            .fullScreenCover(item: $offering) { loaded in
                PackRatPaywallView(
                    offering: loaded,
                    featureKey: featureKey,
                    onDismiss: {
                        offering = nil
                        isPresented = false
                    },
                    onEntitlementChanged: {
                        offering = nil
                        isPresented = false
                        onEntitlementChanged()
                    }
                )
            }
            .onChange(of: offering) { _, current in
                // The template's own close button clears the cover; keep the
                // caller's binding in step so it can be reopened.
                if current == nil, isPresented, !isLoading { isPresented = false }
            }
            .alert(item: $failure) { failure in
                Alert(
                    title: Text(failure.title),
                    message: Text(failure.message),
                    dismissButton: .default(Text("OK"))
                )
            }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }

        do {
            guard let loaded = try await SubscriptionService.shared.earlyAccessOffering() else {
                // The SDK answered but no offering is configured. Nothing the
                // viewer can do, so do not invite a retry.
                failure = .unavailable
                isPresented = false
                return
            }
            offering = loaded
        } catch SubscriptionError.notConfigured {
            failure = .unavailable
            isPresented = false
        } catch {
            failure = .couldNotLoad
            isPresented = false
        }
    }
}

/// Failure copy written for someone who has no idea what RevenueCat, an
/// "offering" or "the store" is. They tapped a locked feature; the message
/// should say whether waiting helps, and nothing more.
private struct PaywallFailure: Identifiable {
    let id = UUID()
    let title: String
    let message: String

    /// Our side: no API key in this build, or no offering configured. Retrying
    /// will not help, so the copy does not suggest it.
    static let unavailable = PaywallFailure(
        title: "Upgrades Unavailable",
        message: "Subscriptions aren't available right now. Please try again later."
    )

    /// A transient fetch failure, usually the network. Retrying is reasonable.
    static let couldNotLoad = PaywallFailure(
        title: "Couldn't Load Plans",
        message: "Check your connection and try again."
    )
}

extension Offering: @retroactive Identifiable {
    public var id: String { identifier }
}

extension View {
    /// Presents the early-access paywall, loading its offering first.
    ///
    /// Set `isPresented` to true to begin. If the offering cannot be loaded the
    /// paywall never opens and an alert explains why — what a viewer expects
    /// from a tap that could not be honoured.
    func paywall(
        isPresented: Binding<Bool>,
        featureKey: String? = nil,
        onEntitlementChanged: @escaping () -> Void = {}
    ) -> some View {
        modifier(
            PaywallPresenter(
                isPresented: isPresented,
                featureKey: featureKey,
                onEntitlementChanged: onEntitlementChanged
            )
        )
    }
}
