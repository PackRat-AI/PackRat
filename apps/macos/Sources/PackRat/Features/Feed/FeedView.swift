import SwiftUI
import NukeUI

struct FeedView: View {
    let viewModel: FeedViewModel

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                if viewModel.isLoading && viewModel.posts.isEmpty {
                    ProgressView("Loading feed…").padding(.top, 40)
                } else if let error = viewModel.error {
                    ErrorView(error, retry: { await viewModel.load(refresh: true) }).padding(.top, 20)
                } else if viewModel.posts.isEmpty {
                    EmptyStateView(
                        "Nothing here yet",
                        subtitle: "Be the first to share a trip or pack",
                        systemImage: "newspaper"
                    )
                    .padding(.top, 20)
                } else {
                    ForEach(viewModel.posts) { post in
                        PostCard(post: post, viewModel: viewModel)
                            .padding(.horizontal)
                    }
                    if !viewModel.posts.isEmpty {
                        Button("Load More") { Task { await viewModel.loadMore() } }
                            .buttonStyle(.plain).foregroundStyle(.tint).padding(.bottom)
                            .disabled(viewModel.isLoading)
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Community Feed")
        .task { if viewModel.posts.isEmpty { await viewModel.load() } }
        .refreshable { await viewModel.load(refresh: true) }
    }
}

struct PostCard: View {
    let post: Post
    let viewModel: FeedViewModel
    @Environment(AuthManager.self) private var authManager
    @State private var isLiked = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            if let caption = post.caption, !caption.isEmpty {
                Text(caption)
                    .font(.body)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
            }
            if let images = post.images, !images.isEmpty {
                imageGrid(images)
            }
            actionBar
        }
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var header: some View {
        HStack(spacing: 10) {
            AvatarView(
                url: nil,
                fallbackText: post.user?.displayName ?? "?",
                size: 38
            )
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
                    Button("Delete", role: .destructive, systemImage: "trash") {
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
                Task {
                    if isLiked { await viewModel.likePost(post.id) }
                    else { await viewModel.unlikePost(post.id) }
                }
            } label: {
                Label("\(post.likeCount + (isLiked ? 1 : 0))", systemImage: isLiked ? "heart.fill" : "heart")
                    .font(.callout)
                    .foregroundStyle(isLiked ? .red : .secondary)
            }
            .buttonStyle(.plain)
            .animation(.spring(response: 0.3), value: isLiked)

            Label("\(post.commentCount)", systemImage: "bubble.right")
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }
}
