import Foundation
import HTTPTypes
import OpenAPIRuntime
import OpenAPIURLSession

// Configures the generated OpenAPI client with live auth headers.
// Usage:  let client = PackRatGeneratedClient.shared
// Then:   try await client.listPacks()
extension Client {
    static func authenticated(token: String, baseURL: URL? = nil) -> Client {
        let transport = URLSessionTransport()
        let middleware = AuthMiddleware(token: token)
        return Client(
            serverURL: baseURL ?? (try! Servers.Server1.url()),
            transport: transport,
            middlewares: [middleware]
        )
    }
}

// Injects Bearer token on every request.
struct AuthMiddleware: ClientMiddleware {
    let token: String

    func intercept(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String,
        next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        var req = request
        req.headerFields[.authorization] = "Bearer \(token)"
        return try await next(req, body, baseURL)
    }
}
