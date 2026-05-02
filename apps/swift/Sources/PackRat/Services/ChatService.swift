import Foundation

final class ChatService: Sendable {
    static let shared = ChatService()
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    func sendMessage(messages: [ChatMessage]) async -> AsyncThrowingStream<String, Error> {
        let body = ChatRequest(
            messages: messages.map { ChatMessageRequest(role: $0.role.rawValue, content: $0.content) }
        )
        let endpoint = Endpoint(.post, "/api/chat", body: body)
        return await api.stream(endpoint)
    }
}
