import SwiftUI
import SwiftData

// Opened via openWindow(id: "pack", value: packId)
struct PackWindowView: View {
    let packId: String
    @Environment(\.modelContext) private var modelContext
    @State private var viewModel = PacksViewModel()
    @Environment(AuthManager.self) private var authManager

    private var pack: Pack? {
        viewModel.packs.first { $0.id == packId }
    }

    var body: some View {
        Group {
            if viewModel.isLoading {
                ProgressView("Loading…")
                    .frame(minWidth: 600, minHeight: 400)
            } else if let pack {
                PackDetailView(pack: pack, viewModel: viewModel)
            } else {
                ContentUnavailableView("Pack not found", systemImage: "backpack")
                    .frame(minWidth: 600, minHeight: 400)
            }
        }
        .task { await viewModel.load(context: modelContext) }
    }
}
