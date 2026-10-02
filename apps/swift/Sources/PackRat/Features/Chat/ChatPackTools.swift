import Foundation

/// The local-data side of the assistant's pack tools.
///
/// Tools that touch the user's own packs are declared server-side with no
/// `execute` (see `packages/api/src/utils/ai/tools.ts`), so the model's call is
/// streamed down and answered here, against the device's local store.
///
/// That split is deliberate rather than incidental. The local store is what the
/// user is looking at and is also the write path — mutations land there and sync
/// outward through the outbox. Answering from the server instead would mean an
/// item the assistant "added" stayed invisible until the next refresh, and that
/// nothing worked offline.
@MainActor
protocol ChatPackToolHandling {
    /// Packs matching `nameQuery`, or all packs when it is nil/empty.
    func listPacks(nameQuery: String?) -> [ChatPackSummary]

    /// A pack's full contents, or nil when no pack has that id.
    func packDetails(id: String) -> [String: String]?

    /// Adds an item to a pack, returning a short confirmation.
    /// Throws if the pack is unknown or the write fails.
    func addItem(_ request: ChatAddItemRequest) async throws -> ChatAddItemResult
}

/// The subset of a pack the model needs in order to pick one by name.
struct ChatPackSummary: Encodable {
    let id: String
    let name: String
    let category: String?
    let description: String?
}

/// A model-requested item insertion, decoded from the tool call's arguments.
struct ChatAddItemRequest {
    let packId: String
    let name: String
    let weight: Double?
    let weightUnit: WeightUnit?
    let quantity: Int
    let category: String?
    let consumable: Bool
    let worn: Bool
    let notes: String?
    let catalogItemId: String?

    /// Decodes the tool arguments, defaulting the optional fields the way the
    /// tool's schema documents. Returns nil when a required field is missing, so
    /// a malformed call becomes a tool error the model can react to rather than
    /// a silently wrong insert.
    init?(toolArguments args: [String: Any]) {
        guard let packId = args["packId"] as? String, !packId.isEmpty,
              let name = (args["name"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
              !name.isEmpty
        else { return nil }

        self.packId = packId
        self.name = name
        // JSON numbers decode as NSNumber, so accept either representation.
        self.weight = (args["weight"] as? Double) ?? (args["weight"] as? Int).map(Double.init)
        self.weightUnit = (args["weightUnit"] as? String).flatMap { WeightUnit(apiValue: $0) }
        self.quantity = max(1, (args["quantity"] as? Int) ?? 1)
        self.category = Self.trimmedString(args["category"])
        self.consumable = (args["consumable"] as? Bool) ?? false
        self.worn = (args["worn"] as? Bool) ?? false
        self.notes = Self.trimmedString(args["notes"])
        self.catalogItemId = Self.trimmedString(args["catalogItemId"])
    }

    /// Models like to send `""` for "not set"; treat that as absent so an empty
    /// string never lands in the store as a category or note.
    private static func trimmedString(_ value: Any?) -> String? {
        guard let text = (value as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty
        else { return nil }
        return text
    }
}

/// What the model is told after a successful insert.
struct ChatAddItemResult: Encodable {
    let itemId: String
    let itemName: String
    let packId: String
    let packName: String
    let quantity: Int
    /// True when the item was queued locally because the device is offline. The
    /// model should still report success — the write is durable either way — but
    /// this lets it mention the pending sync.
    let pendingSync: Bool
}

/// Errors surfaced to the model as a tool failure.
enum ChatPackToolError: LocalizedError {
    case packNotFound(String)
    case invalidArguments

    var errorDescription: String? {
        switch self {
        case .packNotFound(let id):
            return "No pack with id \(id) exists on this device."
        case .invalidArguments:
            return "The tool call was missing a required field (packId and name are required)."
        }
    }
}
