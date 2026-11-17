import Foundation

/// Answers the chat tools that read and write the user's own packs, from the
/// device's local store.
///
/// Cloud chat streams these calls to the app to answer; on-device chat calls
/// them directly. Both go through here, so a pack lookup or an added item
/// behaves the same whichever model asked.
@MainActor
struct ChatLocalTools {
    let context: ChatContext
    let packTools: (any ChatPackToolHandling)?

    /// The tool's result as a JSON object: `success`, then `data` or `error`.
    func output(toolName: String, arguments: [String: Any]) async -> [String: Any] {
        switch toolName {
        case "listUserPacks":
            return listPacksOutput(arguments: arguments)
        case "addItemToPack":
            return await addItemOutput(arguments: arguments)
        default:
            return packDetailsOutput(toolName: toolName, arguments: arguments)
        }
    }

    private func listPacksOutput(arguments: [String: Any]) -> [String: Any] {
        guard let packTools else { return Self.failure("Pack list is unavailable on this device.") }

        let summaries = packTools.listPacks(nameQuery: arguments["nameQuery"] as? String)
        // Hand back JSON rather than the Swift values so the model receives the
        // same field names the tool's schema advertises.
        guard let encoded = try? JSONEncoder().encode(summaries),
              let decoded = try? JSONSerialization.jsonObject(with: encoded)
        else { return Self.failure("Could not read the pack list.") }

        return ["success": true, "data": decoded]
    }

    private func addItemOutput(arguments: [String: Any]) async -> [String: Any] {
        guard let packTools else { return Self.failure("Adding items is unavailable on this device.") }
        guard let request = ChatAddItemRequest(toolArguments: arguments) else {
            return Self.failure(ChatPackToolError.invalidArguments.localizedDescription)
        }

        do {
            let result = try await packTools.addItem(request)
            guard let encoded = try? JSONEncoder().encode(result),
                  let decoded = try? JSONSerialization.jsonObject(with: encoded)
            else { return ["success": true] }
            return ["success": true, "data": decoded]
        } catch {
            return Self.failure(error.localizedDescription)
        }
    }

    /// `getPackDetails` / `getPackItemDetails`.
    ///
    /// Answers for the id the model actually asked about. The conversation's
    /// scoped payload is used only when it *is* that pack — a pack-scoped chat
    /// asked about a different pack would otherwise be handed the scoped pack's
    /// contents under the other pack's name, which is worse than a miss.
    ///
    /// Falling back to a local lookup is what fixed the general chat insisting an
    /// existing pack could not be found.
    private func packDetailsOutput(toolName: String, arguments: [String: Any]) -> [String: Any] {
        guard toolName == "getPackDetails" else {
            // Item details are only ever answered from the scoped context.
            guard let payload = context.toolPayload else { return Self.failure("Item not found") }
            return ["success": true, "data": payload]
        }

        let requestedId = (arguments["packId"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)

        // No id given: the scoped pack is the only thing it could mean.
        guard let requestedId, !requestedId.isEmpty else {
            guard let payload = context.toolPayload else { return Self.failure("Pack not found") }
            return ["success": true, "data": payload]
        }

        if requestedId == context.packId, let payload = context.toolPayload {
            return ["success": true, "data": payload]
        }

        guard let payload = packTools?.packDetails(id: requestedId) else {
            return Self.failure("Pack not found")
        }
        return ["success": true, "data": payload]
    }

    private static func failure(_ message: String) -> [String: Any] {
        ["success": false, "error": message]
    }
}
