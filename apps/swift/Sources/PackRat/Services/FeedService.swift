import Foundation

final class FeedService: Sendable {
    static let shared = FeedService()
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    func listPostsResponse(page: Int = 1, limit: Int = 20) async throws -> FeedResponse {
        let endpoint = Endpoint(.get, "/api/feed", query: ["page": "\(page)", "limit": "\(limit)"])
        return try await api.send(endpoint)
    }

    func listPosts(page: Int = 1, limit: Int = 20) async throws -> [Post] {
        try await listPostsResponse(page: page, limit: limit).items
    }

    func getComments(postId: Int, page: Int = 1, limit: Int = 50) async throws -> [Comment] {
        let endpoint = Endpoint(.get, "/api/feed/\(postId)/comments",
                                query: ["page": "\(page)", "limit": "\(limit)"])
        let response: CommentsResponse = try await api.send(endpoint)
        return response.items
    }

    func createPost(caption: String?, images: [String] = []) async throws -> Post {
        let body = CreatePostRequest(caption: caption, images: images)
        let endpoint = Endpoint(.post, "/api/feed", body: body)
        return try await api.send(endpoint)
    }

    func deletePost(_ postId: Int) async throws {
        let endpoint = Endpoint(.delete, "/api/feed/\(postId)")
        try await api.sendDiscarding(endpoint)
    }

    func likePost(_ postId: Int) async throws {
        let endpoint = Endpoint(.post, "/api/feed/\(postId)/like")
        try await api.sendDiscarding(endpoint)
    }

    func unlikePost(_ postId: Int) async throws {
        let endpoint = Endpoint(.delete, "/api/feed/\(postId)/like")
        try await api.sendDiscarding(endpoint)
    }

    func addComment(to postId: Int, content: String) async throws -> Comment {
        let body = CreateCommentRequest(content: content)
        let endpoint = Endpoint(.post, "/api/feed/\(postId)/comments", body: body)
        return try await api.send(endpoint)
    }
}
