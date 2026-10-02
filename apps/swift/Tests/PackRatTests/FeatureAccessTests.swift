import Foundation
import Testing
@testable import PackRat

// Parity suite for the early-access resolver.
//
// Drives the Swift resolver from the same fixture the TypeScript suite reads
// (packages/config/src/featureAccess.parity.test.ts), so a behavioural change on
// one platform fails the other's build.
//
// This resolver is enforced server-side and mirrored on both clients. When the
// implementations disagree, a user is shown a feature the API then refuses to
// serve — or is denied one they have paid for.
//
// Add cases to packages/config/fixtures/feature-access-resolution.json, never to
// this file.

private struct AccessParityCase: Decodable {
    let name: String
    let earlyAccessUntil: String?
    let hasPro: Bool
    let expectedInEarlyAccess: Bool
    let expectedHasAccess: Bool
}

private struct AccessParityFixture: Decodable {
    let now: String
    let cases: [AccessParityCase]
}

private func loadAccessFixture() throws -> AccessParityFixture {
    // Resolved relative to this source file rather than a bundle resource: the
    // fixture is owned by packages/config and shared across languages, so it is
    // deliberately not copied into the test target.
    let repoRoot = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent() // .../Tests/PackRatTests
        .deletingLastPathComponent() // .../Tests
        .deletingLastPathComponent() // .../apps/swift
        .deletingLastPathComponent() // .../apps
        .deletingLastPathComponent() // repo root

    let fixtureURL = repoRoot
        .appendingPathComponent("packages/config/fixtures/feature-access-resolution.json")

    let data = try Data(contentsOf: fixtureURL)
    return try JSONDecoder().decode(AccessParityFixture.self, from: data)
}

@Suite("Feature-access resolution parity")
struct FeatureAccessParityTests {
    @Test("the shared fixture is non-empty and its clock parses")
    func fixtureIsUsable() throws {
        // Guards against a missing fixture or an unparseable clock reducing this
        // suite to a vacuous pass, which would let the resolvers drift unnoticed.
        let fixture = try loadAccessFixture()
        #expect(!fixture.cases.isEmpty)
        #expect(FeatureAccess.parseEarlyAccessUntil(fixture.now) != nil)
    }

    @Test("Swift resolver matches the shared fixture")
    func matchesSharedFixture() throws {
        let fixture = try loadAccessFixture()
        let now = try #require(FeatureAccess.parseEarlyAccessUntil(fixture.now))

        for testCase in fixture.cases {
            let until = FeatureAccess.parseEarlyAccessUntil(testCase.earlyAccessUntil)

            let inWindow = FeatureAccess.isInEarlyAccess(earlyAccessUntil: until, now: now)
            #expect(
                inWindow == testCase.expectedInEarlyAccess,
                "case \"\(testCase.name)\": isInEarlyAccess got \(inWindow), expected \(testCase.expectedInEarlyAccess)"
            )

            let allowed = FeatureAccess.hasAccess(
                earlyAccessUntil: until,
                hasPro: testCase.hasPro,
                now: now
            )
            #expect(
                allowed == testCase.expectedHasAccess,
                "case \"\(testCase.name)\": hasAccess got \(allowed), expected \(testCase.expectedHasAccess)"
            )
        }
    }

    @Test("Pro entitlement identifier matches packages/config")
    func entitlementIdentifierMatches() throws {
        // Read the canonical value out of the TypeScript source rather than
        // restating the literal here — asserting a constant against a copy of
        // itself would pass no matter how far the two drifted. Drift here means
        // the app reads an entitlement RevenueCat never grants, silently locking
        // out every paying member.
        let repoRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()

        let sourceURL = repoRoot
            .appendingPathComponent("packages/config/src/featureAccess.ts")
        let source = try String(contentsOf: sourceURL, encoding: .utf8)

        let pattern = #"PACKRAT_PRO_ENTITLEMENT\s*=\s*'([^']+)'"#
        let regex = try NSRegularExpression(pattern: pattern)
        let range = NSRange(source.startIndex..., in: source)
        let match = try #require(
            regex.firstMatch(in: source, range: range),
            "PACKRAT_PRO_ENTITLEMENT not found in featureAccess.ts"
        )
        let captured = try #require(Range(match.range(at: 1), in: source))

        #expect(FeatureAccess.proEntitlementIdentifier == String(source[captured]))
    }
}
