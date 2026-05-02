import Foundation

actor APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private var refreshTask: Task<Tokens, Error>?

    struct Tokens: Sendable {
        let accessToken: String
        let refreshToken: String
    }

    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        self.session = URLSession(configuration: config)
    }

    // Reads base URL from (in priority order):
    // 1. UserDefaults "apiBaseURL" — set via Preferences at runtime
    // 2. Info.plist "API_BASE_URL" — injected from xcconfig at build time
    // 3. Hardcoded production fallback
    private var baseURL: URL {
        if let override = UserDefaults.standard.string(forKey: "apiBaseURL"),
           !override.isEmpty,
           let url = URL(string: override) { return url }
        if let bundleValue = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
           !bundleValue.isEmpty,
           let url = URL(string: bundleValue) { return url }
        return URL(string: "https://api.packrat.app")!
    }

    // MARK: - Public

    func send<T: Decodable>(_ endpoint: some APIEndpoint, as _: T.Type = T.self) async throws -> T {
        let request = try buildRequest(endpoint, accessToken: KeychainService.shared.accessToken)
        return try await execute(request, endpoint: endpoint, as: T.self, isRetry: false)
    }

    func sendDiscarding(_ endpoint: some APIEndpoint) async throws {
        let request = try buildRequest(endpoint, accessToken: KeychainService.shared.accessToken)
        let (data, response) = try await session.data(for: request)
        try validateStatus(response, data: data)
    }

    func stream(_ endpoint: some APIEndpoint) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    let token = KeychainService.shared.accessToken
                    let request = try self.buildRequest(endpoint, accessToken: token)
                    let (bytes, response) = try await self.session.bytes(for: request)
                    guard let http = response as? HTTPURLResponse,
                          (200...299).contains(http.statusCode)
                    else {
                        continuation.finish(throwing: PackRatError.unknown)
                        return
                    }
                    for try await line in bytes.lines {
                        if line.hasPrefix("data: ") {
                            let payload = String(line.dropFirst(6))
                            if payload == "[DONE]" { break }
                            continuation.yield(payload)
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
        endpoint: some APIEndpoint,
        as _: T.Type,
        isRetry: Bool
    ) async throws -> T {
        let (data, response) = try await session.data(for: request)

        if let http = response as? HTTPURLResponse,
           http.statusCode == 401,
           !isRetry,
           !endpoint.isRefresh
        {
            let tokens = try await refreshTokens()
            let retryRequest = try buildRequest(endpoint, accessToken: tokens.accessToken)
            return try await execute(retryRequest, endpoint: endpoint, as: T.self, isRetry: true)
        }

        try validateStatus(response, data: data)
        return try decode(data, as: T.self)
    }

    private func refreshTokens() async throws -> Tokens {
        if let existing = refreshTask {
            return try await existing.value
        }

        let task = Task<Tokens, Error> {
            defer { Task { await self.clearRefreshTask() } }

            guard let refreshToken = KeychainService.shared.refreshToken else {
                throw PackRatError.unauthorized
            }

            struct RefreshBody: Encodable { let refreshToken: String }
            struct RefreshResponse: Decodable { let accessToken: String; let refreshToken: String }

            let endpoint = Endpoint(
                .post,
                "/api/auth/refresh",
                body: RefreshBody(refreshToken: refreshToken),
                requiresAuth: false,
                isRefresh: true
            )
            let response: RefreshResponse = try await self.send(endpoint)
            KeychainService.shared.saveTokens(
                accessToken: response.accessToken,
                refreshToken: response.refreshToken
            )
            return Tokens(accessToken: response.accessToken, refreshToken: response.refreshToken)
        }

        refreshTask = task
        return try await task.value
    }

    private func clearRefreshTask() {
        refreshTask = nil
    }

    private func buildRequest(_ endpoint: some APIEndpoint, accessToken: String?) throws -> URLRequest {
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

        if endpoint.requiresAuth, let token = accessToken {
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
            throw PackRatError.decodingError(error)
        }
    }
}

private struct APIErrorBody: Decodable {
    let error: String?
}
