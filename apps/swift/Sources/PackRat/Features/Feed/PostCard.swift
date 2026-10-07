import SwiftUI

struct PostCard: View {
    let post: Post
    let viewModel: FeedViewModel
    @Environment(AuthManager.self) private var authManager

    @State private var currentPhoto = 0
    @State private var viewerStart: PhotoViewerStart?
    @State private var showingComments = false
    @State private var showingCaptionEditor = false
    @State private var confirmingDelete = false
    @State private var confirmingBlock = false
    @State private var confirmingRemoveTag = false
    @State private var showingHeartBurst = false
    @State private var captionExpanded = false

    private var myId: String? { authManager.currentUser?.id }
    private var isMine: Bool { post.userId == myId }
    private var amTagged: Bool { post.taggedPeople.contains { $0.id == myId } }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            if post.images.isEmpty {
                caption(font: .body)
                    .padding(.horizontal, 14)
                    .padding(.bottom, 4)
            } else {
                photos
            }
            actionBar
            details
        }
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .accessibilityIdentifier("feed_post_\(post.id)")
        .sheet(isPresented: $showingComments) {
            PostCommentsView(post: post, viewModel: viewModel)
        }
        .sheet(isPresented: $showingCaptionEditor) {
            CaptionEditorView(post: post, viewModel: viewModel)
        }
        #if os(iOS)
        .fullScreenCover(item: $viewerStart) { start in
            PhotoViewer(images: post.images, selection: start.index)
        }
        #else
        .sheet(item: $viewerStart) { start in
            PhotoViewer(images: post.images, selection: start.index)
                .frame(minWidth: 640, minHeight: 640)
        }
        #endif
        .confirmationDialog("Delete this post?", isPresented: $confirmingDelete, titleVisibility: .visible) {
            Button("Delete Post", role: .destructive) {
                Task {
                    do {
                        try await viewModel.deletePost(post)
                    } catch {
                        viewModel.alert = .failure("Couldn't Delete Post", error)
                    }
                }
            }
            .accessibilityIdentifier("feed_confirm_delete_post")
        } message: {
            Text("It will be removed from the feed for everyone. This can't be undone.")
        }
        .confirmationDialog(
            "Block \(post.author?.displayName ?? "this person")?",
            isPresented: $confirmingBlock,
            titleVisibility: .visible
        ) {
            Button("Block", role: .destructive) {
                guard let author = post.author else { return }
                Task { _ = await viewModel.block(author) }
            }
            .accessibilityIdentifier("feed_confirm_block")
        } message: {
            Text("You won't see each other's posts or comments, and neither of you can tag the other.")
        }
        .confirmationDialog("Remove your tag?", isPresented: $confirmingRemoveTag, titleVisibility: .visible) {
            Button("Remove Tag", role: .destructive) {
                guard let myId else { return }
                Task { await viewModel.removeMyTag(from: post, userId: myId) }
            }
            .accessibilityIdentifier("feed_confirm_remove_tag")
        } message: {
            Text("Your name stays in the caption as plain text, but it won't link to you and the post leaves your Tagged list.")
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 10) {
            AvatarView(
                url: post.author?.avatarUrl,
                fallbackText: post.author?.initials ?? "",
                size: 38
            )
            VStack(alignment: .leading, spacing: 1) {
                Text(post.author?.displayName ?? "Unknown")
                    .font(.callout.bold())
                HStack(spacing: 4) {
                    Text(post.timeAgo)
                    if post.isEdited {
                        Text("·")
                        Text("Edited")
                            .accessibilityIdentifier("feed_post_edited_\(post.id)")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer()
            overflowMenu
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }

    private var overflowMenu: some View {
        Menu {
            if isMine {
                Button("Edit Caption", systemImage: "pencil") { showingCaptionEditor = true }
                    .accessibilityIdentifier("feed_edit_caption_\(post.id)")
                Button("Delete Post", systemImage: "trash", role: .destructive) { confirmingDelete = true }
                    .accessibilityIdentifier("feed_delete_post_\(post.id)")
            } else {
                if amTagged {
                    Button("Remove My Tag", systemImage: "person.crop.circle.badge.minus") {
                        confirmingRemoveTag = true
                    }
                    .accessibilityIdentifier("feed_remove_tag_\(post.id)")
                }
                Menu {
                    ForEach(FeedReportReason.allCases) { reason in
                        Button(reason.label, systemImage: reason.systemImage) {
                            Task { _ = await viewModel.report(post, reason: reason) }
                        }
                        .accessibilityIdentifier("feed_report_reason_\(reason.rawValue)")
                    }
                } label: {
                    Label("Report Post", systemImage: "exclamationmark.bubble")
                }
                .accessibilityIdentifier("feed_report_post_\(post.id)")
                if post.author != nil {
                    Button("Block \(post.author?.displayName ?? "")", systemImage: "hand.raised", role: .destructive) {
                        confirmingBlock = true
                    }
                    .accessibilityIdentifier("feed_block_author_\(post.id)")
                }
            }
        } label: {
            Image(systemName: "ellipsis")
                .font(.body.weight(.semibold))
                .foregroundStyle(.secondary)
                .frame(width: 32, height: 32)
                .contentShape(Rectangle())
        }
        .menuIndicator(.hidden)
        .buttonStyle(.plain)
        .accessibilityLabel("More")
        .accessibilityIdentifier("feed_post_menu_\(post.id)")
    }

    // MARK: - Photos

    private var photos: some View {
        PhotoCarousel(
            images: post.images,
            selection: $currentPhoto,
            onTap: { viewerStart = PhotoViewerStart(index: $0) },
            onDoubleTap: likeFromPhoto
        )
        .overlay {
            if showingHeartBurst {
                Image(systemName: "heart.fill")
                    .font(.system(size: 88))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.3), radius: 12)
                    .transition(.scale(scale: 0.4).combined(with: .opacity))
                    .allowsHitTesting(false)
            }
        }
    }

    private func likeFromPhoto() {
        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) { showingHeartBurst = true }
        Task {
            try? await Task.sleep(for: .milliseconds(650))
            withAnimation(.easeOut(duration: 0.2)) { showingHeartBurst = false }
        }
        // Double-tap only ever likes; undoing a like is the heart button's job.
        guard !post.likedByMe else { return }
        Task { await viewModel.toggleLike(post) }
    }

    // MARK: - Actions

    private var actionBar: some View {
        HStack(spacing: 20) {
            Button {
                Task { await viewModel.toggleLike(post) }
            } label: {
                Label("\(post.likeCount)", systemImage: post.likedByMe ? "heart.fill" : "heart")
                    .font(.callout)
                    .foregroundStyle(post.likedByMe ? .red : .secondary)
                    .contentTransition(.numericText())
                    .symbolEffect(.bounce, value: post.likedByMe)
            }
            .buttonStyle(.plain)
            .animation(.spring(response: 0.3), value: post.likedByMe)
            .accessibilityLabel(post.likedByMe ? "Unlike, \(post.likeCount) likes" : "Like, \(post.likeCount) likes")
            .accessibilityIdentifier("feed_like_button_\(post.id)")

            Button {
                showingComments = true
            } label: {
                Label("\(post.commentCount)", systemImage: "bubble.right")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .contentTransition(.numericText())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Comments, \(post.commentCount)")
            .accessibilityIdentifier("feed_comments_button_\(post.id)")

            shareMenu

            Spacer()

            Button {
                Task { await viewModel.toggleSave(post) }
            } label: {
                Image(systemName: post.isSaved ? "bookmark.fill" : "bookmark")
                    .font(.callout)
                    .foregroundStyle(post.isSaved ? Color.accentColor : .secondary)
                    .symbolEffect(.bounce, value: post.isSaved)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(post.isSaved ? "Remove from Saved" : "Save")
            .accessibilityIdentifier("feed_save_button_\(post.id)")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private var shareMenu: some View {
        Menu {
            if let url = post.shareURL {
                ShareLink(
                    item: url,
                    subject: Text("A post on PackRat"),
                    message: Text(shareMessage)
                ) {
                    Label("Share Link", systemImage: "link")
                }
                .accessibilityIdentifier("feed_share_link_\(post.id)")
            }
            if post.images.indices.contains(currentPhoto) {
                ShareLink(
                    item: SharedPhoto(imageKey: post.images[currentPhoto]),
                    preview: SharePreview("Photo from PackRat", image: Image("AppLogo"))
                ) {
                    Label(post.images.count > 1 ? "Share This Photo" : "Share Photo", systemImage: "photo")
                }
                .accessibilityIdentifier("feed_share_photo_\(post.id)")
            }
        } label: {
            Image(systemName: "square.and.arrow.up")
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .menuIndicator(.hidden)
        .buttonStyle(.plain)
        .disabled(post.shareURL == nil && post.images.isEmpty)
        .accessibilityLabel("Share")
        .accessibilityIdentifier("feed_share_button_\(post.id)")
    }

    private var shareMessage: String {
        let name = post.author?.displayName ?? "Someone"
        return "\(name) shared a post on PackRat"
    }

    // MARK: - Details

    @ViewBuilder
    private var details: some View {
        VStack(alignment: .leading, spacing: 6) {
            if !post.images.isEmpty, post.caption?.isEmpty == false {
                caption(font: .callout)
            }
            if !post.taggedPeople.isEmpty {
                taggedLine
            }
            if post.commentCount > 0 {
                Button {
                    showingComments = true
                } label: {
                    Text(post.commentCount == 1 ? "View 1 comment" : "View all \(post.commentCount) comments")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("feed_view_comments_\(post.id)")
            }
        }
        .padding(.horizontal, 14)
        .padding(.bottom, 12)
    }

    @ViewBuilder
    private func caption(font: Font) -> some View {
        if let caption = post.caption, !caption.isEmpty {
            let isLong = caption.count > 220 || caption.filter(\.isNewline).count > 4
            VStack(alignment: .leading, spacing: 2) {
                Text(Mentions.highlighted(caption, people: post.taggedPeople))
                    .font(font)
                    .lineLimit(isLong && !captionExpanded ? 4 : nil)
                    .textSelection(.enabled)
                    .accessibilityIdentifier("feed_post_caption_\(post.id)")
                if isLong {
                    Button(captionExpanded ? "Less" : "More") {
                        withAnimation(.easeInOut(duration: 0.2)) { captionExpanded.toggle() }
                    }
                    .font(.callout.weight(.medium))
                    .foregroundStyle(.secondary)
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("feed_caption_more_\(post.id)")
                }
            }
        }
    }

    private var taggedLine: some View {
        let names = post.taggedPeople.map(\.displayName)
        let text: String
        switch names.count {
        case 1: text = names[0]
        case 2: text = "\(names[0]) and \(names[1])"
        default: text = "\(names[0]) and \(names.count - 1) others"
        }
        return HStack(spacing: 6) {
            Image(systemName: "person.2.fill")
                .font(.caption)
                .foregroundStyle(.secondary)
            (Text("with ").foregroundStyle(.secondary) + Text(text).fontWeight(.semibold))
                .font(.footnote)
                .lineLimit(1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("feed_post_tags_\(post.id)")
    }
}

/// Alerts raised by feed actions, shown by whichever screen hosts the list.
struct FeedAlertModifier: ViewModifier {
    let viewModel: FeedViewModel

    func body(content: Content) -> some View {
        content.alert(
            viewModel.alert?.title ?? "",
            isPresented: Binding(
                get: { viewModel.alert != nil },
                set: { if !$0 { viewModel.alert = nil } }
            ),
            presenting: viewModel.alert
        ) { _ in
            Button("OK", role: .cancel) { viewModel.alert = nil }
        } message: { alert in
            Text(alert.message)
        }
    }
}

extension View {
    func feedAlerts(_ viewModel: FeedViewModel) -> some View {
        modifier(FeedAlertModifier(viewModel: viewModel))
    }
}
