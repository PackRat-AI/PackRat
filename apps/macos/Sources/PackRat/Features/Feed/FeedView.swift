import SwiftUI

struct FeedView: View {
    @State private var viewModel = FeedViewModel()

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                if viewModel.isLoading && viewModel.posts.isEmpty {
                    ProgressView("Loading feed…").padding(.top, 40)
                } else if let error = viewModel.error {
                    ErrorView(error, retry: { await viewModel.load(refresh: true) })
                        .padding(.top, 20)
                } else if viewModel.posts.isEmpty {
                    EmptyStateView(
                        "Nothing here yet",
                        subtitle: "Be the first to share a trip or pack",
                        systemImage: "newspaper"
                    )
                    .padding(.top, 20)
                } else {
                    ForEach(viewModel.posts) { post in
                        PostCard(post: post, onLike: {
                            Task { await viewModel.likePost(post.id) }
                        }, onDelete: {
                            Task { await viewModel.deletePost(post.id) }
                        })
                        .padding(.horizontal)
                    }

                    if !viewModel.posts.isEmpty {
                        Button("Load More") {
                            Task { await viewModel.loadMore() }
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(.tint)
                        .padding(.bottom)
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Community Feed")
        .task { await viewModel.load() }
        .refreshable { await viewModel.load(refresh: true) }
    }
}

struct PostCard: View {
    let post: Post
    let onLike: () -> Void
    let onDelete: () -> Void
    @Environment(AuthManager.self) private var authManager

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack(spacing: 10) {
                Circle()
                    .fill(.tint.opacity(0.1))
                    .frame(width: 36, height: 36)
                    .overlay {
                        Text(post.user?.displayName.prefix(1).uppercased() ?? "?")
                            .font(.callout.bold())
                            .foregroundStyle(.tint)
                    }
                VStack(alignment: .leading, spacing: 1) {
                    Text(post.user?.displayName ?? "Unknown")
                        .font(.callout.bold())
                    Text(post.timeAgo)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if post.userId == authManager.currentUser?.id {
                    Menu {
                        Button("Delete", role: .destructive, systemImage: "trash", action: onDelete)
                    } label: {
                        Image(systemName: "ellipsis").foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }

            // Caption
            if let caption = post.caption, !caption.isEmpty {
                Text(caption).font(.body)
            }

            // Actions
            HStack(spacing: 16) {
                Button(action: onLike) {
                    Label("\(post.likeCount)", systemImage: "heart")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)

                Label("\(post.commentCount)", systemImage: "bubble.right")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12))
    }
}
