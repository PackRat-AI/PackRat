import Foundation

/// A top-level comment and the replies under it.
///
/// The API returns comments flat and oldest first, with replies pointing at
/// their thread's root through `parentCommentId` (it flattens a reply to a
/// reply onto the root). A reply whose parent is gone — deleted, reported or
/// from a blocked person — is shown as its own thread rather than dropped.
struct CommentThread: Identifiable, Equatable {
    let root: Comment
    let replies: [Comment]

    var id: Int { root.id }

    static func threads(from comments: [Comment]) -> [CommentThread] {
        let ids = Set(comments.map(\.id))
        var roots: [Comment] = []
        var replies: [Int: [Comment]] = [:]
        for comment in comments {
            if let parent = comment.parentCommentId, ids.contains(parent) {
                replies[parent, default: []].append(comment)
            } else {
                roots.append(comment)
            }
        }
        return roots.map { CommentThread(root: $0, replies: replies[$0.id] ?? []) }
    }

    static func == (lhs: CommentThread, rhs: CommentThread) -> Bool {
        lhs.root.id == rhs.root.id && lhs.replies.map(\.id) == rhs.replies.map(\.id)
    }
}

enum FeedErrorCopy {
    /// Copy for an action that failed. Server messages for refused actions
    /// ("Posting is suspended for this account") are written for people and
    /// shown as-is; anything else gets `fallback`.
    static func message(for error: Error, fallback: String) -> String {
        if FriendlyErrorPresentation.isConnectivityError(error) {
            return "You're offline. Check your connection and try again."
        }
        if let packRatError = error as? PackRatError,
           case .httpError(let status, let message) = packRatError,
           (400..<500).contains(status),
           let message, !message.isEmpty, message.count <= 160, !message.contains("{") {
            return message
        }
        return fallback
    }
}
