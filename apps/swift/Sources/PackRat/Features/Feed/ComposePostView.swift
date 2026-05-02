import SwiftUI

struct ComposePostView: View {
    let viewModel: FeedViewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthManager.self) private var authManager

    @State private var caption = ""
    @State private var error: String?

    private var canPost: Bool { !caption.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top, spacing: 12) {
                    AvatarView(
                        url: authManager.currentUser?.avatarUrl,
                        fallbackText: authManager.currentUser?.initials ?? "?",
                        size: 40
                    )
                    TextEditor(text: $caption)
                        .font(.body)
                        .frame(minHeight: 120, maxHeight: 240)
                        .scrollContentBackground(.hidden)
                        .overlay(alignment: .topLeading) {
                            if caption.isEmpty {
                                Text("Share a trip, pack, or gear tip…")
                                    .foregroundStyle(.tertiary)
                                    .allowsHitTesting(false)
                                    .padding(.top, 8)
                                    .padding(.leading, 4)
                            }
                        }
                }
                .padding()

                if let error {
                    InlineErrorView(message: error).padding(.horizontal)
                }

                Divider()

                HStack {
                    Text("\(caption.count) / 500")
                        .font(.caption)
                        .foregroundStyle(caption.count > 450 ? .orange : .secondary)
                    Spacer()
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
            }
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
        .frame(minWidth: 400, minHeight: 260)
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
