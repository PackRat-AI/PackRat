import Foundation
import SwiftData

/// Answers the assistant's pack tools from the local store.
///
/// Reads come straight off `PacksViewModel.packs` — the same array the Packs tab
/// renders — so the model sees exactly what the user sees, including packs
/// created offline that have not synced yet.
///
/// Writes go through `PacksViewModel.addItem`, which already inserts
/// optimistically, writes through to the API when online, and queues an outbox
/// mutation when not. Reusing it is the point: an item the assistant adds
/// behaves identically to one added by tapping through the UI.
@MainActor
struct LocalChatPackTools: ChatPackToolHandling {
    private let packsViewModel: PacksViewModel
    private let modelContext: ModelContext?

    init(packsViewModel: PacksViewModel, modelContext: ModelContext? = nil) {
        self.packsViewModel = packsViewModel
        self.modelContext = modelContext
    }

    func listPacks(nameQuery: String?) -> [ChatPackSummary] {
        let all = packsViewModel.packs
        let matches: [Pack]
        let trimmed = nameQuery?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !trimmed.isEmpty {
            let query = trimmed
            // Case-insensitive substring, mirroring the `ilike '%q%'` the tool's
            // description promises, so "japan" finds "Japan Trip".
            matches = all.filter { $0.name.localizedCaseInsensitiveContains(query) }
        } else {
            matches = all
        }

        return matches.map {
            ChatPackSummary(
                id: $0.id,
                name: $0.name,
                category: $0.category?.rawValue,
                description: $0.description
            )
        }
    }

    func packDetails(id: String) -> [String: String]? {
        guard let pack = packsViewModel.packs.first(where: { $0.id == id }) else { return nil }
        return ["id": pack.id, "name": pack.name, "contents": pack.aiContextSummary]
    }

    func addItem(_ request: ChatAddItemRequest) async throws -> ChatAddItemResult {
        guard let pack = packsViewModel.packs.first(where: { $0.id == request.packId }) else {
            throw ChatPackToolError.packNotFound(request.packId)
        }

        let idsBefore = Set((pack.items ?? []).map(\.id))

        try await packsViewModel.addItem(
            to: request.packId,
            name: request.name,
            weight: request.weight,
            weightUnit: request.weightUnit?.rawValue,
            quantity: request.quantity,
            category: request.category,
            consumable: request.consumable,
            worn: request.worn,
            notes: request.notes,
            // The catalog ids the API uses are numeric; a non-numeric value from
            // the model means "not a catalog item" rather than an error.
            catalogItemId: request.catalogItemId.flatMap(Int.init),
            context: modelContext
        )

        // Re-read through the view model: `addItem` replaces the pack value, so
        // the local `pack` binding above is already stale.
        let updated = packsViewModel.packs.first { $0.id == request.packId }
        let newItem = (updated?.items ?? []).first { !idsBefore.contains($0.id) }

        return ChatAddItemResult(
            itemId: newItem?.id ?? "",
            itemName: request.name,
            packId: request.packId,
            packName: updated?.name ?? pack.name,
            quantity: request.quantity,
            pendingSync: !NetworkMonitor.shared.isConnected
        )
    }
}
