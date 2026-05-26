import SwiftUI
import NukeUI

struct FeedView: View {
    let viewModel: FeedViewModel
    @Environment(AuthManager.self) private var authManager
    @State private var showingCompose = false

    var body: some View {
        Group {
            if !authManager.isAuthenticated {
                GuestLimitedView(
                    "Sign In to View the Feed",
                    subtitle: "Community posts, comments, and likes sync with your PackRat account.",
                    systemImage: "person.2"
                )
            } else if viewModel.isLoading && viewModel.posts.isEmpty {
                ProgressView("Loading feed…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.error {
                ErrorView(error, retry: { await viewModel.load(refresh: true) })
            } else if viewModel.posts.isEmpty {
                EmptyStateView(
                    "No Posts Yet",
                    subtitle: "Be the first to share a trip or pack",
                    systemImage: "newspaper",
                    actionLabel: "Write a Post",
                    action: { showingCompose = true }
                )
            } else {
                feedList
            }
        }
        .navigationTitle("Community Feed")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("New Post", systemImage: "square.and.pencil") {
                    showingCompose = true
                }
                .accessibilityIdentifier("feed_new_post_button")
                .disabled(!authManager.isAuthenticated)
                .keyboardShortcut("n", modifiers: .command)
            }
        }
        .task { if authManager.isAuthenticated && viewModel.posts.isEmpty { await viewModel.load() } }
        .refreshable { if authManager.isAuthenticated { await viewModel.load(refresh: true) } }
        .sheet(isPresented: $showingCompose) {
            ComposePostView(viewModel: viewModel)
        }
    }

    private var feedList: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                ForEach(viewModel.posts) { post in
                    PostCard(post: post, viewModel: viewModel)
                        .padding(.horizontal)
                }
                if viewModel.hasMore {
                    ProgressView()
                        .padding(.bottom)
                        .task { await viewModel.loadMore() }
                }
            }
            .padding(.bottom)
        }
    }
}

struct PostCard: View {
    let post: Post
    let viewModel: FeedViewModel
    @Environment(AuthManager.self) private var authManager
    @State private var isLiked = false
    @State private var showingComments = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            if let caption = post.caption, !caption.isEmpty {
                Text(caption)
                    .font(.body)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
            }
            if !post.images.isEmpty {
                imageGrid(post.images)
            }
            actionBar
        }
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .sheet(isPresented: $showingComments) {
            PostCommentsView(post: post, viewModel: viewModel)
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            AvatarView(
                url: nil,
                fallbackText: post.author?.displayName ?? "?",
                size: 38
            )
            VStack(alignment: .leading, spacing: 1) {
                Text(post.author?.displayName ?? "Unknown")
                    .font(.callout.bold())
                Text(post.timeAgo)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if post.userId == authManager.currentUser?.id {
                Menu {
                    Button("Delete", systemImage: "trash", role: .destructive) {
                        Task { await viewModel.deletePost(post.id) }
                    }
                } label: {
                    Image(systemName: "ellipsis").foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(14)
    }

    @ViewBuilder
    private func imageGrid(_ images: [String]) -> some View {
        let cols = min(images.count, 3)
        let layout = Array(repeating: GridItem(.flexible(), spacing: 2), count: cols)
        LazyVGrid(columns: layout, spacing: 2) {
            ForEach(images.prefix(cols), id: \.self) { url in
                RemoteImage(url: url, contentMode: .fill) {
                    Rectangle().fill(.fill.secondary)
                }
                .frame(height: 180)
                .clipped()
            }
        }
    }

    private var actionBar: some View {
        HStack(spacing: 20) {
            Button {
                isLiked.toggle()
                Task { await viewModel.toggleLike(post: post, isLiked: isLiked) }
            } label: {
                Label("\(post.likeCount + (isLiked ? 1 : 0))", systemImage: isLiked ? "heart.fill" : "heart")
                    .font(.callout)
                    .foregroundStyle(isLiked ? .red : .secondary)
                    .contentTransition(.numericText())
            }
            .buttonStyle(.plain)
            .animation(.spring(response: 0.3), value: isLiked)

            Button {
                showingComments = true
            } label: {
                Label("\(post.commentCount)", systemImage: "bubble.right")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)

            Spacer()

            ShareLink(item: "Check out this post on PackRat!") {
                Image(systemName: "square.and.arrow.up")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }
}
