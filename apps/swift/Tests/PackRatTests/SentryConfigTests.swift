import Foundation
import Testing
@testable import PackRat

@Suite("SentryConfig.dsnFromInfo")
struct SentryConfigDSNTests {
    @Test("returns nil for a missing key")
    func missingKey() {
        #expect(SentryConfig.dsnFromInfo([:]) == nil)
    }

    @Test("returns nil for an explicit nil dictionary")
    func nilDict() {
        #expect(SentryConfig.dsnFromInfo(nil) == nil)
    }

    @Test("returns nil for an empty string")
    func emptyString() {
        #expect(SentryConfig.dsnFromInfo(["SENTRY_DSN": ""]) == nil)
    }

    @Test("returns nil for a whitespace-only string")
    func whitespaceString() {
        #expect(SentryConfig.dsnFromInfo(["SENTRY_DSN": "   "]) == nil)
    }

    @Test("returns the DSN unmodified for a real value")
    func realDSN() {
        let dsn = "https://abc123@o123.ingest.sentry.io/4567"
        #expect(SentryConfig.dsnFromInfo(["SENTRY_DSN": dsn]) == dsn)
    }

    @Test("trims surrounding whitespace and newlines from the raw value")
    func trims() {
        let dsn = "https://abc123@sentry.io/123"
        #expect(SentryConfig.dsnFromInfo(["SENTRY_DSN": "  \(dsn)\n"]) == dsn)
    }

    @Test("returns nil when the value is not a string")
    func nonStringValue() {
        #expect(SentryConfig.dsnFromInfo(["SENTRY_DSN": 42]) == nil)
    }
}
