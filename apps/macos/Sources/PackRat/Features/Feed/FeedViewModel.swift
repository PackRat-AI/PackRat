import Foundation
import Observation

@Observable
final class FeedViewModel {
    var posts: [Post] = []
    var isLoading = false
    var isRefreshing = false
    var error: String?
    var currentPage = 1

    private let service: FeedService

    init(service: FeedService = .shared) {
        self.service = service
    }

    func load(refresh: Bool = false) async {
        if refresh {
            isRefreshing = true
            currentPage = 1
        } else {
            isLoading = true
        }
        error = nil
        defer { isLoading = false; isRefreshing = false }

        do {
            let newPosts = try await service.listPosts(page: currentPage)
            if refresh || currentPage == 1 {
                posts = newPosts
            } else {
                posts.append(contentsOf: newPosts)
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadMore() async {
        guard !isLoading else { return }
        currentPage += 1
        await load()
    }

    func likePost(_ postId: String) async {
        do {
            try await service.likePost(postId)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func unlikePost(_ postId: String) async {
        do {
            try await service.unlikePost(postId)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func createPost(caption: String) async throws {
        let post = try await service.createPost(caption: caption)
        posts.insert(post, at: 0)
    }

    func addComment(to postId: String, content: String) async throws -> PostComment {
        try await service.addComment(to: postId, content: content)
    }

    // Optimistic like toggle
    func toggleLike(post: Post, isLiked: Bool) async {
        if isLiked {
            try? await service.likePost(post.id)
        } else {
            try? await service.unlikePost(post.id)
        }
    }

    func deletePost(_ postId: String) async {
        do {
            try await service.deletePost(postId)
            posts.removeAll { $0.id == postId }
        } catch {
            self.error = error.localizedDescription
        }
    }
}
