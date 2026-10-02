import SwiftUI

/// Pack-scoped wrapper around `ChatView`.
///
/// Mirrors Expo, which routes to `/ai-chat` with `{ packId, packName,
/// contextType: 'pack' }` rather than hosting a separate chat implementation
/// (apps/expo/features/packs/screens/PackDetailScreen.tsx `handleAskAI`). The
/// view model is created per-presentation so each pack gets its own transcript
/// and the global assistant's history is left untouched.
struct PackAskAISheet: View {
    let pack: Pack

    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: ChatViewModel

    init(pack: Pack) {
        self.pack = pack
        _viewModel = State(initialValue: ChatViewModel(
            context: .pack(id: pack.id, name: pack.name, details: pack.aiContextSummary)
        ))
    }

    var body: some View {
        NavigationStack {
            ChatView(viewModel: viewModel)
                .navigationTitle("Ask AI")
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                #endif
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") { dismiss() }
                            .accessibilityIdentifier("pack_ask_ai_done")
                    }
                }
        }
        #if os(macOS)
        .frame(minWidth: 520, minHeight: 600)
        #endif
    }
}
