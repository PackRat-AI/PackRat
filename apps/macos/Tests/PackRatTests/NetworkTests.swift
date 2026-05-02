import Testing
import Foundation
@testable import PackRat

// MARK: - Keychain

@Suite("KeychainService")
struct KeychainServiceTests {
    let keychain = KeychainService.shared

    @Test("saves and reads access token")
    func saveAndReadAccessToken() {
        keychain.saveTokens(accessToken: "test-access", refreshToken: "test-refresh")
        #expect(keychain.accessToken == "test-access")
        #expect(keychain.refreshToken == "test-refresh")
        keychain.clearTokens()
    }

    @Test("clearTokens removes both tokens")
    func clearTokens() {
        keychain.saveTokens(accessToken: "a", refreshToken: "b")
        keychain.clearTokens()
        #expect(keychain.accessToken == nil)
        #expect(keychain.refreshToken == nil)
    }

    @Test("overwriting a token replaces the old value")
    func overwriteToken() {
        keychain.saveTokens(accessToken: "first", refreshToken: "r")
        keychain.saveTokens(accessToken: "second", refreshToken: "r2")
        #expect(keychain.accessToken == "second")
        keychain.clearTokens()
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
        struct Body: Encodable { let name: String }
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

    @Test("isRefresh endpoint bypasses auth")
    func refreshEndpoint() {
        let ep = Endpoint(.post, "/api/auth/refresh", requiresAuth: false, isRefresh: true)
        #expect(ep.requiresAuth == false)
        #expect(ep.isRefresh == true)
    }
}
