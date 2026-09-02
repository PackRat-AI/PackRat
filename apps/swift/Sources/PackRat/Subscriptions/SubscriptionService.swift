import Foundation
import RevenueCat
import Sentry

/// RevenueCat integration for iOS and macOS.
///
/// Mirrors `apps/expo/features/purchases/lib/revenueCat.ts`: same single
/// entitlement, same app-user-id convention (the RevenueCat app user id *is*
/// our `users.id`, which is what lets the webhook attribute an entitlement row
/// to an account), and the same no-op-when-unconfigured behaviour.
///
/// Two things are deliberately out of scope here, matching what Expo actually
/// gates on today rather than everything its purchases module can do:
///   - the paywall and purchase flow (`PurchasesUI`, offerings, restore)
///   - per-product logic
/// This is the entitlement-*reading* half. Selling comes later.
///
/// The watch app does not use this type. It receives resolved entitlement state
/// from the phone over WatchConnectivity — see `WatchCompanionService`.
@MainActor
final class SubscriptionService {
    static let shared = SubscriptionService()

    /// Whether an API key was supplied at build time. When false the SDK is
    /// never configured and every entitlement read resolves to "not Pro", so a
    /// keyless build leaves gated features closed rather than crashing or
    /// silently opening them.
    private(set) var isConfigured = false

    private init() {}

    /// The build-time RevenueCat key (xcconfig → Info.plist → runtime).
    /// Empty or absent disables purchases entirely.
    static var apiKey: String? {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "REVENUECAT_API_KEY") as? String
        else { return nil }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    /// Configures the SDK. Safe to call more than once; later calls are ignored.
    /// Call once at app launch, before any entitlement read.
    func configure() {
        guard !isConfigured, let apiKey = Self.apiKey else { return }

        Purchases.logLevel = APIClient.isNonProduction ? .debug : .warn
        Purchases.configure(withAPIKey: apiKey)
        isConfigured = true
    }

    /// Associates purchases with a signed-in PackRat user.
    ///
    /// The RevenueCat app user id is our `users.id`, which is the join the
    /// webhook relies on to write an entitlement row against the right account.
    /// Getting this wrong means a real purchase never reaches the database.
    func identify(userId: String) async {
        guard isConfigured else { return }
        do {
            _ = try await Purchases.shared.logIn(userId)
        } catch {
            SentrySDK.capture(error: error) { scope in
                scope.setTag(value: "subscriptions", key: "feature")
                scope.setTag(value: "identify", key: "action")
            }
        }
    }

    /// Returns purchases to an anonymous id on sign-out, so the next user on
    /// this device does not inherit the previous one's entitlements.
    func resetUser() async {
        guard isConfigured else { return }
        do {
            _ = try await Purchases.shared.logOut()
        } catch {
            SentrySDK.capture(error: error) { scope in
                scope.setTag(value: "subscriptions", key: "feature")
                scope.setTag(value: "resetUser", key: "action")
            }
        }
    }

    /// Fetches current customer info from RevenueCat.
    ///
    /// Throws rather than swallowing: the caller decides what an unresolved
    /// entitlement means, and for gating the answer is always "stay closed".
    /// Returning a default here would make that decision invisibly.
    func fetchCustomerInfo() async throws -> CustomerInfo {
        guard isConfigured else { throw SubscriptionError.notConfigured }
        return try await Purchases.shared.customerInfo()
    }

    /// Whether the given customer info carries the active Pro entitlement.
    static func isPro(_ customerInfo: CustomerInfo) -> Bool {
        customerInfo.entitlements.active[FeatureAccess.proEntitlementIdentifier] != nil
    }

    // MARK: - Buying

    /// Fetches the available offerings.
    ///
    /// Mirrors `useOfferings` in Expo. The offering ids are shared with the
    /// Expo app so both platforms sell the same packages out of the same
    /// RevenueCat dashboard configuration.
    func fetchOfferings() async throws -> Offerings {
        guard isConfigured else { throw SubscriptionError.notConfigured }
        return try await Purchases.shared.offerings()
    }

    /// The offering to show for an early-access gate, falling back to the
    /// default offering when the early-access one is not configured. Matches
    /// how Expo's paywall route resolves its offering.
    func earlyAccessOffering() async throws -> Offering? {
        let offerings = try await fetchOfferings()
        return offerings.all[Self.earlyAccessOfferingID] ?? offerings.current
    }

    /// Buys a package. Mirrors `usePurchase` in Expo.
    ///
    /// A user cancelling is not an error worth reporting — it is the most
    /// ordinary outcome on a paywall — so it comes back as a plain flag rather
    /// than a thrown error the caller has to special-case.
    @discardableResult
    func purchase(package: Package) async throws -> PurchaseOutcome {
        guard isConfigured else { throw SubscriptionError.notConfigured }

        do {
            let result = try await Purchases.shared.purchase(package: package)
            if result.userCancelled { return .cancelled }
            return .purchased(result.customerInfo)
        } catch {
            SentrySDK.capture(error: error) { scope in
                scope.setTag(value: "subscriptions", key: "feature")
                scope.setTag(value: "purchase", key: "action")
                scope.setContext(value: ["productId": package.storeProduct.productIdentifier],
                                 key: "purchase")
            }
            throw error
        }
    }

    /// Restores previous purchases. Mirrors `useRestorePurchases` in Expo.
    func restorePurchases() async throws -> CustomerInfo {
        guard isConfigured else { throw SubscriptionError.notConfigured }

        do {
            return try await Purchases.shared.restorePurchases()
        } catch {
            SentrySDK.capture(error: error) { scope in
                scope.setTag(value: "subscriptions", key: "feature")
                scope.setTag(value: "restorePurchases", key: "action")
            }
            throw error
        }
    }

    /// Opens the platform's own subscription-management screen, the same
    /// destination Expo's "Manage Subscription" row uses.
    func manageSubscriptionsURL() -> URL? {
        #if os(iOS)
        return URL(string: "https://apps.apple.com/account/subscriptions")
        #else
        return URL(string: "macappstores://apps.apple.com/account/subscriptions")
        #endif
    }

    /// Offering identifiers, shared with `apps/expo/features/purchases/types.ts`.
    static let proOfferingID = "default"
    static let earlyAccessOfferingID = "earlyaccessmodel"
}

/// What came back from a purchase attempt. Cancellation is a normal outcome,
/// not a failure, so it is modelled here rather than thrown.
enum PurchaseOutcome {
    case purchased(CustomerInfo)
    case cancelled
}

enum SubscriptionError: Error {
    /// No API key was supplied at build time, so there is nothing to ask.
    case notConfigured
}
