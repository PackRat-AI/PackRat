import SwiftUI

/// Item-scoped wrapper around `ChatView`.
///
/// The item counterpart to `PackAskAISheet`. Mirrors Expo, which routes to
/// `/ai-chat` with `{ itemId, itemName, contextType: 'item' }`
/// (apps/expo/features/packs/screens/PackItemDetailScreen.tsx `navigateToChat`).
///
/// The view model is held in `@State` so it is created once per presentation:
/// building it inline in the `.sheet` closure instead lets SwiftUI rebuild it on
/// any re-render — dismissing the keyboard is enough — which cancels the
/// in-flight streaming request and drops the transcript.
struct PackItemAskAISheet: View {
    let item: PackItem

    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: ChatViewModel

    init(item: PackItem) {
        self.item = item
        _viewModel = State(initialValue: ChatViewModel(
            context: .item(
                id: item.id,
                name: item.name,
                details: item.aiContextSummary,
                fields: item.aiToolFields
            )
        ))
    }

    var body: some View {
        NavigationStack {
            ChatView(viewModel: viewModel)
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                #endif
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") { dismiss() }
                            .accessibilityIdentifier("pack_item_ask_ai_done")
                    }
                }
        }
        #if os(macOS)
        .frame(minWidth: 520, minHeight: 600)
        #endif
    }
}
