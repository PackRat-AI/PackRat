import Foundation

/// Which posts a feed list shows. Maps to `/api/feed`, `/api/feed/saved` and
/// `/api/feed/tagged`.
enum FeedScope: Equatable, Sendable {
    case all
    case saved
    case tagged

    var path: String {
        switch self {
        case .all: return "/api/feed"
        case .saved: return "/api/feed/saved"
        case .tagged: return "/api/feed/tagged"
        }
    }
}

final class FeedService: Sendable {
    static let shared = FeedService()
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    // MARK: - Posts

    func listPostsResponse(scope: FeedScope = .all, page: Int = 1, limit: Int = 20) async throws -> FeedResponse {
        let endpoint = Endpoint(.get, scope.path, query: ["page": "\(page)", "limit": "\(limit)"])
        return try await api.send(endpoint)
    }

    func listPosts(page: Int = 1, limit: Int = 20) async throws -> [Post] {
        try await listPostsResponse(page: page, limit: limit).items
    }

    func getPost(_ postId: Int) async throws -> Post {
        try await api.send(Endpoint(.get, "/api/feed/\(postId)"))
    }

    /// Resolves a share link (`packratai.com/p/{publicId}`) to the full post.
    func getSharedPost(publicId: String) async throws -> Post {
        try await api.send(Endpoint(.get, "/api/feed/shared/\(publicId)"))
    }

    func createPost(caption: String?, images: [String] = [], taggedUserIds: [String] = []) async throws -> Post {
        let body = CreatePostRequest(
            caption: caption,
            images: images,
            taggedUserIds: taggedUserIds.isEmpty ? nil : taggedUserIds
        )
        return try await api.send(Endpoint(.post, "/api/feed", body: body))
    }

    func updatePost(_ postId: Int, caption: String?, taggedUserIds: [String]) async throws -> Post {
        let body = UpdatePostRequest(caption: caption, taggedUserIds: taggedUserIds.isEmpty ? nil : taggedUserIds)
        return try await api.send(Endpoint(.patch, "/api/feed/\(postId)", body: body))
    }

    func deletePost(_ postId: Int) async throws {
        try await api.sendDiscarding(Endpoint(.delete, "/api/feed/\(postId)"))
    }

    /// Likes are a toggle on the server: the same POST likes and unlikes, and
    /// the response carries the resulting state.
    func toggleLike(_ postId: Int) async throws -> LikeToggleResponse {
        try await api.send(Endpoint(.post, "/api/feed/\(postId)/like"))
    }

    func setSaved(_ postId: Int, saved: Bool) async throws -> Bool {
        let endpoint = Endpoint(saved ? .post : .delete, "/api/feed/\(postId)/save")
        let response: SaveToggleResponse = try await api.send(endpoint)
        return response.saved
    }

    func removeMyTag(from postId: Int) async throws {
        try await api.sendDiscarding(Endpoint(.delete, "/api/feed/\(postId)/tags/me"))
    }

    // MARK: - Comments

    /// Every comment on a post, oldest first. The thread is flat with
    /// `parentCommentId`; pages are fetched until the thread is complete.
    func getComments(postId: Int, limit: Int = 50) async throws -> [Comment] {
        var page = 1
        var comments: [Comment] = []
        while true {
            let endpoint = Endpoint(.get, "/api/feed/\(postId)/comments",
                                    query: ["page": "\(page)", "limit": "\(limit)"])
            let response: CommentsResponse = try await api.send(endpoint)
            comments.append(contentsOf: response.items)
            guard page < response.totalPages, page < 20 else { return comments }
            page += 1
        }
    }

    func addComment(
        to postId: Int,
        content: String,
        parentCommentId: Int? = nil,
        taggedUserIds: [String] = []
    ) async throws -> Comment {
        let body = CreateCommentRequest(
            content: content,
            parentCommentId: parentCommentId,
            taggedUserIds: taggedUserIds.isEmpty ? nil : taggedUserIds
        )
        return try await api.send(Endpoint(.post, "/api/feed/\(postId)/comments", body: body))
    }

    func editComment(
        postId: Int,
        commentId: Int,
        content: String,
        taggedUserIds: [String] = []
    ) async throws -> CommentEditResponse {
        let body = UpdateCommentRequest(content: content, taggedUserIds: taggedUserIds.isEmpty ? nil : taggedUserIds)
        return try await api.send(Endpoint(.patch, "/api/feed/\(postId)/comments/\(commentId)", body: body))
    }

    func deleteComment(postId: Int, commentId: Int) async throws {
        try await api.sendDiscarding(Endpoint(.delete, "/api/feed/\(postId)/comments/\(commentId)"))
    }

    func toggleCommentLike(postId: Int, commentId: Int) async throws -> LikeToggleResponse {
        try await api.send(Endpoint(.post, "/api/feed/\(postId)/comments/\(commentId)/like"))
    }

    // MARK: - Mentions

    func mentionSuggestions(for query: String) async throws -> [PostAuthor] {
        let response: PeopleResponse = try await api.send(Endpoint(.get, "/api/feed/mentions", query: ["q": query]))
        return response.items
    }

    // MARK: - Reports and blocks

    func report(postId: Int, reason: FeedReportReason) async throws {
        try await api.sendDiscarding(Endpoint(.post, "/api/feed/reports", body: CreateReportRequest(postId: postId, reason: reason)))
    }

    func report(commentId: Int, reason: FeedReportReason) async throws {
        try await api.sendDiscarding(Endpoint(.post, "/api/feed/reports", body: CreateReportRequest(commentId: commentId, reason: reason)))
    }

    func blockedPeople() async throws -> [PostAuthor] {
        let response: PeopleResponse = try await api.send(Endpoint(.get, "/api/feed/blocks"))
        return response.items
    }

    func block(userId: String) async throws {
        try await api.sendDiscarding(Endpoint(.post, "/api/feed/blocks", body: BlockUserRequest(userId: userId)))
    }

    func unblock(userId: String) async throws {
        try await api.sendDiscarding(Endpoint(.delete, "/api/feed/blocks/\(userId)"))
    }

    // MARK: - Settings

    func socialSettings() async throws -> SocialSettings {
        try await api.send(Endpoint(.get, "/api/feed/settings"))
    }

    func updateSocialSettings(_ changes: UpdateSocialSettingsRequest) async throws -> SocialSettings {
        try await api.send(Endpoint(.patch, "/api/feed/settings", body: changes))
    }
}
