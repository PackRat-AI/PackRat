import Foundation

/// Early-access resolver — the Swift half of
/// `packages/config/src/featureAccess.ts`, which the API enforces server-side
/// and the Expo app mirrors client-side.
///
/// The monetization model has exactly two states per feature, both encoded in
/// one timestamp, `earlyAccessUntil`:
///
///   - `nil` or in the past → generally available: free for everyone
///   - in the future        → early access: Pro members only, until it passes
///
/// Graduation is automatic and temporal: when `earlyAccessUntil` passes, the
/// same row starts resolving as free for everyone with no flip or migration.
/// Nothing is ever taken away — a feature only moves from Pro-first to free.
///
/// Like its TypeScript counterpart, this is a **pure decision over resolved
/// signals**. It deliberately does not model uncertainty: resolving the signals
/// reliably, including offline, is the caller's job. See `FeatureAccessStore`
/// for where "we could not check" is handled — by denying, never by assuming.
///
/// Behaviour is pinned to `packages/config/fixtures/feature-access-resolution.json`,
/// which both this and the TypeScript suite assert against.
public enum FeatureAccess {
    /// The RevenueCat entitlement identifier that grants Pro access. Must match
    /// `PACKRAT_PRO_ENTITLEMENT` in packages/config — the app reads it from
    /// `customerInfo.entitlements.active` and the API reads it from the
    /// entitlements table the RevenueCat webhook populates.
    public static let proEntitlementIdentifier = "PackRat Pro"

    /// Whether the feature is inside its early-access window — i.e. still
    /// Pro-gated for non-members. Independent of who the viewer is.
    ///
    /// An unparseable timestamp resolves to "no window", matching the
    /// TypeScript resolver, which returns null from its `toTime` helper on NaN.
    public static func isInEarlyAccess(
        earlyAccessUntil: Date?,
        now: Date = Date()
    ) -> Bool {
        guard let earlyAccessUntil else { return false }
        return now < earlyAccessUntil
    }

    /// Whether the viewer may use the feature right now, given *resolved*
    /// signals.
    ///
    /// The only inputs that yield free-for-all are genuine general
    /// availability: a feature with no config row, or one whose window has
    /// passed. These are real GA states, not a fail-open for missing data.
    ///
    /// - Parameters:
    ///   - earlyAccessUntil: The `feature_access` row's timestamp, or `nil` when
    ///     the feature has no row.
    ///   - hasPro: Whether the viewer holds the active Pro entitlement, resolved
    ///     from live or persisted customer info.
    ///   - now: Clock override for deterministic tests.
    public static func hasAccess(
        earlyAccessUntil: Date?,
        hasPro: Bool,
        now: Date = Date()
    ) -> Bool {
        // GA or graduated → free for everyone.
        guard isInEarlyAccess(earlyAccessUntil: earlyAccessUntil, now: now) else { return true }
        // Still inside the window → Pro only.
        return hasPro
    }

    /// Parses an `earlyAccessUntil` value as it arrives over the wire.
    ///
    /// Returns `nil` for both a JSON null and an unparseable string. Collapsing
    /// those two cases is deliberate and matches the TypeScript resolver: a
    /// timestamp we cannot read carries no window, so the feature resolves as
    /// generally available rather than being gated on a value nobody can
    /// interpret. Gating on unreadable data would deny paying and non-paying
    /// users alike with no way to recover client-side.
    public static func parseEarlyAccessUntil(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        return iso8601WithFractionalSeconds.date(from: raw)
            ?? iso8601Plain.date(from: raw)
    }

    private static let iso8601WithFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let iso8601Plain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}
