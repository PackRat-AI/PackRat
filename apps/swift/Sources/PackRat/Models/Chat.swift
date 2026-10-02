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
    /// `details` carries the pack's contents for the same reason the item case
    /// does — `getPackDetails` is also client-executed.
    case pack(id: String, name: String, details: String? = nil)
    /// `name` titles the screen and phrases the suggestion chips. `details` and
    /// `fields` carry the item's own data, which is needed because
    /// `getPackItemDetails` is declared server-side *without* an `execute` — the
    /// AI SDK expects the client to answer it (see `ChatViewModel`).
    case item(id: String, name: String = "", details: String? = nil, fields: [String: String] = [:])

    var contextType: String {
        switch self {
        case .general: return "general"
        case .pack:    return "pack"
        case .item:    return "item"
        }
    }

    var packId: String? {
        if case .pack(let id, _, _) = self { return id }
        return nil
    }

    var itemId: String? {
        if case .item(let id, _, _, _) = self { return id }
        return nil
    }

    var packName: String? {
        if case .pack(_, let name, _) = self { return name }
        return nil
    }

    var itemName: String? {
        if case .item(_, let name, _, _) = self, !name.isEmpty { return name }
        return nil
    }

    /// Plain-text dump of the item's fields, prepended to the first user message
    /// so the model usually has what it needs without a tool round trip.
    var primingDetails: String? {
        switch self {
        case .general:                        return nil
        case .pack(_, _, let details):        return details
        case .item(_, _, let details, _):     return details
        }
    }

    /// Structured data used to answer a client-executed `getPackItemDetails` or
    /// `getPackDetails` call. Nil means "not found".
    var toolPayload: [String: String]? {
        switch self {
        case .general:
            return nil
        case .pack(let id, let name, let details):
            // getPackDetails is client-executed too; without the contents the
            // model answers "I couldn't retrieve your pack".
            var payload = ["id": id, "name": name]
            if let details, !details.isEmpty { payload["contents"] = details }
            return payload
        case .item(let id, let name, _, let fields):
            guard fields.isEmpty else { return fields }
            return ["id": id, "name": name]
        }
    }

    /// Builds the text sent for the first user message. Later messages go
    /// verbatim — the details are already in the history the API receives.
    func primedFirstMessage(_ userMessage: String) -> String {
        guard let primingDetails, !primingDetails.isEmpty else { return userMessage }
        return """
        \(primingDetails)

        \(userMessage)
        """
    }

    /// Opening assistant message. Mirrors `getContextualGreeting` in
    /// `packages/api/src/utils/chatContextHelpers.ts` so both clients read alike.
    var greeting: String {
        if let packName {
            return "Ask me anything about “\(packName)” — what's missing, how to cut weight, or whether it suits your trip."
        }
        if let itemName {
            return "I see you're looking at \(itemName). What would you like to know about it?"
        }
        return "Hi! I'm your PackRat AI assistant. I can help you plan trips, build packing lists, research gear, and answer questions about outdoor adventures. What are you working on?"
    }

    /// Item-scoped chips, as `(label, prompt)` pairs. Mirrors the item arm of
    /// `getContextualSuggestions` on the API side. Pack and general chips live
    /// in `ChatView`, which owns the equivalent lists for those scopes.
    var itemSuggestions: [(String, String)] {
        guard let itemName else { return [] }
        return [
            ("Tell me more", "Tell me more about \(itemName)"),
            ("Alternatives", "What are alternatives to \(itemName)?"),
            ("Cut weight", "How can I reduce the weight of my \(itemName)?"),
            ("Worth bringing?", "Is \(itemName) worth bringing on a short trip?"),
            ("How to care", "How should I care for and maintain my \(itemName)?"),
        ]
    }
}

struct ChatUIMessage: Encodable {
    let id: String
    let role: String
    let content: String
    let parts: [ChatUIPart]

    init(from msg: ChatMessage) {
        self.id = msg.id.uuidString
        self.role = msg.role.rawValue
        self.content = msg.content

        var parts: [ChatUIPart] = []
        if !msg.content.isEmpty {
            parts.append(.text(msg.content))
        }
        // Replay answered client-executed tool calls so the server can resume a
        // turn that stopped to wait on one.
        for invocation in msg.toolInvocations where invocation.state == .complete {
            parts.append(.tool(invocation))
        }
        if parts.isEmpty {
            parts.append(.text(""))
        }
        self.parts = parts
    }
}

/// One entry in a UIMessage's `parts` array. Text is `{type:"text"}`; an
/// answered tool call is `{type:"tool-<name>", state:"output-available", …}`,
/// which is the shape `convertToModelMessages` reads on the API side.
enum ChatUIPart: Encodable {
    case text(String)
    case tool(ToolInvocation)

    private enum CodingKeys: String, CodingKey {
        case type, text, toolCallId, state, input, output
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .text(let text):
            try c.encode("text", forKey: .type)
            try c.encode(text, forKey: .text)
        case .tool(let invocation):
            try c.encode("tool-\(invocation.toolName)", forKey: .type)
            try c.encode(invocation.id, forKey: .toolCallId)
            try c.encode("output-available", forKey: .state)
            try c.encode(invocation.inputJSON, forKey: .input)
            try c.encode(invocation.outputJSON, forKey: .output)
        }
    }
}

extension ToolInvocation {
    /// Decoded `input`, so it re-encodes as JSON rather than an opaque string.
    var inputJSON: JSONValue {
        inputData.flatMap { try? JSONDecoder().decode(JSONValue.self, from: $0) } ?? .object([:])
    }

    var outputJSON: JSONValue {
        outputData.flatMap { try? JSONDecoder().decode(JSONValue.self, from: $0) } ?? .null
    }
}
