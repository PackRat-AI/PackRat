import Foundation

struct ToolInvocation: Identifiable, Sendable {
    enum State: Sendable { case running, complete }
    let id: String            // toolCallId
    let toolName: String
    var inputData: Data?      // JSON-encoded args
    var outputData: Data?     // JSON-encoded result
    var state: State

    init(toolCallId: String, toolName: String) {
        self.id = toolCallId
        self.toolName = toolName
        self.inputData = nil
        self.outputData = nil
        self.state = .running
    }
}

struct ChatMessage: Identifiable, Sendable {
    enum Role: String, Sendable { case user, assistant }
    let id: UUID
    let role: Role
    var content: String
    var toolInvocations: [ToolInvocation]
    let createdAt: Date

    init(id: UUID = UUID(), role: Role, content: String) {
        self.id = id
        self.role = role
        self.content = content
        self.toolInvocations = []
        self.createdAt = Date()
    }
}

// Vercel AI SDK UIMessage format expected by the chat API
struct ChatRequest: Encodable {
    let messages: [ChatUIMessage]
    let date: String
    let contextType: String?
    let packId: String?
    let itemId: String?

    init(messages: [ChatMessage], context: ChatContext = .general) {
        self.messages = messages.map { ChatUIMessage(from: $0) }
        self.date = ISO8601DateFormatter().string(from: Date())
        self.contextType = context.contextType
        self.packId = context.packId
        self.itemId = context.itemId
    }
}

/// What the conversation is scoped to.
///
/// The server reads `contextType` + `packId` to decide whether to append the
/// "helping with a pack with ID: …, use the getPackDetails tool" instruction to
/// the system prompt (packages/api/src/routes/chat.ts). Note the chat route's
/// body schema is `z.any()` — there is no server-side validation, so a wrong or
/// missing field silently degrades to a generic chat rather than erroring.
/// Keep this field set aligned with Expo's (apps/expo/app/(app)/ai-chat.tsx).
enum ChatContext: Equatable, Sendable {
    case general
    case pack(id: String, name: String)
    case item(id: String)

    var contextType: String {
        switch self {
        case .general: return "general"
        case .pack:    return "pack"
        case .item:    return "item"
        }
    }

    var packId: String? {
        if case .pack(let id, _) = self { return id }
        return nil
    }

    var itemId: String? {
        if case .item(let id) = self { return id }
        return nil
    }

    var packName: String? {
        if case .pack(_, let name) = self { return name }
        return nil
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
