import Foundation
import Observation

/// One list of posts — the community feed, Saved, Tagged in, or a single post
/// opened from a link — and every action on them.
///
/// Secondary lists are `linked` to the community feed, so liking, saving,
/// editing or removing a post anywhere is reflected in the feed without a
/// reload.
@Observable
@MainActor
final class FeedViewModel {
    var posts: [Post] = []
    var isLoading = false
    var isRefreshing = false
    var error: String?
    var currentPage = 1
    var hasMore = true
    /// The outcome of an action (a failed like, a sent report…) to show in an
    /// alert. Lists stay put; only the alert reports what happened.
    var alert: FeedAlert?

    let scope: FeedScope
    weak var linked: FeedViewModel?

    private let service: FeedService

    init(scope: FeedScope = .all, service: FeedService = .shared) {
        self.scope = scope
        self.service = service
    }

    /// A one-post list for a post opened from a notification or link.
    convenience init(single post: Post, linkedTo feed: FeedViewModel?) {
        self.init(scope: .all)
        posts = [post]
        hasMore = false
        linked = feed
    }

    func load(refresh: Bool = false) async {
        if VisualSampleData.isEnabled && !posts.isEmpty {
            isLoading = false
            isRefreshing = false
            error = nil
            return
        }
        if VisualSampleData.isScreenshotCapture {
            isLoading = false
            isRefreshing = false
            error = nil
            posts = []
            hasMore = false
            return
        }

        if refresh {
            isRefreshing = true
            currentPage = 1
            hasMore = true
        } else {
            isLoading = true
        }
        error = nil
        defer { isLoading = false; isRefreshing = false }

        do {
            let response = try await service.listPostsResponse(scope: scope, page: currentPage)
            if refresh || currentPage == 1 {
                posts = response.items
            } else {
                let known = Set(posts.map(\.id))
                posts.append(contentsOf: response.items.filter { !known.contains($0.id) })
            }
            hasMore = currentPage < response.totalPages
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadMore() async {
        guard hasMore, !isLoading else { return }
        currentPage += 1
        await load()
    }

    // MARK: - Posting

    func createPost(caption: String?, images: [String], taggedUserIds: [String]) async throws {
        let post = try await service.createPost(caption: caption, images: images, taggedUserIds: taggedUserIds)
        posts.insert(post, at: 0)
    }

    func updateCaption(of post: Post, to caption: String?, taggedUserIds: [String]) async throws {
        let updated = try await service.updatePost(post.id, caption: caption, taggedUserIds: taggedUserIds)
        replace(updated)
    }

    func deletePost(_ post: Post) async throws {
        try await service.deletePost(post.id)
        removePosts { $0.id == post.id }
    }

    // MARK: - Likes and saves (optimistic)

    func toggleLike(_ post: Post) async {
        let wasLiked = post.likedByMe
        mutate(post.id) {
            $0.likedByMe = !wasLiked
            $0.likeCount = max(0, $0.likeCount + (wasLiked ? -1 : 1))
        }
        do {
            let result = try await service.toggleLike(post.id)
            mutate(post.id) {
                $0.likedByMe = result.liked
                $0.likeCount = result.likeCount
            }
        } catch {
            mutate(post.id) {
                $0.likedByMe = wasLiked
                $0.likeCount = post.likeCount
            }
            alert = .failure("Couldn't Update Like", error)
        }
    }

    func toggleSave(_ post: Post) async {
        let wasSaved = post.isSaved
        mutate(post.id) { $0.savedByMe = !wasSaved }
        do {
            let saved = try await service.setSaved(post.id, saved: !wasSaved)
            mutate(post.id) { $0.savedByMe = saved }
        } catch {
            mutate(post.id) { $0.savedByMe = wasSaved }
            alert = .failure("Couldn't Update Saved Posts", error)
        }
    }

    // MARK: - Tags, reports, blocks

    func removeMyTag(from post: Post, userId: String) async {
        do {
            try await service.removeMyTag(from: post.id)
            mutate(post.id) { $0.tags = $0.tags?.filter { $0.id != userId } }
            if scope == .tagged {
                posts.removeAll { $0.id == post.id }
            }
        } catch {
            alert = .failure("Couldn't Remove Your Tag", error)
        }
    }

    /// Reporting hides the post for the reporter straight away.
    func report(_ post: Post, reason: FeedReportReason) async -> Bool {
        do {
            try await service.report(postId: post.id, reason: reason)
            removePosts { $0.id == post.id }
            alert = .reported
            return true
        } catch {
            alert = .failure("Couldn't Send Report", error)
            return false
        }
    }

    /// Blocking hides everything the person posted.
    func block(_ person: PostAuthor) async -> Bool {
        do {
            try await service.block(userId: person.id)
            removePosts { $0.userId == person.id }
            alert = .blocked(person)
            return true
        } catch {
            alert = .failure("Couldn't Block \(person.displayName)", error)
            return false
        }
    }

    /// Keeps the comment count on the card in step with the thread.
    func adjustCommentCount(of postId: Int, by delta: Int) {
        mutate(postId) { $0.commentCount = max(0, $0.commentCount + delta) }
    }

    func setCommentCount(of postId: Int, to count: Int) {
        mutate(postId) { $0.commentCount = count }
    }

    func post(withId id: Int) -> Post? {
        posts.first { $0.id == id }
    }

    // MARK: - Local state

    private func mutate(_ postId: Int, _ change: (inout Post) -> Void) {
        if let index = posts.firstIndex(where: { $0.id == postId }) {
            change(&posts[index])
        }
        linked?.mutate(postId, change)
    }

    private func replace(_ post: Post) {
        if let index = posts.firstIndex(where: { $0.id == post.id }) {
            posts[index] = post
        }
        linked?.replace(post)
    }

    private func removePosts(where shouldRemove: (Post) -> Bool) {
        posts.removeAll(where: shouldRemove)
        linked?.removePosts(where: shouldRemove)
    }
}

struct FeedAlert: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String

    static func failure(_ title: String, _ error: Error) -> FeedAlert {
        FeedAlert(title: title, message: FeedErrorCopy.message(for: error, fallback: "Something went wrong on our end. Please try again."))
    }

    static let reported = FeedAlert(
        title: "Thanks for Letting Us Know",
        message: "It's hidden for you now, and the PackRat team will review it."
    )

    static func blocked(_ person: PostAuthor) -> FeedAlert {
        FeedAlert(
            title: "\(person.displayName) Is Blocked",
            message: "You won't see each other's posts or comments. You can unblock them in Feed Settings."
        )
    }
}
