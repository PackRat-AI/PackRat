import Testing
import Foundation
@testable import PackRat

// Regression coverage for a TestFlight report: signing up with an
// already-registered email showed "This content could not be loaded right now."
// Two independent defects combined to hide the real reason:
//   1. APIErrorBody decoded only `error`, but Better Auth returns `message`.
//   2. InlineErrorView rendered the matched bucket's canned copy, so any
//      message that matched no bucket became the generic fallback.

// MARK: - Error body decoding

@Suite("APIErrorBody")
struct APIErrorBodyTests {
    private func decode(_ json: String) throws -> APIErrorBody {
        try JSONDecoder().decode(APIErrorBody.self, from: Data(json.utf8))
    }

    @Test("reads Better Auth's `message` field")
    func betterAuthMessage() throws {
        // Verbatim body from POST /api/auth/sign-up/email with a taken email.
        let body = try decode(
            #"{"message":"User already exists. Use another email.","code":"USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"}"#
        )
        #expect(body.displayMessage == "User already exists. Use another email.")
    }

    @Test("reads Elysia's `error` field")
    func elysiaError() throws {
        let body = try decode(#"{"error":"Pack not found"}"#)
        #expect(body.displayMessage == "Pack not found")
    }

    @Test("prefers `message` when both fields are present")
    func prefersMessage() throws {
        let body = try decode(#"{"error":"generic","message":"Password too short"}"#)
        #expect(body.displayMessage == "Password too short")
    }

    @Test("falls back to `code` when no prose is supplied")
    func fallsBackToCode() throws {
        let body = try decode(#"{"code":"PASSWORD_TOO_SHORT"}"#)
        #expect(body.displayMessage == "PASSWORD_TOO_SHORT")
    }

    @Test("returns nil for a body with no recognised fields")
    func unrecognisedBody() throws {
        let body = try decode(#"{"unexpected":"shape"}"#)
        #expect(body.displayMessage == nil)
    }

    @Test("treats empty strings as absent")
    func emptyStringsIgnored() throws {
        let body = try decode(#"{"message":"","error":"","code":"RATE_LIMITED"}"#)
        #expect(body.displayMessage == "RATE_LIMITED")
    }
}

// MARK: - Inline error copy

@Suite("FriendlyErrorPresentation inline copy")
struct FriendlyErrorPresentationTests {
    @Test("shows an actionable signup message verbatim")
    func showsActionableMessageVerbatim() {
        let raw = "User already exists. Use another email."
        let presentation = FriendlyErrorPresentation(raw)
        #expect(presentation.inlineDescription(forRawMessage: raw) == raw)
    }

    @Test("shows other validation messages verbatim")
    func showsValidationMessagesVerbatim() {
        for raw in ["Password too short", "Invalid email or password"] {
            let presentation = FriendlyErrorPresentation(raw)
            #expect(presentation.inlineDescription(forRawMessage: raw) == raw)
        }
    }

    @Test("keeps friendly copy for offline failures")
    func keepsFriendlyCopyWhenOffline() {
        let raw = "The Internet connection appears to be offline."
        let presentation = FriendlyErrorPresentation(raw)
        #expect(presentation.inlineDescription(forRawMessage: raw) == presentation.description)
        #expect(presentation.description != raw)
    }

    @Test("keeps friendly copy for auth failures")
    func keepsFriendlyCopyForAuthFailures() {
        let raw = "401 unauthorized"
        let presentation = FriendlyErrorPresentation(raw)
        #expect(presentation.inlineDescription(forRawMessage: raw) == presentation.description)
    }

    @Test("hides leaky decoding dumps behind the friendly fallback")
    func hidesLeakyDumps() {
        let leaky = [
            #"keyNotFound(CodingKeys(stringValue: "id"), context)"#,
            "Error Domain=NSCocoaErrorDomain Code=4865",
            #"{"raw":"payload"}"#,
        ]
        for raw in leaky {
            let presentation = FriendlyErrorPresentation(raw)
            #expect(presentation.inlineDescription(forRawMessage: raw) == presentation.description)
        }
    }

    @Test("hides over-long messages that would break the banner layout")
    func hidesOverLongMessages() {
        let raw = String(repeating: "a", count: 200)
        let presentation = FriendlyErrorPresentation(raw)
        #expect(presentation.inlineDescription(forRawMessage: raw) == presentation.description)
    }
}
