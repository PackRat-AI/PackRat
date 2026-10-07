import PhotosUI
import Sentry
import SwiftUI

/// A photo waiting to be posted. Keeps its uploaded key so a retry after a
/// failed post only uploads what did not make it the first time.
struct DraftPhoto: Identifiable {
    let id = UUID()
    let jpeg: Data
    let preview: CGImage
    var uploadedKey: String?
}

struct ComposePostView: View {
    let viewModel: FeedViewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthManager.self) private var authManager

    static let maxPhotos = 10
    static let maxCaption = 500

    private enum Phase: Equatable {
        case editing
        case uploading(completed: Int, total: Int)
        case publishing
    }

    @State private var caption = ""
    @State private var photos: [DraftPhoto] = []
    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var isImporting = false
    @State private var showingCamera = false
    @State private var mentions = MentionSuggester()
    @State private var phase: Phase = .editing
    @State private var error: String?
    @State private var confirmingDiscard = false
    @FocusState private var isInputFocused: Bool

    private var trimmedCaption: String {
        caption.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var isBusy: Bool { phase != .editing || isImporting }

    private var hasContent: Bool { !photos.isEmpty || !trimmedCaption.isEmpty }

    private var canPost: Bool {
        !isBusy && hasContent && caption.count <= Self.maxCaption
    }

    private var remainingSlots: Int { Self.maxPhotos - photos.count }

    var body: some View {
        NavigationStack {
            Form {
                captionSection
                if !mentions.suggestions.isEmpty {
                    Section {
                        MentionSuggestionList(suggestions: mentions.suggestions) { person in
                            caption = mentions.accept(person, into: caption)
                        }
                        .listRowInsets(EdgeInsets())
                    }
                }
                photosSection
                taggedSection
                statusSection
            }
            .packRatFormStyle()
            .keyboardDoneButton(isFocused: $isInputFocused)
            .navigationTitle("New Post")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            #if os(macOS)
            .navigationSubtitle(authManager.currentUser?.displayName ?? "")
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        if hasContent { confirmingDiscard = true } else { dismiss() }
                    }
                    .disabled(phase != .editing)
                    .keyboardShortcut(.escape, modifiers: [])
                    .accessibilityIdentifier("feed_compose_cancel")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await post() }
                    } label: {
                        if phase == .editing {
                            Text("Post").fontWeight(.semibold)
                        } else {
                            ProgressView().controlSize(.small)
                        }
                    }
                    .accessibilityLabel("Post")
                    .disabled(!canPost)
                    .keyboardShortcut(.return, modifiers: .command)
                    .accessibilityIdentifier("feed_compose_post_button")
                }
            }
            .confirmationDialog("Discard this post?", isPresented: $confirmingDiscard, titleVisibility: .visible) {
                Button("Discard", role: .destructive) { dismiss() }
                    .accessibilityIdentifier("feed_compose_discard")
                Button("Keep Editing", role: .cancel) {}
            } message: {
                Text("Your photos and caption will be lost.")
            }
            .task(id: caption) { await mentions.refresh(for: caption) }
            .onChange(of: pickerItems) { _, items in
                guard !items.isEmpty else { return }
                Task { await importPicked(items) }
            }
            #if os(iOS)
            .fullScreenCover(isPresented: $showingCamera) {
                WildlifeCameraView(
                    onCapture: { data in
                        showingCamera = false
                        Task { await addPhotos([data]) }
                    },
                    onCancel: { showingCamera = false }
                )
                .ignoresSafeArea()
            }
            #endif
        }
        .interactiveDismissDisabled(hasContent || phase != .editing)
        .formSheetSize(minWidth: 520, minHeight: 560)
    }

    // MARK: - Caption

    private var captionSection: some View {
        Section {
            HStack(alignment: .top, spacing: 12) {
                AvatarView(
                    url: authManager.currentUser?.avatarUrl,
                    fallbackText: authManager.currentUser?.initials ?? "",
                    size: 36
                )
                ZStack(alignment: .topLeading) {
                    TextEditor(text: $caption)
                        .font(.body)
                        .frame(minHeight: 120)
                        .scrollContentBackground(.hidden)
                        .focused($isInputFocused)
                        .disabled(phase != .editing)
                        .accessibilityIdentifier("feed_compose_caption")

                    if caption.isEmpty {
                        Text("Say something about the trip. Type @ to tag who was there.")
                            .foregroundStyle(.tertiary)
                            .allowsHitTesting(false)
                            .padding(.top, 8)
                            .padding(.leading, 4)
                    }
                }
            }
            .padding(.vertical, 4)
        } footer: {
            HStack {
                Spacer()
                Text("\(caption.count) / \(Self.maxCaption)")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(captionCounterColor)
                    .accessibilityIdentifier("feed_compose_counter")
            }
        }
    }

    private var captionCounterColor: Color {
        if caption.count > Self.maxCaption { return .red }
        if caption.count > Self.maxCaption - 50 { return .orange }
        return .secondary
    }

    // MARK: - Photos

    private var photosSection: some View {
        Section {
            ScrollView(.horizontal) {
                HStack(spacing: 10) {
                    ForEach(Array(photos.enumerated()), id: \.element.id) { index, photo in
                        DraftPhotoThumbnail(
                            photo: photo,
                            isCover: index == 0,
                            canMoveLeft: index > 0,
                            canMoveRight: index < photos.count - 1,
                            isLocked: phase != .editing,
                            onMove: { move(photo.id, by: $0) },
                            onRemove: { remove(photo.id) }
                        )
                        .draggable(photo.id.uuidString) {
                            Image(decorative: photo.preview, scale: 1)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 72, height: 72)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }
                        .dropDestination(for: String.self) { items, _ in
                            guard let dragged = items.first.flatMap(UUID.init(uuidString:)) else { return false }
                            return moveDragged(dragged, to: photo.id)
                        }
                    }
                    if isImporting {
                        ProgressView()
                            .frame(width: 88, height: 88)
                            .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    if remainingSlots > 0 && phase == .editing {
                        addTiles
                    }
                }
                .padding(.vertical, 4)
            }
            .scrollIndicators(.hidden)
        } header: {
            HStack {
                Text("Photos")
                Spacer()
                Text("\(photos.count) of \(Self.maxPhotos)")
                    .monospacedDigit()
                    .accessibilityIdentifier("feed_compose_photo_count")
            }
        } footer: {
            Text(photos.count > 1
                 ? "Drag to reorder. The first photo leads the post. Location data is removed before upload."
                 : "Add up to \(Self.maxPhotos) photos. Location data is removed before upload.")
        }
    }

    @ViewBuilder
    private var addTiles: some View {
        PhotosPicker(
            selection: $pickerItems,
            maxSelectionCount: remainingSlots,
            selectionBehavior: .ordered,
            matching: .images
        ) {
            AddPhotoTile(title: "Library", systemImage: "photo.on.rectangle")
        }
        .buttonStyle(.plain)
        .disabled(isImporting)
        .accessibilityIdentifier("feed_compose_add_photos")

        #if os(iOS)
        if UIImagePickerController.isSourceTypeAvailable(.camera) {
            Button {
                showingCamera = true
            } label: {
                AddPhotoTile(title: "Camera", systemImage: "camera")
            }
            .buttonStyle(.plain)
            .disabled(isImporting)
            .accessibilityIdentifier("feed_compose_camera")
        }
        #endif
    }

    private func importPicked(_ items: [PhotosPickerItem]) async {
        isImporting = true
        var datas: [Data] = []
        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self) {
                datas.append(data)
            }
        }
        pickerItems = []
        let skipped = items.count - datas.count
        await addPhotos(datas)
        if skipped > 0 {
            error = skipped == 1
                ? "One photo couldn't be added. It may still be downloading from iCloud."
                : "\(skipped) photos couldn't be added. They may still be downloading from iCloud."
        }
    }

    private func addPhotos(_ datas: [Data]) async {
        isImporting = true
        defer { isImporting = false }
        for data in datas.prefix(remainingSlots) {
            let prepared = await Task.detached(priority: .userInitiated) {
                FeedPhotoProcessing.prepare(data)
            }.value
            guard let prepared else {
                error = "That photo couldn't be read. Try a different one."
                continue
            }
            withAnimation(.snappy) {
                photos.append(DraftPhoto(jpeg: prepared.jpeg, preview: prepared.preview))
            }
        }
    }

    private func move(_ id: UUID, by offset: Int) {
        guard let from = photos.firstIndex(where: { $0.id == id }) else { return }
        let to = from + offset
        guard photos.indices.contains(to) else { return }
        withAnimation(.snappy) { photos.swapAt(from, to) }
    }

    private func moveDragged(_ dragged: UUID, to target: UUID) -> Bool {
        guard phase == .editing,
              dragged != target,
              let from = photos.firstIndex(where: { $0.id == dragged }),
              let to = photos.firstIndex(where: { $0.id == target })
        else { return false }
        withAnimation(.snappy) {
            let photo = photos.remove(at: from)
            photos.insert(photo, at: to)
        }
        return true
    }

    private func remove(_ id: UUID) {
        withAnimation(.snappy) { photos.removeAll { $0.id == id } }
    }

    // MARK: - Tagged

    @ViewBuilder
    private var taggedSection: some View {
        let tagged = mentions.taggedPeople(in: caption)
        if !tagged.isEmpty {
            Section("Tagging") {
                ForEach(tagged) { person in
                    HStack(spacing: 10) {
                        AvatarView(url: person.avatarUrl, fallbackText: person.initials, size: 28)
                        Text(person.displayName)
                        Spacer()
                    }
                    .accessibilityIdentifier("feed_compose_tagged_\(person.id)")
                }
            }
        }
    }

    // MARK: - Status

    @ViewBuilder
    private var statusSection: some View {
        switch phase {
        case .uploading(let completed, let total):
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Uploading photo \(min(completed + 1, total)) of \(total)…")
                        .font(.callout)
                    ProgressView(value: Double(completed), total: Double(max(total, 1)))
                }
                .padding(.vertical, 4)
                .accessibilityIdentifier("feed_compose_upload_progress")
            }
        case .publishing:
            Section {
                HStack(spacing: 10) {
                    ProgressView().controlSize(.small)
                    Text("Posting…").font(.callout)
                }
                .accessibilityIdentifier("feed_compose_publishing")
            }
        case .editing:
            if let error {
                Section {
                    InlineErrorView(message: error)
                        .listRowInsets(EdgeInsets())
                    if hasContent {
                        Button {
                            Task { await post() }
                        } label: {
                            Label("Try Again", systemImage: "arrow.clockwise")
                        }
                        .disabled(!canPost)
                        .accessibilityIdentifier("feed_compose_retry")
                    }
                }
            }
        }
    }

    // MARK: - Posting

    private func post() async {
        guard canPost else { return }
        guard let userId = authManager.currentUser?.id else {
            error = "Sign in to post to the feed."
            return
        }
        error = nil
        isInputFocused = false

        do {
            let pending = photos.filter { $0.uploadedKey == nil }
            var completed = photos.count - pending.count
            if !pending.isEmpty {
                phase = .uploading(completed: completed, total: photos.count)
                try await withThrowingTaskGroup(of: (UUID, String).self) { group in
                    for photo in pending {
                        let id = photo.id
                        let jpeg = photo.jpeg
                        group.addTask {
                            // The presign route requires keys to start with `{userId}-`.
                            let key = try await UploadService.shared.upload(
                                data: jpeg,
                                fileName: "\(userId)-\(UUID().uuidString).jpg",
                                mimeType: "image/jpeg"
                            )
                            return (id, key)
                        }
                    }
                    for try await (id, key) in group {
                        if let index = photos.firstIndex(where: { $0.id == id }) {
                            photos[index].uploadedKey = key
                        }
                        completed += 1
                        phase = .uploading(completed: completed, total: photos.count)
                    }
                }
            }

            phase = .publishing
            try await viewModel.createPost(
                caption: trimmedCaption.isEmpty ? nil : trimmedCaption,
                images: photos.compactMap(\.uploadedKey),
                taggedUserIds: mentions.taggedIds(in: caption)
            )
            dismiss()
        } catch {
            phase = .editing
            SentrySDK.capture(error: error) { scope in
                scope.setTag(value: "feed", key: "feature")
                scope.setTag(value: "createPost", key: "action")
                scope.setExtra(value: photos.count, key: "photoCount")
            }
            self.error = FeedErrorCopy.message(
                for: error,
                fallback: "Your post didn't go through. Your photos and caption are still here, so you can try again."
            )
        }
    }
}

// MARK: - Thumbnails

private struct DraftPhotoThumbnail: View {
    let photo: DraftPhoto
    let isCover: Bool
    let canMoveLeft: Bool
    let canMoveRight: Bool
    let isLocked: Bool
    let onMove: (Int) -> Void
    let onRemove: () -> Void

    var body: some View {
        Image(decorative: photo.preview, scale: 1)
            .resizable()
            .scaledToFill()
            .frame(width: 88, height: 88)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(alignment: .bottomLeading) {
                if isCover {
                    Text("Cover")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(.black.opacity(0.55), in: Capsule())
                        .padding(5)
                }
            }
            .overlay(alignment: .topTrailing) {
                if !isLocked {
                    Button(action: onRemove) {
                        Image(systemName: "xmark")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.white)
                            .frame(width: 22, height: 22)
                            .background(.black.opacity(0.6), in: Circle())
                    }
                    .buttonStyle(.plain)
                    .padding(4)
                    .accessibilityLabel("Remove photo")
                    .accessibilityIdentifier("feed_compose_remove_photo")
                }
            }
            .overlay {
                if photo.uploadedKey != nil && isLocked {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title3)
                        .foregroundStyle(.white, .green)
                }
            }
            .contextMenu {
                if !isLocked {
                    if canMoveLeft {
                        Button("Move Earlier", systemImage: "arrow.left") { onMove(-1) }
                    }
                    if canMoveRight {
                        Button("Move Later", systemImage: "arrow.right") { onMove(1) }
                    }
                    Button("Remove", systemImage: "trash", role: .destructive, action: onRemove)
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel(isCover ? "Cover photo" : "Photo")
            .accessibilityIdentifier("feed_compose_photo")
    }
}

private struct AddPhotoTile: View {
    let title: String
    let systemImage: String

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: systemImage)
                .font(.title3)
            Text(title)
                .font(.caption.weight(.medium))
        }
        .foregroundStyle(.tint)
        .frame(width: 88, height: 88)
        .background(.tint.opacity(0.1), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(.tint.opacity(0.35), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
        }
        .contentShape(Rectangle())
    }
}
