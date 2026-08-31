import Foundation
import Testing
@testable import PackRat

// Parity suite for feature-flag resolution.
//
// Drives the Swift resolver from the same fixture the TypeScript suite reads
// (packages/config/src/featureFlagResolution.parity.test.ts), so a behavioural
// change on one platform fails the other's build.
//
// Add cases to packages/config/fixtures/feature-flag-resolution.json, never to
// this file — a case that lives in only one language is the drift this suite
// exists to catch.

private struct ParityCase: Decodable {
    let name: String
    let defaults: [String: Bool]
    let source: [String: AnyCodableValue]?
    let expected: [String: Bool]
}

/// Minimal decoder for the heterogeneous `source` maps in the fixture, which
/// deliberately contain strings, numbers and nulls alongside booleans to prove
/// they are rejected rather than coerced.
private enum AnyCodableValue: Decodable {
    case bool(Bool)
    case number(Double)
    case string(String)
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unsupported fixture value type"
            )
        }
    }

    /// Re-erases to the `Any` shape `JSONSerialization` would produce, so the
    /// resolver is exercised on exactly the representation it sees in production.
    var erased: Any? {
        switch self {
        case let .bool(value): return value
        case let .number(value): return value
        case let .string(value): return value
        case .null: return nil
        }
    }
}

private struct ParityFixture: Decodable {
    let cases: [ParityCase]
}

private func loadFixture() throws -> ParityFixture {
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
        .appendingPathComponent("packages/config/fixtures/feature-flag-resolution.json")

    let data = try Data(contentsOf: fixtureURL)
    return try JSONDecoder().decode(ParityFixture.self, from: data)
}

@Suite("Feature-flag resolution parity")
struct FeatureFlagResolutionParityTests {
    @Test("the shared fixture is non-empty")
    func fixtureIsNonEmpty() throws {
        // Guards against a missing or malformed fixture silently reducing this
        // suite to a no-op, which would let the two resolvers drift unnoticed.
        let fixture = try loadFixture()
        #expect(!fixture.cases.isEmpty)
    }

    @Test("Swift resolver matches the shared fixture")
    func matchesSharedFixture() throws {
        let fixture = try loadFixture()

        for testCase in fixture.cases {
            let source: [String: Any]? = testCase.source.map { raw in
                // A JSON null becomes an absent key, matching how
                // JSONSerialization surfaces NSNull-free optional reads.
                raw.compactMapValues { $0.erased }
            }

            let resolved = FeatureFlagResolution.normalize(
                source: source,
                defaults: testCase.defaults
            )

            #expect(
                resolved == testCase.expected,
                "case \"\(testCase.name)\": got \(resolved), expected \(testCase.expected)"
            )
        }
    }
}
