import SwiftUI

/// Edits the caption of one of my posts. Photos are fixed once posted.
struct CaptionEditorView: View {
    let post: Post
    let viewModel: FeedViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var caption: String
    @State private var mentions: MentionSuggester
    @State private var isSaving = false
    @State private var error: String?
    @FocusState private var isFocused: Bool

    init(post: Post, viewModel: FeedViewModel) {
        self.post = post
        self.viewModel = viewModel
        _caption = State(initialValue: post.caption ?? "")
        _mentions = State(initialValue: MentionSuggester(known: post.taggedPeople))
    }

    private var trimmed: String { caption.trimmingCharacters(in: .whitespacesAndNewlines) }

    private var canSave: Bool {
        !isSaving
            && caption.count <= ComposePostView.maxCaption
            && trimmed != (post.caption ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            // A post with no photos needs its caption.
            && (!post.images.isEmpty || !trimmed.isEmpty)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextEditor(text: $caption)
                        .font(.body)
                        .frame(minHeight: 140)
                        .scrollContentBackground(.hidden)
                        .focused($isFocused)
                        .accessibilityIdentifier("feed_edit_caption_field")
                } footer: {
                    HStack {
                        Text(post.images.isEmpty ? "" : "Photos can't be changed after posting.")
                        Spacer()
                        Text("\(caption.count) / \(ComposePostView.maxCaption)")
                            .monospacedDigit()
                            .foregroundStyle(caption.count > ComposePostView.maxCaption ? .red : .secondary)
                    }
                    .font(.caption)
                }
                if !mentions.suggestions.isEmpty {
                    Section {
                        MentionSuggestionList(suggestions: mentions.suggestions) { person in
                            caption = mentions.accept(person, into: caption)
                        }
                        .listRowInsets(EdgeInsets())
                    }
                }
                if let error {
                    Section {
                        InlineErrorView(message: error)
                            .listRowInsets(EdgeInsets())
                    }
                }
            }
            .packRatFormStyle()
            .navigationTitle("Edit Caption")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .disabled(isSaving)
                        .accessibilityIdentifier("feed_edit_caption_cancel")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving {
                            ProgressView().controlSize(.small)
                        } else {
                            Text("Save").fontWeight(.semibold)
                        }
                    }
                    .accessibilityLabel("Save")
                    .disabled(!canSave)
                    .accessibilityIdentifier("feed_edit_caption_save")
                }
            }
            .task(id: caption) { await mentions.refresh(for: caption) }
            .onAppear { isFocused = true }
        }
        .interactiveDismissDisabled(isSaving)
        .formSheetSize(minWidth: 480, minHeight: 360)
    }

    private func save() async {
        isSaving = true
        error = nil
        defer { isSaving = false }
        do {
            // Only people newly picked here need sending; existing tags stay.
            let existing = Set(post.taggedPeople.map(\.id))
            let newTags = mentions.taggedIds(in: caption).filter { !existing.contains($0) }
            try await viewModel.updateCaption(of: post, to: trimmed.isEmpty ? nil : trimmed, taggedUserIds: newTags)
            dismiss()
        } catch {
            self.error = FeedErrorCopy.message(for: error, fallback: "Your caption couldn't be saved. Try again.")
        }
    }
}
