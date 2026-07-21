import Foundation

actor APIClient {
    static let shared = APIClient()

    private let session: URLSession

    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        self.session = URLSession(configuration: config)
    }

    // xcconfig files treat // as a comment, so full URLs can't be stored there.
    // We store an environment name (PACKRAT_ENV) in xcconfig → Info.plist instead,
    // and map that to a URL here. UserDefaults lets you override at runtime via Preferences.
    //
    // `local` points at the default `wrangler dev -e=dev` port (8787). The
    // orchestrator pipeline boots a parallel wrangler on 8791 to avoid
    // colliding with a developer's own wrangler — use `dev-local` to target it.
    static let environments: [String: String] = [
        "local":      "http://localhost:8787",
        "dev-local":  "http://localhost:8791",
        "dev":        "https://packrat-api-dev.orange-frost-d665.workers.dev",
        "production": "https://packrat-api.orange-frost-d665.workers.dev",
    ]

    /// The build-time environment name from `PACKRAT_ENV` (xcconfig → Info.plist).
    /// `nil` if unset.
    static var environmentName: String? {
        Bundle.main.object(forInfoDictionaryKey: "PACKRAT_ENV") as? String
    }

    /// True for local/dev/staging builds — anything that is not the production
    /// release. Used to gate developer-only UI (API server override, clear app
    /// data) so those controls never ship to end users. Debug builds always
    /// qualify; release builds only if their `PACKRAT_ENV` is not `production`
    /// (the Staging config ships a `release` build pointed at the dev API).
    static var isNonProduction: Bool {
        #if DEBUG
        return true
        #else
        return environmentName != "production"
        #endif
    }

    static var resolvedBaseURL: URL {
        if let override = ProcessInfo.processInfo.environment["E2E_API_BASE_URL"],
           !override.isEmpty,
           let url = URL(string: override) { return url }
        // Honor the user-facing API server override only in non-production
        // builds. The override UI is gated the same way (see PreferencesView),
        // but gate the read too so a stale/injected value can never repoint a
        // production app at another backend.
        if isNonProduction,
           let override = UserDefaults.standard.string(forKey: "apiBaseURL"),
           !override.isEmpty,
           let url = URL(string: override) { return url }
        if let env = Bundle.main.object(forInfoDictionaryKey: "PACKRAT_ENV") as? String,
           let urlString = Self.environments[env],
           let url = URL(string: urlString) { return url }
        #if DEBUG
        return URL(string: "http://localhost:8787")!
        #else
        return URL(string: "https://packrat-api.orange-frost-d665.workers.dev")!
        #endif
    }

    private var baseURL: URL { Self.resolvedBaseURL }

    // MARK: - Public

    func send<T: Decodable>(_ endpoint: some APIEndpoint, as _: T.Type = T.self) async throws -> T {
        let request = try buildRequest(endpoint, sessionToken: KeychainService.shared.sessionToken)
        return try await execute(request, as: T.self)
    }

    func sendDiscarding(_ endpoint: some APIEndpoint) async throws {
        let request = try buildRequest(endpoint, sessionToken: KeychainService.shared.sessionToken)
        let (data, response) = try await dataWithTransientRetry(for: request)
        captureSessionTokenIfPresent(response)
        try validateStatus(response, data: data)
    }

    func stream(_ endpoint: some APIEndpoint) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    let token = KeychainService.shared.sessionToken
                    let request = try self.buildRequest(endpoint, sessionToken: token)
                    let (bytes, response) = try await self.session.bytes(for: request)
                    guard let http = response as? HTTPURLResponse,
                          (200...299).contains(http.statusCode)
                    else {
                        continuation.finish(throwing: PackRatError.unknown)
                        return
                    }
                    for try await line in bytes.lines {
                        let trimmed = line.trimmingCharacters(in: .whitespaces)
                        guard !trimmed.isEmpty else { continue }
                        if trimmed.hasPrefix("data: ") {
                            let payload = String(trimmed.dropFirst(6))
                            if payload == "[DONE]" { break }
                            continuation.yield(payload)
                        } else {
                            // Vercel AI SDK UI Message Stream (plain lines, no SSE wrapper)
                            continuation.yield(trimmed)
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    // MARK: - Private

    private func execute<T: Decodable>(
        _ request: URLRequest,
        as _: T.Type
    ) async throws -> T {
        #if DEBUG
        let method = request.httpMethod ?? "?"
        let url = request.url?.absoluteString ?? "?"
        if let body = request.httpBody, let bodyStr = String(data: body, encoding: .utf8) {
            print("→ \(method) \(url)\n  body: \(bodyStr)")
        } else {
            print("→ \(method) \(url)")
        }
        #endif

        let (data, response) = try await dataWithTransientRetry(for: request)

        #if DEBUG
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let raw = String(data: data, encoding: .utf8) ?? "<binary>"
        print("← \(status) \(url)\n  body: \(raw)")
        #endif

        // Better Auth sets `set-auth-token` on the response for sign-in /
        // sign-up. Capture it before validating status so even error paths
        // can't lose a freshly-rotated token (Better Auth rotates server-side).
        captureSessionTokenIfPresent(response)

        try validateStatus(response, data: data)
        return try decode(data, as: T.self)
    }

    private func dataWithTransientRetry(for request: URLRequest) async throws -> (Data, URLResponse) {
        var lastError: Error?

        for attempt in 0..<2 {
            do {
                let (data, response) = try await session.data(for: request)
                if let http = response as? HTTPURLResponse,
                   (500...599).contains(http.statusCode),
                   attempt == 0 {
                    captureSessionTokenIfPresent(response)
                    try? await Task.sleep(for: .milliseconds(300))
                    continue
                }
                return (data, response)
            } catch {
                lastError = error
                if attempt == 0 {
                    try? await Task.sleep(for: .milliseconds(300))
                    continue
                }
            }
        }

        throw lastError ?? PackRatError.unknown
    }

    /// Better Auth returns the session token in the `set-auth-token` response
    /// header on sign-in, sign-up, and any time the server rotates the token.
    /// Persist it so subsequent requests can use `Authorization: Bearer <token>`.
    private func captureSessionTokenIfPresent(_ response: URLResponse) {
        guard let http = response as? HTTPURLResponse else { return }
        // HTTPURLResponse header lookup is case-insensitive on Apple platforms.
        guard let token = http.value(forHTTPHeaderField: "set-auth-token"),
              !token.isEmpty
        else { return }
        KeychainService.shared.saveSessionToken(token)
    }

    private func buildRequest(_ endpoint: some APIEndpoint, sessionToken: String?) throws -> URLRequest {
        var components = URLComponents(
            url: baseURL.appendingPathComponent(endpoint.path),
            resolvingAgainstBaseURL: false
        )!

        if let items = endpoint.queryItems, !items.isEmpty {
            components.queryItems = items
        }

        guard let url = components.url else { throw PackRatError.unknown }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        // Better Auth runs a CSRF Origin check on every POST. Native apps don't
        // send a browser Origin, so we identify ourselves with the deep-link
        // scheme — `packrat://` is the iOS/macOS bundle URL type and is
        // registered in the API's trustedOrigins list. The Expo client uses
        // the Better Auth `expo()` plugin which promotes its expo-origin
        // header to Origin; we go direct.
        request.setValue("packrat://", forHTTPHeaderField: "Origin")

        if endpoint.requiresAuth, let token = sessionToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        request.httpBody = endpoint.bodyData
        return request
    }

    private func validateStatus(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw PackRatError.unknown }
        switch http.statusCode {
        case 200...299: return
        case 401: throw PackRatError.unauthorized
        case 404: throw PackRatError.notFound
        default:
            let message = (try? JSONDecoder().decode(APIErrorBody.self, from: data))?.error
            throw PackRatError.httpError(statusCode: http.statusCode, message: message)
        }
    }

    private func decode<T: Decodable>(_ data: Data, as _: T.Type) throws -> T {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            #if DEBUG
            let raw = String(data: data, encoding: .utf8) ?? "<binary>"
            print("✗ decode \(T.self) failed: \(error)\n  raw: \(raw)")
            #endif
            throw PackRatError.decodingError(error)
        }
    }
}

private struct APIErrorBody: Decodable {
    let error: String?
}
