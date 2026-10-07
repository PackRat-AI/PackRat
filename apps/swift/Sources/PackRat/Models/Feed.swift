import Foundation

// MARK: - Feed extensions (structs defined in Generated.swift)

extension Post {
    var primaryImage: String? { images.first }
    var timeAgo: String { createdAt.timeAgo }
    var isEdited: Bool { captionEditedAt != nil }
    var isSaved: Bool { savedByMe ?? false }
    var taggedPeople: [PostAuthor] { tags ?? [] }

    /// The public link for this post. Opens the post in PackRat when the app is
    /// installed, and the web share page otherwise.
    var shareURL: URL? {
        publicId.flatMap { URL(string: "\(Post.shareBaseURL)/p/\($0)") }
    }

    static let shareHost = "packratai.com"

    /// `https://packratai.com`, or — in non-production builds — the
    /// `PACKRAT_SHARE_BASE_URL` launch environment, so a local run can share
    /// links that open the locally served share page.
    static var shareBaseURL: String {
        if APIClient.isNonProduction,
           let override = ProcessInfo.processInfo.environment["PACKRAT_SHARE_BASE_URL"],
           !override.isEmpty {
            return override.hasSuffix("/") ? String(override.dropLast()) : override
        }
        return "https://\(shareHost)"
    }
}

extension PostAuthor {
    var displayName: String {
        let parts = [firstName, lastName].compactMap { $0?.nilIfEmpty }
        return parts.isEmpty ? "Unknown" : parts.joined(separator: " ")
    }

    var initials: String {
        let parts = [firstName, lastName].compactMap { $0?.nilIfEmpty }
        let letters = parts.joined(separator: " ")
            .split(separator: " ")
            .prefix(2)
            .compactMap(\.first)
        return String(letters).uppercased()
    }
}

extension Comment {
    var timeAgo: String { createdAt.timeAgo }
    var isEdited: Bool { editedAt != nil }
}

// MARK: - Reports and settings

enum FeedReportReason: String, CaseIterable, Identifiable, Codable, Sendable {
    case spam
    case harassment
    case inappropriate

    var id: String { rawValue }

    var label: String {
        switch self {
        case .spam: return "Spam"
        case .harassment: return "Harassment or Bullying"
        case .inappropriate: return "Inappropriate Content"
        }
    }

    var systemImage: String {
        switch self {
        case .spam: return "xmark.bin"
        case .harassment: return "hand.raised"
        case .inappropriate: return "eye.slash"
        }
    }
}

struct SocialSettings: Codable, Equatable, Sendable {
    var allowTagging: Bool
    var notifyTags: Bool
    var notifyComments: Bool
    var notifyReplies: Bool
}

// MARK: - Responses

struct PeopleResponse: Decodable, Sendable {
    let items: [PostAuthor]
}

struct SaveToggleResponse: Decodable, Sendable {
    let saved: Bool
}

struct CommentEditResponse: Decodable, Sendable {
    let id: Int
    let content: String
    let editedAt: String?
}

// MARK: - Request Bodies

struct CreatePostRequest: Encodable {
    let caption: String?
    let images: [String]?
    var taggedUserIds: [String]? = nil
}

struct UpdatePostRequest: Encodable {
    let caption: String?
    let taggedUserIds: [String]?
}

struct CreateCommentRequest: Encodable {
    let content: String
    var parentCommentId: Int? = nil
    var taggedUserIds: [String]? = nil
}

struct UpdateCommentRequest: Encodable {
    let content: String
    let taggedUserIds: [String]?
}

struct CreateReportRequest: Encodable {
    var postId: Int? = nil
    var commentId: Int? = nil
    let reason: FeedReportReason
}

struct BlockUserRequest: Encodable {
    let userId: String
}

struct UpdateSocialSettingsRequest: Encodable {
    var allowTagging: Bool? = nil
    var notifyTags: Bool? = nil
    var notifyComments: Bool? = nil
    var notifyReplies: Bool? = nil
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
