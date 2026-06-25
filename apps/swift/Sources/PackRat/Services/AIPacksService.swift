import Foundation

/// Thin wrapper around the admin-only `POST /api/packs/generate-packs` endpoint
/// that asks the API to use an LLM to synthesize a set of adventure-themed packs.
///
/// Backend route: `packages/api/src/routes/packs/index.ts → POST /generate-packs`
/// Body: `{ count: Int }`
/// Response: `Pack[]` (rows inserted by `PackService.generatePacks` server-side).
///
/// Auth is transparent — `APIClient.send` attaches the Better Auth session token
/// from the keychain. The endpoint is admin-only server-side; non-admins receive a 403.
final class AIPacksService: Sendable {
    static let shared = AIPacksService()
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    /// Ask the API to generate `count` packs. Returns the inserted packs (no items expanded server-side
    /// for this endpoint — the catalog vector search fills them, then they get persisted and returned
    /// without their nested items array). The view-model should refresh the packs list to see the items.
    func generatePacks(count: Int) async throws -> [Pack] {
        let body = GeneratePacksRequest(count: count)
        let endpoint = Endpoint(.post, "/api/packs/generate-packs", body: body)
        return try await api.send(endpoint)
    }
}

/// Wire-level request body matching the Zod schema on the API:
///     z.object({ count: z.number().int().positive().default(1) })
struct GeneratePacksRequest: Encodable, Sendable, Equatable {
    let count: Int
}
