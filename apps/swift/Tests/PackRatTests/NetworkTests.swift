import Testing
import Foundation
@testable import PackRat

// MARK: - Keychain

// Swift Testing parallelises tests across a suite by default, but the keychain
// is a process-wide singleton. Two tests mutating `.shared` at the same time
// flake (one test reads the other's value). Serialise.
@Suite("KeychainService", .serialized)
struct KeychainServiceTests {
    let keychain = KeychainService.shared

    init() {
        // Defensive: ensure no leaked state from a prior suite or aborted run.
        keychain.clearTokens()
    }

    @Test("saves and reads session token")
    func saveAndReadSessionToken() {
        keychain.saveSessionToken("test-session")
        #expect(keychain.sessionToken == "test-session")
        keychain.clearTokens()
    }

    @Test("clearTokens removes the session token")
    func clearTokens() {
        keychain.saveSessionToken("abc")
        keychain.clearTokens()
        #expect(keychain.sessionToken == nil)
    }

    @Test("overwriting a token replaces the old value")
    func overwriteToken() {
        keychain.saveSessionToken("first")
        keychain.saveSessionToken("second")
        #expect(keychain.sessionToken == "second")
        keychain.clearTokens()
    }

    @Test("reads and migrates Expo Better Auth session cookie")
    func readsAndMigratesExpoBetterAuthCookie() {
        keychain.saveLegacyExpoCookieForTesting("""
        {"better-auth.session_token":{"value":"legacy-session-token"}}
        """)

        #expect(keychain.sessionToken == "legacy-session-token")

        keychain.clearLegacyExpoCookieForTesting()
        #expect(keychain.sessionToken == "legacy-session-token")
        keychain.clearTokens()
    }

    @Test("reads Expo secure Better Auth session cookie")
    func readsExpoSecureBetterAuthCookie() {
        keychain.saveLegacyExpoCookieForTesting("""
        {"__Secure-better-auth.session_token":{"value":"secure-legacy-session-token"}}
        """)

        #expect(keychain.sessionToken == "secure-legacy-session-token")
        keychain.clearTokens()
    }

    @Test("ignores invalid Expo cookie payload")
    func ignoresInvalidExpoCookiePayload() {
        keychain.saveLegacyExpoCookieForTesting("""
        {"better-auth.session_token":{"value":""}}
        """)

        #expect(keychain.sessionToken == nil)
        keychain.clearTokens()
    }

    @Test("clearTokens removes Expo Better Auth cookie")
    func clearTokensRemovesExpoCookie() {
        keychain.saveLegacyExpoCookieForTesting("""
        {"better-auth.session_token":{"value":"legacy-session-token"}}
        """)

        keychain.clearTokens()
        #expect(keychain.sessionToken == nil)
    }
}

// MARK: - APIEndpoint / Endpoint builder

@Suite("Endpoint")
struct EndpointTests {
    @Test("GET endpoint has no body")
    func getEndpointHasNoBody() {
        let ep = Endpoint(.get, "/api/packs")
        #expect(ep.method == .get)
        #expect(ep.path == "/api/packs")
        #expect(ep.bodyData == nil)
        #expect(ep.requiresAuth == true)
    }

    @Test("POST endpoint encodes body to JSON")
    func postEndpointEncodesBody() throws {
        struct Body: Codable { let name: String }
        let ep = Endpoint(.post, "/api/packs", body: Body(name: "Test Pack"))
        #expect(ep.method == .post)
        let data = try #require(ep.bodyData)
        let decoded = try JSONDecoder().decode(Body.self, from: data)
        #expect(decoded.name == "Test Pack")
    }

    @Test("query items are built from dictionary")
    func queryItemsFromDictionary() {
        let ep = Endpoint(.get, "/api/catalog", query: ["q": "tent", "limit": "20"])
        let items = try! #require(ep.queryItems)
        let dict = Dictionary(uniqueKeysWithValues: items.map { ($0.name, $0.value ?? "") })
        #expect(dict["q"] == "tent")
        #expect(dict["limit"] == "20")
    }

    @Test("nil query values are dropped")
    func nilQueryValuesDropped() {
        let ep = Endpoint(.get, "/api/catalog", query: ["q": "tent", "page": nil])
        #expect(ep.queryItems?.count == 1)
    }

    @Test("unauthenticated endpoint opts out via requiresAuth: false")
    func unauthenticatedEndpoint() {
        let ep = Endpoint(.post, "/api/auth/sign-in/email", requiresAuth: false)
        #expect(ep.requiresAuth == false)
    }
}
