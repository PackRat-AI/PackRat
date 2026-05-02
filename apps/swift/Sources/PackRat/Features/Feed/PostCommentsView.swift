import SwiftUI

struct PostCommentsView: View {
    let post: Post
    let viewModel: FeedViewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthManager.self) private var authManager

    @State private var newComment = ""
    @State private var comments: [Comment] = []
    @State private var isLoading = false
    @State private var isPosting = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                commentList
                Divider()
                commentInput
            }
            .navigationTitle("Comments")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .frame(minWidth: 360, minHeight: 400)
        .task {
            isLoading = true
            defer { isLoading = false }
            comments = (try? await viewModel.loadComments(for: post.id)) ?? []
        }
    }

    private var commentList: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                if isLoading {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                } else if comments.isEmpty {
                    ContentUnavailableView("No comments yet", systemImage: "bubble.right")
                        .padding(.top, 40)
                } else {
                    ForEach(comments) { comment in
                        CommentRow(comment: comment)
                    }
                }
            }
            .padding()
        }
    }

    private var commentInput: some View {
        HStack(spacing: 10) {
            AvatarView(
                url: authManager.currentUser?.avatarUrl,
                fallbackText: authManager.currentUser?.initials ?? "?",
                size: 32
            )
            TextField("Add a comment…", text: $newComment)
                .textFieldStyle(.plain)
                .onSubmit { Task { await submitComment() } }

            if !newComment.isEmpty {
                Button {
                    Task { await submitComment() }
                } label: {
                    Image(systemName: isPosting ? "circle.fill" : "arrow.up.circle.fill")
                        .font(.title3)
                        .foregroundStyle(.tint)
                }
                .buttonStyle(.plain)
                .disabled(isPosting)
            }
        }
        .padding(12)
        .background(.bar)
    }

    private func submitComment() async {
        let text = newComment.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        isPosting = true
        defer { isPosting = false }
        do {
            let comment = try await viewModel.addComment(to: post.id, content: text)
            comments.append(comment)
            newComment = ""
        } catch { }
    }
}

private struct CommentRow: View {
    let comment: Comment

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            AvatarView(
                url: nil,
                fallbackText: comment.author?.displayName.prefix(2).uppercased() ?? "?",
                size: 30
            )
            VStack(alignment: .leading, spacing: 2) {
                Text(comment.author?.displayName ?? "Unknown")
                    .font(.caption.bold())
                Text(comment.content).font(.callout)
                Text(comment.timeAgo)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
