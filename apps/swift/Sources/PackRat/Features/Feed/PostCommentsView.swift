import Observation
import SwiftUI

@Observable
@MainActor
final class CommentsViewModel {
    let postId: Int
    var comments: [Comment] = []
    var isLoading = false
    var loadError: String?
    var hasLoaded = false

    private let service: FeedService

    init(postId: Int, service: FeedService = .shared) {
        self.postId = postId
        self.service = service
    }

    var threads: [CommentThread] { CommentThread.threads(from: comments) }

    func load() async {
        isLoading = true
        loadError = nil
        defer { isLoading = false }
        do {
            comments = try await service.getComments(postId: postId)
            hasLoaded = true
        } catch {
            loadError = error.localizedDescription
        }
    }

    func send(_ text: String, replyingTo parent: Comment?, taggedUserIds: [String]) async throws {
        let comment = try await service.addComment(
            to: postId,
            content: text,
            parentCommentId: parent.map { $0.parentCommentId ?? $0.id },
            taggedUserIds: taggedUserIds
        )
        comments.append(comment)
    }

    func edit(_ comment: Comment, to text: String, taggedUserIds: [String]) async throws {
        let result = try await service.editComment(
            postId: postId,
            commentId: comment.id,
            content: text,
            taggedUserIds: taggedUserIds
        )
        if let index = comments.firstIndex(where: { $0.id == comment.id }) {
            comments[index].content = result.content
            comments[index].editedAt = result.editedAt ?? Date.iso8601Now()
        }
    }

    func delete(_ comment: Comment) async throws {
        try await service.deleteComment(postId: postId, commentId: comment.id)
        comments.removeAll { $0.id == comment.id }
        // Replies to a deleted comment may go with it on the server; re-read
        // so the thread matches what everyone else sees.
        if let fresh = try? await service.getComments(postId: postId) {
            comments = fresh
        }
    }

    func toggleLike(_ comment: Comment) async throws {
        let wasLiked = comment.likedByMe
        mutate(comment.id) {
            $0.likedByMe = !wasLiked
            $0.likeCount = max(0, $0.likeCount + (wasLiked ? -1 : 1))
        }
        do {
            let result = try await service.toggleCommentLike(postId: postId, commentId: comment.id)
            mutate(comment.id) {
                $0.likedByMe = result.liked
                $0.likeCount = result.likeCount
            }
        } catch {
            mutate(comment.id) {
                $0.likedByMe = wasLiked
                $0.likeCount = comment.likeCount
            }
            throw error
        }
    }

    /// Reporting hides the comment for the reporter straight away.
    func report(_ comment: Comment, reason: FeedReportReason) async throws {
        try await service.report(commentId: comment.id, reason: reason)
        comments.removeAll { $0.id == comment.id }
    }

    func hideComments(by userId: String) {
        comments.removeAll { $0.userId == userId }
    }

    private func mutate(_ id: Int, _ change: (inout Comment) -> Void) {
        if let index = comments.firstIndex(where: { $0.id == id }) {
            change(&comments[index])
        }
    }
}

struct PostCommentsView: View {
    let post: Post
    let viewModel: FeedViewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthManager.self) private var authManager

    @State private var comments: CommentsViewModel
    @State private var mentions: MentionSuggester
    @State private var draft = ""
    @State private var replyingTo: Comment?
    @State private var editing: Comment?
    @State private var isSending = false
    @State private var alert: FeedAlert?
    @State private var pendingDelete: Comment?
    @State private var pendingBlock: PostAuthor?
    @FocusState private var isInputFocused: Bool

    init(post: Post, viewModel: FeedViewModel) {
        self.post = post
        self.viewModel = viewModel
        _comments = State(initialValue: CommentsViewModel(postId: post.id))
        _mentions = State(initialValue: MentionSuggester(known: post.taggedPeople))
    }

    private var myId: String? { authManager.currentUser?.id }
    private var trimmedDraft: String { draft.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                content
                if !mentions.suggestions.isEmpty {
                    Divider()
                    ScrollView {
                        MentionSuggestionList(suggestions: mentions.suggestions) { person in
                            draft = mentions.accept(person, into: draft)
                        }
                    }
                    .frame(maxHeight: 200)
                    .background(.bar)
                }
                Divider()
                composer
            }
            .navigationTitle("Comments")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .accessibilityIdentifier("feed_comments_done")
                }
            }
        }
        .frame(minWidth: 380, minHeight: 460)
        #if os(iOS)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        #endif
        .task {
            await comments.load()
            if comments.hasLoaded {
                viewModel.setCommentCount(of: post.id, to: comments.comments.count)
            }
        }
        .task(id: draft) { await mentions.refresh(for: draft) }
        .alert(
            alert?.title ?? "",
            isPresented: Binding(get: { alert != nil }, set: { if !$0 { alert = nil } }),
            presenting: alert
        ) { _ in
            Button("OK", role: .cancel) { alert = nil }
        } message: { alert in
            Text(alert.message)
        }
        .confirmationDialog(
            "Delete this comment?",
            isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
            titleVisibility: .visible,
            presenting: pendingDelete
        ) { comment in
            Button("Delete Comment", role: .destructive) { Task { await delete(comment) } }
                .accessibilityIdentifier("feed_confirm_delete_comment")
        } message: { _ in
            Text("This can't be undone.")
        }
        .confirmationDialog(
            "Block \(pendingBlock?.displayName ?? "this person")?",
            isPresented: Binding(get: { pendingBlock != nil }, set: { if !$0 { pendingBlock = nil } }),
            titleVisibility: .visible,
            presenting: pendingBlock
        ) { person in
            Button("Block", role: .destructive) { Task { await block(person) } }
                .accessibilityIdentifier("feed_confirm_block_commenter")
        } message: { _ in
            Text("You won't see each other's posts or comments, and neither of you can tag the other.")
        }
    }

    // MARK: - Thread

    @ViewBuilder
    private var content: some View {
        if comments.isLoading && !comments.hasLoaded {
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let error = comments.loadError, !comments.hasLoaded {
            ErrorView(error, retry: { await comments.load() })
        } else if comments.comments.isEmpty {
            UnavailableStateView(
                title: "No Comments Yet",
                subtitle: "Start the conversation.",
                systemImage: "bubble.left.and.bubble.right",
                minHeight: 200,
                accessibilityIdentifier: "feed_comments_empty"
            )
        } else {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 18) {
                        ForEach(comments.threads) { thread in
                            VStack(alignment: .leading, spacing: 14) {
                                commentRow(thread.root, isReply: false)
                                ForEach(thread.replies) { reply in
                                    commentRow(reply, isReply: true)
                                        .padding(.leading, 42)
                                }
                            }
                        }
                    }
                    .padding()
                }
                .refreshable { await comments.load() }
                .onChange(of: comments.comments.last?.id) { _, id in
                    guard let id else { return }
                    withAnimation { proxy.scrollTo(id, anchor: .bottom) }
                }
            }
        }
    }

    private func commentRow(_ comment: Comment, isReply: Bool) -> some View {
        CommentRow(
            comment: comment,
            postAuthorId: post.userId,
            taggedPeople: post.taggedPeople,
            isReply: isReply,
            isMine: comment.userId == myId,
            canDelete: comment.userId == myId || post.userId == myId,
            onReply: { startReply(to: comment) },
            onLike: { Task { await like(comment) } },
            onEdit: { startEdit(comment) },
            onDelete: { pendingDelete = comment },
            onReport: { reason in Task { await report(comment, reason: reason) } },
            onBlock: { if let author = comment.author { pendingBlock = author } }
        )
        .id(comment.id)
    }

    // MARK: - Composer

    private var composer: some View {
        VStack(spacing: 0) {
            if let context = composerContext {
                HStack {
                    Text(context)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Spacer()
                    Button {
                        cancelReplyOrEdit()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Cancel")
                    .accessibilityIdentifier("feed_comment_cancel_context")
                }
                .padding(.horizontal, 14)
                .padding(.top, 8)
            }
            HStack(alignment: .bottom, spacing: 10) {
                AvatarView(
                    url: authManager.currentUser?.avatarUrl,
                    fallbackText: authManager.currentUser?.initials ?? "",
                    size: 32
                )
                TextField(placeholder, text: $draft, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(1...5)
                    .focused($isInputFocused)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .accessibilityIdentifier("feed_comment_field")

                Button {
                    Task { await submit() }
                } label: {
                    if isSending {
                        ProgressView().controlSize(.small).frame(width: 30, height: 30)
                    } else {
                        Image(systemName: editing == nil ? "arrow.up.circle.fill" : "checkmark.circle.fill")
                            .font(.system(size: 30))
                            .foregroundStyle(trimmedDraft.isEmpty ? Color.secondary : Color.accentColor)
                    }
                }
                .buttonStyle(.plain)
                .disabled(trimmedDraft.isEmpty || isSending || draft.count > 1000)
                .accessibilityLabel(editing == nil ? "Send" : "Save")
                .accessibilityIdentifier("feed_comment_send")
            }
            .padding(12)
        }
        .background(.bar)
    }

    private var placeholder: String {
        if let replyingTo { return "Reply to \(replyingTo.author?.displayName ?? "comment")…" }
        return "Add a comment…"
    }

    private var composerContext: String? {
        if editing != nil { return "Editing your comment" }
        if let replyingTo { return "Replying to \(replyingTo.author?.displayName ?? "a comment")" }
        return nil
    }

    private func startReply(to comment: Comment) {
        editing = nil
        replyingTo = comment
        isInputFocused = true
    }

    private func startEdit(_ comment: Comment) {
        replyingTo = nil
        editing = comment
        draft = comment.content
        isInputFocused = true
    }

    private func cancelReplyOrEdit() {
        if editing != nil { draft = "" }
        editing = nil
        replyingTo = nil
    }

    // MARK: - Actions

    private func submit() async {
        let text = trimmedDraft
        guard !text.isEmpty else { return }
        isSending = true
        defer { isSending = false }
        let tagged = mentions.taggedIds(in: text)
        do {
            if let editing {
                try await comments.edit(editing, to: text, taggedUserIds: tagged)
            } else {
                try await comments.send(text, replyingTo: replyingTo, taggedUserIds: tagged)
                viewModel.adjustCommentCount(of: post.id, by: 1)
            }
            draft = ""
            editing = nil
            replyingTo = nil
        } catch {
            alert = .failure(editing == nil ? "Couldn't Post Comment" : "Couldn't Save Comment", error)
        }
    }

    private func like(_ comment: Comment) async {
        do {
            try await comments.toggleLike(comment)
        } catch {
            alert = .failure("Couldn't Update Like", error)
        }
    }

    private func delete(_ comment: Comment) async {
        do {
            try await comments.delete(comment)
            if editing?.id == comment.id || replyingTo?.id == comment.id { cancelReplyOrEdit() }
            viewModel.setCommentCount(of: post.id, to: comments.comments.count)
        } catch {
            alert = .failure("Couldn't Delete Comment", error)
        }
    }

    private func report(_ comment: Comment, reason: FeedReportReason) async {
        do {
            try await comments.report(comment, reason: reason)
            alert = .reported
        } catch {
            alert = .failure("Couldn't Send Report", error)
        }
    }

    private func block(_ person: PostAuthor) async {
        guard await viewModel.block(person) else {
            alert = viewModel.alert
            viewModel.alert = nil
            return
        }
        viewModel.alert = nil
        comments.hideComments(by: person.id)
        alert = .blocked(person)
        if person.id == post.userId { dismiss() }
    }
}

private struct CommentRow: View {
    let comment: Comment
    let postAuthorId: String
    let taggedPeople: [PostAuthor]
    let isReply: Bool
    let isMine: Bool
    let canDelete: Bool
    let onReply: () -> Void
    let onLike: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void
    let onReport: (FeedReportReason) -> Void
    let onBlock: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            AvatarView(
                url: comment.author?.avatarUrl,
                fallbackText: comment.author?.initials ?? "",
                size: isReply ? 26 : 32
            )
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(comment.author?.displayName ?? "Unknown")
                        .font(.subheadline.weight(.semibold))
                    if comment.userId == postAuthorId {
                        Text("Author")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.tint)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 1)
                            .background(.tint.opacity(0.12), in: Capsule())
                    }
                    Text(comment.timeAgo)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Text(Mentions.highlighted(comment.content, people: taggedPeople))
                    .font(.subheadline)
                    .textSelection(.enabled)
                    .accessibilityIdentifier("feed_comment_text_\(comment.id)")
                HStack(spacing: 14) {
                    Button("Reply", action: onReply)
                        .accessibilityIdentifier("feed_comment_reply_\(comment.id)")
                    if comment.likeCount > 0 {
                        Text(comment.likeCount == 1 ? "1 like" : "\(comment.likeCount) likes")
                    }
                    if comment.isEdited {
                        Text("Edited")
                            .accessibilityIdentifier("feed_comment_edited_\(comment.id)")
                    }
                    menu
                }
                .buttonStyle(.plain)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            Button(action: onLike) {
                Image(systemName: comment.likedByMe ? "heart.fill" : "heart")
                    .font(.footnote)
                    .foregroundStyle(comment.likedByMe ? .red : .secondary)
                    .symbolEffect(.bounce, value: comment.likedByMe)
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(comment.likedByMe ? "Unlike comment" : "Like comment")
            .accessibilityIdentifier("feed_comment_like_\(comment.id)")
        }
        .contextMenu { menuItems }
    }

    private var menu: some View {
        Menu {
            menuItems
        } label: {
            Image(systemName: "ellipsis")
                .frame(width: 24, height: 16)
                .contentShape(Rectangle())
        }
        .menuIndicator(.hidden)
        .accessibilityLabel("More")
        .accessibilityIdentifier("feed_comment_menu_\(comment.id)")
    }

    @ViewBuilder
    private var menuItems: some View {
        Button("Reply", systemImage: "arrowshape.turn.up.left", action: onReply)
        if isMine {
            Button("Edit", systemImage: "pencil", action: onEdit)
                .accessibilityIdentifier("feed_comment_edit_\(comment.id)")
        }
        if canDelete {
            Button("Delete", systemImage: "trash", role: .destructive, action: onDelete)
                .accessibilityIdentifier("feed_comment_delete_\(comment.id)")
        }
        if !isMine {
            Menu {
                ForEach(FeedReportReason.allCases) { reason in
                    Button(reason.label, systemImage: reason.systemImage) { onReport(reason) }
                }
            } label: {
                Label("Report Comment", systemImage: "exclamationmark.bubble")
            }
            .accessibilityIdentifier("feed_comment_report_\(comment.id)")
            if comment.author != nil {
                Button("Block \(comment.author?.displayName ?? "")", systemImage: "hand.raised", role: .destructive, action: onBlock)
                    .accessibilityIdentifier("feed_comment_block_\(comment.id)")
            }
        }
    }
}
