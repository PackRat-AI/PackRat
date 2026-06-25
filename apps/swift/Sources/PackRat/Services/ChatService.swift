import Foundation

protocol ChatServicing: Sendable {
    func sendMessage(messages: [ChatMessage]) async -> AsyncThrowingStream<String, Error>
}

final class ChatService: ChatServicing {
    static let shared = ChatService()
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    func sendMessage(messages: [ChatMessage]) async -> AsyncThrowingStream<String, Error> {
        let endpoint = Endpoint(.post, "/api/chat", body: ChatRequest(messages: messages))
        return await api.stream(endpoint)
    }
}
