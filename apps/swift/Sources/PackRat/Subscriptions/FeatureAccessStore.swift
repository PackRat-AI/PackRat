import Foundation
import Observation
import RevenueCat
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
    private let labelCacheKey = "featureAccess.labels.v1"
    private let descriptionCacheKey = "featureAccess.descriptions.v1"
    private let entitlementCacheKey = "featureAccess.isPro.v1"

    private let userDefaults: UserDefaults

    /// `feature_access` rows, keyed by feature key, as ISO-8601 strings.
    /// An absent key means the feature has no row — generally available.
    private(set) var earlyAccessByKey: [String: String] = [:]

    /// Server-supplied labels and descriptions, keyed by feature key. The
    /// paywall prefers these over a name derived from the key, so an admin can
    /// improve the copy without shipping an app update.
    private(set) var labelByKey: [String: String] = [:]
    private(set) var descriptionByKey: [String: String] = [:]

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
            labelByKey = userDefaults.dictionary(forKey: labelCacheKey) as? [String: String] ?? [:]
            descriptionByKey =
                userDefaults.dictionary(forKey: descriptionCacheKey) as? [String: String] ?? [:]
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

    /// Display name for a feature: the server's label when it has one, falling
    /// back to a name derived from the key so the paywall always has something
    /// to show.
    func label(_ featureKey: String) -> String {
        labelByKey[featureKey] ?? FeatureAccess.displayName(forAccessKey: featureKey)
    }

    /// The server's description, if an admin has written one.
    func description(_ featureKey: String) -> String? {
        descriptionByKey[featureKey]
    }

    /// Whole days until the feature graduates, floored at 1.
    ///
    /// Matches `daysUntilGraduation` in Expo's gate: a window closing in a few
    /// hours reads as "1 day" rather than "0 days", which would suggest it is
    /// already open.
    func daysUntilGraduation(_ featureKey: String, now: Date = Date()) -> Int? {
        guard let until = earlyAccessUntil(featureKey) else { return nil }
        let days = (until.timeIntervalSince(now) / 86_400).rounded(.up)
        return max(1, Int(days))
    }

    /// Other features currently in early access, for the paywall to list as
    /// what else the subscription unlocks. Sorted for a stable order and capped,
    /// matching the four slots Expo's paywall template exposes.
    func otherEarlyAccessFeatures(excluding featureKey: String, limit: Int = 4) -> [String] {
        earlyAccessByKey.keys
            .filter { $0 != featureKey && isInEarlyAccess($0) }
            .sorted()
            .prefix(limit)
            .map { label($0) }
    }

    /// Forgets the cached Pro answer, keeping the feature config.
    ///
    /// Called the moment the signed-in identity changes, before the refresh
    /// that follows. Entitlement is cached per device but belongs to an
    /// account, so without this the next person on a shared device inherits
    /// the previous one's Pro until a fetch succeeds — and offline, that fetch
    /// may never come. Fail-closed: an unknown viewer is not Pro.
    ///
    /// The config half is deliberately kept. Which features are gated is the
    /// same for everyone, so there is nothing to leak and dropping it would
    /// only make the next gate resolve slower.
    func forgetEntitlement() {
        isPro = false
        userDefaults.set(false, forKey: entitlementCacheKey)
    }

    /// Applies customer info straight from a completed purchase or restore.
    ///
    /// The paywall already holds the authoritative answer at that moment, so
    /// waiting for the next `refresh` would leave the gate stale behind a
    /// dismissing paywall — the user pays and the feature is still locked.
    /// Mirrors Expo writing the result into its customerInfo query cache.
    func apply(customerInfo: CustomerInfo) {
        let pro = SubscriptionService.isPro(customerInfo)
        isPro = pro
        userDefaults.set(pro, forKey: entitlementCacheKey)

        // Only mark resolved if the config half is genuinely known; entitlement
        // alone cannot say which features are gated.
        if !earlyAccessByKey.isEmpty || userDefaults.dictionary(forKey: configCacheKey) != nil {
            isResolved = true
        }
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

            var windows: [String: String] = [:]
            var labels: [String: String] = [:]
            var descriptions: [String: String] = [:]
            for row in config {
                // A null window means generally available; omitting the key and
                // storing null mean the same thing to the resolver.
                if let until = row.earlyAccessUntil { windows[row.key] = until }
                if let label = row.label { labels[row.key] = label }
                if let description = row.description { descriptions[row.key] = description }
            }

            earlyAccessByKey = windows
            labelByKey = labels
            descriptionByKey = descriptions
            isPro = pro
            isResolved = true

            userDefaults.set(windows, forKey: configCacheKey)
            userDefaults.set(labels, forKey: labelCacheKey)
            userDefaults.set(descriptions, forKey: descriptionCacheKey)
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

    /// Returns every `feature_access` row. The caller keeps the windows for
    /// gating and the label/description for the paywall, so both come from one
    /// request.
    func fetchConfig() async throws -> [FeatureAccessRow] {
        let endpoint = Endpoint(.get, "/api/feature-access", requiresAuth: false)
        return try await api.send(endpoint)
    }
}

struct FeatureAccessRow: Decodable, Sendable {
    let key: String
    let label: String?
    let description: String?
    let earlyAccessUntil: String?
}
