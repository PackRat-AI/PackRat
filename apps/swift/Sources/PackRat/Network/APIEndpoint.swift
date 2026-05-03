import Foundation

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

protocol APIEndpoint {
    var method: HTTPMethod { get }
    var path: String { get }
    var queryItems: [URLQueryItem]? { get }
    var bodyData: Data? { get }
    var requiresAuth: Bool { get }
    var isRefresh: Bool { get }
}

extension APIEndpoint {
    var queryItems: [URLQueryItem]? { nil }
    var bodyData: Data? { nil }
    var requiresAuth: Bool { true }
    var isRefresh: Bool { false }
}

struct Endpoint: APIEndpoint {
    let method: HTTPMethod
    let path: String
    let queryItems: [URLQueryItem]?
    let bodyData: Data?
    let requiresAuth: Bool
    let isRefresh: Bool

    init(
        _ method: HTTPMethod,
        _ path: String,
        query: [String: String?]? = nil,
        body: (some Encodable)? = nil as String?,
        requiresAuth: Bool = true,
        isRefresh: Bool = false
    ) {
        self.method = method
        self.path = path
        self.queryItems = query?.compactMapValues { $0 }.map { URLQueryItem(name: $0.key, value: $0.value) }
        self.bodyData = body.flatMap { try? JSONEncoder().encode($0) }
        self.requiresAuth = requiresAuth
        self.isRefresh = isRefresh
    }
}
