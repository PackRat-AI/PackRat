import SwiftUI

/// One post on its own, opened from a notification or a shared link.
struct PostDetailView: View {
    let viewModel: FeedViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if let post = viewModel.posts.first {
                    ScrollView {
                        PostCard(post: post, viewModel: viewModel)
                            .padding()
                            .frame(maxWidth: 640)
                            .frame(maxWidth: .infinity)
                    }
                } else {
                    // Deleted, reported or blocked from this screen.
                    UnavailableStateView(
                        title: "Post Removed",
                        subtitle: "This post is no longer in your feed.",
                        systemImage: "photo.on.rectangle.angled",
                        accessibilityIdentifier: "feed_post_detail_removed"
                    )
                }
            }
            .navigationTitle("Post")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .accessibilityIdentifier("feed_post_detail_done")
                }
            }
            .feedAlerts(viewModel)
        }
        .formSheetSize(minWidth: 520, minHeight: 640)
        .accessibilityIdentifier("feed_post_detail")
    }
}

/// Resolves `AppState.pendingPostLink` — from a push tap or a shared link —
/// and presents the post. The post is fetched before anything opens, so a
/// removed post or a dropped connection is an alert over the current screen
/// rather than an empty sheet.
struct PostLinkPresenter: ViewModifier {
    let appState: AppState
    @Environment(AuthManager.self) private var authManager

    @State private var presented: PresentedPost?
    @State private var failure: FeedAlert?

    private struct PresentedPost: Identifiable {
        let id = UUID()
        let viewModel: FeedViewModel
    }

    func body(content: Content) -> some View {
        content
            .task(id: appState.pendingPostLink) { await resolve() }
            .sheet(item: $presented) { presented in
                PostDetailView(viewModel: presented.viewModel)
            }
            .alert(
                failure?.title ?? "",
                isPresented: Binding(get: { failure != nil }, set: { if !$0 { failure = nil } }),
                presenting: failure
            ) { _ in
                Button("OK", role: .cancel) { failure = nil }
            } message: { failure in
                Text(failure.message)
            }
    }

    private func resolve() async {
        guard let link = appState.pendingPostLink else { return }
        defer { appState.pendingPostLink = nil }

        guard authManager.isAuthenticated else {
            failure = FeedAlert(
                title: "Sign In to See This Post",
                message: "The community feed is for PackRat members. Sign in or create an account to see posts, photos and comments."
            )
            return
        }

        do {
            let post: Post
            switch link {
            case .id(let id): post = try await FeedService.shared.getPost(id)
            case .publicId(let publicId): post = try await FeedService.shared.getSharedPost(publicId: publicId)
            }
            presented = PresentedPost(viewModel: FeedViewModel(single: post, linkedTo: appState.feedVM))
        } catch {
            if Self.isNotFound(error) {
                failure = FeedAlert(
                    title: "Post Unavailable",
                    message: "This post was removed or is no longer available."
                )
            } else {
                failure = .failure("Couldn't Open Post", error)
            }
        }
    }

    private static func isNotFound(_ error: Error) -> Bool {
        guard let packRatError = error as? PackRatError else { return false }
        switch packRatError {
        case .notFound: return true
        case .httpError(let status, _): return status == 404
        default: return false
        }
    }
}
