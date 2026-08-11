import Foundation

protocol ChatServicing: Sendable {
    /// Streams an assistant reply. `context` scopes the conversation server-side —
    /// see `ChatContext` and `packages/api/src/routes/chat.ts`.
    func sendMessage(messages: [ChatMessage], context: ChatContext) async -> AsyncThrowingStream<String, Error>
}

extension ChatServicing {
    func sendMessage(messages: [ChatMessage]) async -> AsyncThrowingStream<String, Error> {
        await sendMessage(messages: messages, context: .general)
    }
}

final class ChatService: ChatServicing {
    static let shared = ChatService()
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    func sendMessage(messages: [ChatMessage], context: ChatContext) async -> AsyncThrowingStream<String, Error> {
        let endpoint = Endpoint(.post, "/api/chat", body: ChatRequest(messages: messages, context: context))
        return await api.stream(endpoint)
    }
}
