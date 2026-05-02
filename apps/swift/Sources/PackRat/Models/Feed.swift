import Foundation

struct Post: Codable, Identifiable, Sendable {
    let id: Int          // serial
    let userId: Int      // integer → users.id
    let caption: String?
    let images: [String]?
    let createdAt: String?
    let updatedAt: String?
    let user: PostUser?
    let likes: [PostLike]?
    let comments: [PostComment]?

    var likeCount: Int { likes?.count ?? 0 }
    var commentCount: Int { comments?.count ?? 0 }
    var primaryImage: String? { images?.first }

    var timeAgo: String {
        guard let str = createdAt,
              let date = ISO8601DateFormatter().date(from: str)
        else { return "" }
        return date.formatted(.relative(presentation: .named))
    }
}

struct PostUser: Codable, Sendable {
    let id: Int?         // serial → users.id
    let firstName: String?
    let lastName: String?
    let avatarUrl: String?

    var displayName: String {
        let parts = [firstName, lastName].compactMap { $0?.nilIfEmpty }
        return parts.isEmpty ? "Unknown" : parts.joined(separator: " ")
    }
}

struct PostLike: Codable, Identifiable, Sendable {
    let id: Int          // serial
    let postId: Int?     // integer → posts.id
    let userId: Int?     // integer → users.id
}

struct PostComment: Codable, Identifiable, Sendable {
    let id: Int          // serial
    let postId: Int?     // integer → posts.id
    let userId: Int?     // integer → users.id
    let content: String?
    let createdAt: String?
    let user: PostUser?
}

struct CreatePostRequest: Encodable {
    let caption: String?
    let images: [String]?
}

struct CreateCommentRequest: Encodable {
    let content: String
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
