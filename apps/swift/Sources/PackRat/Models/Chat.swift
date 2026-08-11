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

/// Scope for a chat session. Mirrors the `contextType` / `itemId` / `packId`
/// fields the API reads in `packages/api/src/routes/chat.ts`, which steer the
/// server-side system prompt at the `getPackItemDetails` / `getPackDetails` tools.
///
/// Parity note: the Expo app sends the same context from its pack and pack-item
/// detail screens (`apps/expo/features/packs/screens/PackItemDetailScreen.tsx`).
enum ChatContext: Equatable, Sendable {
    case general
    case item(id: String, name: String, details: String? = nil, fields: [String: String] = [:])
    case pack(id: String, name: String)

    /// Structured data used to answer a client-executed `getPackItemDetails` /
    /// `getPackDetails` call. Returning nil means "not found".
    var toolPayload: [String: String]? {
        switch self {
        case .general:
            return nil
        case let .item(id, name, _, fields):
            guard !fields.isEmpty else { return ["id": id, "name": name] }
            return fields
        case let .pack(id, name):
            return ["id": id, "name": name]
        }
    }

    /// Wire value for the API's `contextType` field.
    var contextType: String {
        switch self {
        case .general: return "general"
        case .item: return "item"
        case .pack: return "pack"
        }
    }

    var itemId: String? {
        if case let .item(id, _, _, _) = self { return id }
        return nil
    }

    var packId: String? {
        if case let .pack(id, _) = self { return id }
        return nil
    }

    /// A plain-text dump of the item's fields, prepended to the first user
    /// message.
    ///
    /// Why this exists: `getPackItemDetails` is declared server-side **without
    /// an `execute`** (`packages/api/src/utils/ai/tools.ts`) — the AI SDK
    /// expects the *client* to answer it, which the Expo app does from its
    /// local store via `onToolCall`. Our stream is one-shot, so a tool call
    /// would end the turn with no text. Supplying the facts up front means the
    /// model never needs to call the tool.
    var primingDetails: String? {
        if case let .item(_, _, details, _) = self { return details }
        return nil
    }

    /// Builds the text actually sent for the user's first message in an item
    /// chat. Later messages are sent verbatim — the details are already in the
    /// history the API receives.
    func primedFirstMessage(_ userMessage: String) -> String {
        guard let primingDetails, !primingDetails.isEmpty else { return userMessage }
        return """
        \(primingDetails)

        \(userMessage)
        """
    }

    /// Opening assistant message. Matches `getContextualGreeting` in
    /// `packages/api/src/utils/chatContextHelpers.ts` so both clients read alike.
    var greeting: String {
        switch self {
        case .general:
            return "Hi! I'm your PackRat AI assistant. I can help you plan trips, build packing lists, research gear, and answer questions about outdoor adventures. What are you working on?"
        case let .item(_, name, _, _):
            return "I see you're looking at \(name). What would you like to know about it?"
        case let .pack(_, name):
            return "I see you're working with your \(name). How can I help optimize your pack?"
        }
    }

    /// Chips shown above the composer, as `(label, prompt)` pairs. The item and
    /// pack prompts mirror `getContextualSuggestions` on the API side.
    var suggestions: [(String, String)] {
        switch self {
        case .general:
            return [
                ("Ultralight tips", "What are the best ultralight backpacking tips for cutting pack weight?"),
                ("3-day hike gear", "What gear should I pack for a 3-day summer hiking trip?"),
                ("Layering advice", "Explain the layering system for outdoor clothing."),
                ("Rain prep", "How should I prepare my pack for a rainy backcountry trip?"),
                ("Essential first aid", "What first aid items are must-haves in every pack?"),
                ("Food planning", "How much food should I pack per day for a backpacking trip?"),
            ]
        case let .item(_, name, _, _):
            return [
                ("Tell me more", "Tell me more about \(name)"),
                ("Alternatives", "What are alternatives to \(name)?"),
                ("Cut weight", "How can I reduce the weight of my \(name)?"),
                ("Worth bringing?", "Is \(name) worth bringing on a short trip?"),
                ("How to care", "How should I care for and maintain my \(name)?"),
            ]
        case .pack:
            return [
                ("Weight savings", "Analyze my pack for weight savings"),
                ("What's missing", "What am I missing from my pack?"),
                ("Organize", "How can I better organize these items?"),
            ]
        }
    }
}

// Vercel AI SDK UIMessage format expected by the chat API
struct ChatRequest: Encodable {
    let messages: [ChatUIMessage]
    let date: String
    let contextType: String
    let itemId: String?
    let packId: String?

    init(messages: [ChatMessage], context: ChatContext = .general) {
        self.messages = messages.map { ChatUIMessage(from: $0) }
        self.date = ISO8601DateFormatter().string(from: Date())
        self.contextType = context.contextType
        self.itemId = context.itemId
        self.packId = context.packId
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
        // Replay answered client-side tool calls so the server can resume the
        // turn. `getPackItemDetails` has no server `execute`, so the model waits
        // on us to supply the result.
        for invocation in msg.toolInvocations where invocation.state == .complete {
            parts.append(.tool(invocation))
        }
        if parts.isEmpty {
            parts.append(.text(""))
        }
        self.parts = parts
    }
}

/// One entry in a UIMessage's `parts` array. Text parts are `{type:"text"}`;
/// an answered tool call is `{type:"tool-<name>", state:"output-available", …}`,
/// matching what `convertToModelMessages` expects on the API side.
enum ChatUIPart: Encodable {
    case text(String)
    case tool(ToolInvocation)

    private enum CodingKeys: String, CodingKey {
        case type, text, toolCallId, state, input, output
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .text(text):
            try c.encode("text", forKey: .type)
            try c.encode(text, forKey: .text)
        case let .tool(invocation):
            try c.encode("tool-\(invocation.toolName)", forKey: .type)
            try c.encode(invocation.id, forKey: .toolCallId)
            try c.encode("output-available", forKey: .state)
            try c.encode(invocation.inputJSON, forKey: .input)
            try c.encode(invocation.outputJSON, forKey: .output)
        }
    }
}

extension ToolInvocation {
    /// Decoded `input`, so it re-encodes as real JSON rather than a string.
    var inputJSON: JSONValue {
        inputData.flatMap { try? JSONDecoder().decode(JSONValue.self, from: $0) } ?? .object([:])
    }

    var outputJSON: JSONValue {
        outputData.flatMap { try? JSONDecoder().decode(JSONValue.self, from: $0) } ?? .null
    }
}
