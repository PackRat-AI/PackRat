import Foundation
import Observation
import Sentry

/// Runtime feature flags for the Swift apps.
///
/// Before this existed, `AppFeatureFlags` was the whole story: build-time
/// constants generated from `packages/config/src/config.ts`. That made the
/// `feature_flags` override table invisible to iOS and macOS — flipping a flag
/// in the admin UI changed the Expo app immediately and required a Swift
/// rebuild and App Store release to change anything here. This store closes
/// that gap, matching how `useFeatureFlags` behaves in Expo.
///
/// Resolution order, identical to Expo's:
///   1. coded defaults from `AppFeatureFlags` (the decisions in the build)
///   2. the `/feature-flags` response, normalized by `FeatureFlagResolution`
///
/// Reads are synchronous and always return a boolean, so no call site has to
/// handle a loading state — a cold start renders exactly the shipped defaults
/// until the fetch lands.
@Observable
@MainActor
final class FeatureFlagStore {
    static let shared = FeatureFlagStore()

    private let cacheKey = "featureFlags.v1"
    private let defaults: [String: Bool]
    private let userDefaults: UserDefaults

    /// The effective flag map. Seeded with the coded defaults so the very first
    /// read is correct, then replaced wholesale by each successful fetch.
    private(set) var flags: [String: Bool]

    /// Whether a server response has been applied in this session. Callers that
    /// must not act on a provisional value (analytics attribution, one-shot
    /// migrations) can wait for this; ordinary UI gating should not.
    private(set) var hasResolvedFromServer = false

    init(
        defaults: [String: Bool] = AppFeatureFlags.codedDefaults,
        userDefaults: UserDefaults = .standard
    ) {
        self.defaults = defaults
        self.userDefaults = userDefaults

        // Rehydrate through the same normalizer the fetch path uses, so a cache
        // written by an older build — one predating a flag key — cannot leave
        // that key unresolved. Absent key means off, never "fall back to the
        // coded default": see FeatureFlagResolution for the reasoning.
        if let cached = userDefaults.dictionary(forKey: cacheKey) {
            self.flags = FeatureFlagResolution.normalize(source: cached, defaults: defaults)
        } else {
            self.flags = defaults
        }
    }

    /// Reads one flag. Always returns a boolean; an unknown key is `false`.
    func isEnabled(_ key: String) -> Bool {
        flags[key] ?? false
    }

    /// Applies a fetched flag map and caches it for the next cold start.
    func apply(fetched: [String: Any]) {
        let resolved = FeatureFlagResolution.normalize(source: fetched, defaults: defaults)
        flags = resolved
        hasResolvedFromServer = true
        userDefaults.set(resolved, forKey: cacheKey)
    }

    /// Fetches the effective flag map from the API.
    ///
    /// A failure is deliberately swallowed: the store keeps serving the cached
    /// or coded values, which is the same degradation Expo accepts. A flag being
    /// slightly stale is not worth surfacing an error to the user over.
    func refresh(service: FeatureFlagService = .shared) async {
        do {
            let fetched = try await service.fetchFlags()
            apply(fetched: fetched)
        } catch {
            SentrySDK.capture(error: error) { scope in
                scope.setTag(value: "featureFlags", key: "feature")
                scope.setTag(value: "refresh", key: "action")
            }
        }
    }
}

/// Fetches the effective feature-flag map. Public endpoint — no auth, so this
/// works before sign-in, matching Expo.
struct FeatureFlagService: Sendable {
    static let shared = FeatureFlagService()

    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    func fetchFlags() async throws -> [String: Any] {
        let endpoint = Endpoint(.get, "/feature-flags", requiresAuth: false)
        let raw: [String: Bool] = try await api.send(endpoint)
        return raw
    }
}
