import Foundation

struct ChatMessage: Identifiable, Sendable {
    enum Role: String, Sendable { case user, assistant }
    let id: UUID
    let role: Role
    var content: String
    let createdAt: Date

    init(id: UUID = UUID(), role: Role, content: String) {
        self.id = id
        self.role = role
        self.content = content
        self.createdAt = Date()
    }
}

struct ChatRequest: Encodable {
    let messages: [ChatMessageRequest]
}

struct ChatMessageRequest: Encodable {
    let role: String
    let content: String
}

struct ChatStreamChunk: Decodable {
    let delta: ChatDelta?

    struct ChatDelta: Decodable {
        let content: String?
    }
}
