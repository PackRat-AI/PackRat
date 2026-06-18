import SwiftUI

struct ComposePostView: View {
    let viewModel: FeedViewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthManager.self) private var authManager

    @State private var caption = ""
    @State private var error: String?

    private var canPost: Bool {
        !caption.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && caption.count <= 500
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(alignment: .top, spacing: 12) {
                        AvatarView(
                            url: authManager.currentUser?.avatarUrl,
                            fallbackText: authManager.currentUser?.initials ?? "?",
                            size: 36
                        )
                        ZStack(alignment: .topLeading) {
                            TextEditor(text: $caption)
                                .font(.body)
                                .frame(minHeight: 140)
                                .scrollContentBackground(.hidden)
                                .accessibilityIdentifier("feed_compose_caption")

                            if caption.isEmpty {
                                Text("Share a trip, pack, or gear tip…")
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
                        Text("\(caption.count) / 500")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(caption.count > 450 ? .orange : .secondary)
                            .accessibilityIdentifier("feed_compose_counter")
                    }
                }

                if let error {
                    Section {
                        InlineErrorView(message: error)
                    }
                }
            }
            .packRatFormStyle()
            .navigationTitle("New Post")
            #if os(macOS)
            .navigationSubtitle(authManager.currentUser?.displayName ?? "")
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .keyboardShortcut(.escape, modifiers: [])
                }
                ToolbarItem(placement: .confirmationAction) {
                    AsyncButton("Post") {
                        await post()
                    }
                    .disabled(!canPost)
                    .keyboardShortcut(.return, modifiers: .command)
                }
            }
        }
        .formSheetSize(minWidth: 500, minHeight: 420)
    }

    private func post() async {
        error = nil
        do {
            let trimmed = caption.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return }
            try await viewModel.createPost(caption: trimmed)
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
