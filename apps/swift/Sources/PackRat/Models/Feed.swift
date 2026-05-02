import Foundation

// MARK: - Feed extensions (structs defined in Generated.swift)

extension Post {
    var primaryImage: String? { images.first }
    var timeAgo: String { createdAt.timeAgo }
}

extension PostAuthor {
    var displayName: String {
        let parts = [firstName, lastName].compactMap { $0?.nilIfEmpty }
        return parts.isEmpty ? "Unknown" : parts.joined(separator: " ")
    }
}

extension Comment {
    var timeAgo: String { createdAt.timeAgo }
}

// MARK: - Request Bodies

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
