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

// Vercel AI SDK UIMessage format expected by the chat API
struct ChatRequest: Encodable {
    let messages: [ChatUIMessage]
    let date: String

    init(messages: [ChatMessage]) {
        self.messages = messages.map { ChatUIMessage(from: $0) }
        self.date = ISO8601DateFormatter().string(from: Date())
    }
}

struct ChatUIMessage: Encodable {
    let id: String
    let role: String
    let content: String
    let parts: [ChatUITextPart]

    init(from msg: ChatMessage) {
        self.id = msg.id.uuidString
        self.role = msg.role.rawValue
        self.content = msg.content
        self.parts = [ChatUITextPart(text: msg.content)]
    }
}

struct ChatUITextPart: Encodable {
    let type = "text"
    let text: String
}
