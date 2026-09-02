import Foundation
import Observation
import Sentry

/// Resolves "may this viewer use this feature right now" for the Swift apps.
///
/// Joins the two signals the shared resolver needs:
///   1. the `feature_access` config — which features are gated, and until when
///   2. the Pro entitlement from RevenueCat
///
/// and runs them through `FeatureAccess.hasAccess`, the same pure decision the
/// API enforces server-side and Expo mirrors.
///
/// # Fail-closed
///
/// The resolver treats a feature with no config row as generally available,
/// which is correct — but only once the config has actually been fetched.
/// Before that, "no row" and "we haven't looked yet" are indistinguishable, and
/// handing an unfetched state to the resolver would open every gate.
///
/// So `isAllowed` requires `isResolved` first. This mirrors the `resolved &&`
/// guard in `apps/expo/features/purchases/hooks/useFeatureAccess.ts`, which
/// carries the same warning for the same reason. A gated feature stays closed
/// while offline or mid-fetch; it never opens because a signal was slow.
///
/// Entitlement state is cached to disk so a cold start offline still resolves
/// for a paying member, rather than locking them out of what they bought.
@Observable
@MainActor
final class FeatureAccessStore {
    static let shared = FeatureAccessStore()

    private let configCacheKey = "featureAccess.config.v1"
    private let entitlementCacheKey = "featureAccess.isPro.v1"

    private let userDefaults: UserDefaults

    /// `feature_access` rows, keyed by feature key, as ISO-8601 strings.
    /// An absent key means the feature has no row — generally available.
    private(set) var earlyAccessByKey: [String: String] = [:]

    /// Whether the viewer holds the active Pro entitlement.
    private(set) var isPro = false

    /// Whether both signals have been resolved — from the network this session,
    /// or from the persisted cache. Until this is true, every gated feature is
    /// treated as closed.
    private(set) var isResolved = false

    init(userDefaults: UserDefaults = .standard) {
        self.userDefaults = userDefaults

        // Seed from cache so an offline cold start resolves rather than locking
        // out a paying member. Only counts as resolved if config was actually
        // cached — an entitlement alone cannot tell us what is gated.
        if let cachedConfig = userDefaults.dictionary(forKey: configCacheKey) as? [String: String] {
            earlyAccessByKey = cachedConfig
            isPro = userDefaults.bool(forKey: entitlementCacheKey)
            isResolved = true
        }
    }

    /// Whether the viewer may use `featureKey` right now.
    ///
    /// Returns `false` while unresolved. That is the fail-closed guard, not an
    /// oversight — see the type-level note above before changing it.
    func isAllowed(_ featureKey: String, now: Date = Date()) -> Bool {
        guard isResolved else { return false }

        let until = FeatureAccess.parseEarlyAccessUntil(earlyAccessByKey[featureKey])
        return FeatureAccess.hasAccess(earlyAccessUntil: until, hasPro: isPro, now: now)
    }

    /// Whether `featureKey` is inside its early-access window, regardless of
    /// who is viewing. Drives "Pro" badging on a feature the viewer cannot use.
    func isInEarlyAccess(_ featureKey: String, now: Date = Date()) -> Bool {
        guard isResolved else { return false }

        let until = FeatureAccess.parseEarlyAccessUntil(earlyAccessByKey[featureKey])
        return FeatureAccess.isInEarlyAccess(earlyAccessUntil: until, now: now)
    }

    /// When `featureKey` graduates to free for everyone, or nil if it has no
    /// window. Lets a gate tell the viewer how long the wait is rather than
    /// leaving "early access" open-ended.
    func earlyAccessUntil(_ featureKey: String) -> Date? {
        FeatureAccess.parseEarlyAccessUntil(earlyAccessByKey[featureKey])
    }

    /// Refreshes both signals and caches them.
    ///
    /// Both must succeed to mark the store resolved. A partial refresh — config
    /// without entitlement, say — would let a paying member be treated as
    /// non-Pro against a freshly-fetched gate list, which is worse than staying
    /// on the previous cached answer.
    func refresh(
        service: FeatureAccessService = .shared,
        subscriptions: SubscriptionService = .shared
    ) async {
        do {
            let config = try await service.fetchConfig()

            // A build with no RevenueCat key has no entitlements to read; treat
            // the viewer as non-Pro rather than failing the whole refresh, so
            // ungated features still resolve normally on such a build.
            let pro: Bool
            if subscriptions.isConfigured {
                let customerInfo = try await subscriptions.fetchCustomerInfo()
                pro = SubscriptionService.isPro(customerInfo)
            } else {
                pro = false
            }

            earlyAccessByKey = config
            isPro = pro
            isResolved = true

            userDefaults.set(config, forKey: configCacheKey)
            userDefaults.set(pro, forKey: entitlementCacheKey)
        } catch {
            // Deliberately leaves `isResolved` as-is. If a previous refresh or
            // the cache resolved the store, keep serving those answers; if not,
            // gated features stay closed. Either way, never open on failure.
            SentrySDK.capture(error: error) { scope in
                scope.setTag(value: "featureAccess", key: "feature")
                scope.setTag(value: "refresh", key: "action")
            }
        }
    }
}

/// Fetches the `feature_access` config. Public endpoint — no auth, so gating
/// resolves before sign-in, matching Expo.
struct FeatureAccessService: Sendable {
    static let shared = FeatureAccessService()

    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    /// Returns `earlyAccessUntil` per feature key, as an ISO-8601 string.
    /// Features whose window is null are omitted — an absent key and a null
    /// timestamp both mean "not gated", so collapsing them loses nothing.
    func fetchConfig() async throws -> [String: String] {
        let endpoint = Endpoint(.get, "/api/feature-access", requiresAuth: false)
        let rows: [FeatureAccessRow] = try await api.send(endpoint)

        return rows.reduce(into: [String: String]()) { result, row in
            if let until = row.earlyAccessUntil { result[row.key] = until }
        }
    }
}

struct FeatureAccessRow: Decodable, Sendable {
    let key: String
    let earlyAccessUntil: String?
}
