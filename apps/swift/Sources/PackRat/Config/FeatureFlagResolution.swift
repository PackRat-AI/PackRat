import Foundation

/// Feature-flag resolution — the Swift half of the rule defined in
/// `packages/config/src/featureFlagResolution.ts`.
///
/// The rule is one sentence: **an unknown or non-boolean value is `false`.**
///
/// `AppFeatureFlags` is generated at build time and holds the coded defaults —
/// decisions someone wrote down, so a flag defaulting to `true` there is
/// intentional and is honoured. This type governs values arriving from *outside*
/// the binary (the `/feature-flags` endpoint, a `UserDefaults` cache written by
/// an older build), where absence carries no decision at all and the honest
/// answer is "off".
///
/// Keep the behaviour here in lockstep with the TypeScript resolver. The shared
/// fixture in `apps/swift/Tests/PackRatTests/Fixtures/feature-flag-resolution.json`
/// is asserted by both test suites so the two cannot drift silently.
enum FeatureFlagResolution {
    /// Normalize an untrusted flag map against the build's known keys.
    ///
    /// - Keys present in `source` but unknown to this build are dropped: the
    ///   binary's key set is authoritative, so the server cannot invent a flag
    ///   the app has no code for.
    /// - Keys known to the build but missing from a *present* `source` resolve to
    ///   `false`, not to their coded default. A real map was fetched or
    ///   rehydrated, and a key absent from a real map is one nobody decided on.
    /// - When `source` is `nil`, the coded defaults are returned unchanged —
    ///   nothing has been fetched, so there is no evidence to override the
    ///   decisions compiled into the build.
    static func normalize(
        source: [String: Any]?,
        defaults: [String: Bool]
    ) -> [String: Bool] {
        guard let source else { return defaults }

        var resolved: [String: Bool] = [:]
        for key in defaults.keys {
            // Strings and numbers are rejected rather than coerced: "true" and 1
            // are both truthy and would wrongly unlock a feature.
            resolved[key] = strictBool(source[key]) ?? false
        }
        return resolved
    }

    /// Reads a value only if it is a genuine boolean.
    ///
    /// `JSONSerialization` bridges JSON booleans *and* the numbers 0/1 to
    /// `NSNumber`, so a bare `as? Bool` would accept `1` as `true`. Comparing the
    /// CoreFoundation type id is what distinguishes them.
    private static func strictBool(_ value: Any?) -> Bool? {
        guard let number = value as? NSNumber,
              CFGetTypeID(number) == CFBooleanGetTypeID() else { return nil }
        return number.boolValue
    }
}
