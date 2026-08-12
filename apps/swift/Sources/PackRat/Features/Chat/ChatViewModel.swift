import Foundation
import Observation

@MainActor
@Observable
final class ChatViewModel {
    var messages: [ChatMessage] = []
    var inputText = ""
    var isStreaming = false
    var error: String?

    /// What this conversation is scoped to. Sent on every request so the server
    /// can attach pack context to the system prompt.
    let context: ChatContext

    private let service: any ChatServicing
    private var streamingTask: Task<Void, Never>?

    /// Backs the pack tools with the device's local store.
    ///
    /// Optional so a chat can be constructed without pack access (previews,
    /// tests, an item-scoped chat); those calls then report the tool as
    /// unavailable rather than answering wrongly.
    private let packTools: (any ChatPackToolHandling)?

    init(
        service: any ChatServicing = ChatService.shared,
        context: ChatContext = .general,
        packTools: (any ChatPackToolHandling)? = nil
    ) {
        self.service = service
        self.context = context
        self.packTools = packTools
        messages.append(ChatMessage(role: .assistant, content: context.greeting))
    }

    var canSend: Bool { !inputText.trimmingCharacters(in: .whitespaces).isEmpty && !isStreaming }

    func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty, !isStreaming else { return }

        inputText = ""
        error = nil

        // The bubble shows exactly what was typed; the wire copy of the first
        // message additionally carries the item's own details, which usually
        // saves a `getPackItemDetails` round trip.
        let isFirstUserMessage = !messages.contains { $0.role == .user }
        let sentText = isFirstUserMessage ? context.primedFirstMessage(text) : text

        messages.append(ChatMessage(role: .user, content: text))

        let placeholder = ChatMessage(role: .assistant, content: "")
        messages.append(placeholder)
        let placeholderId = placeholder.id

        isStreaming = true
        streamingTask = Task { @MainActor in
            defer { isStreaming = false }
            do {
                var history = Array(messages.dropLast())
                if sentText != text, let lastIdx = history.indices.last {
                    history[lastIdx].content = sentText
                }

                // A turn can end waiting on a client-executed tool. Answer it and
                // resume, bounded so a misbehaving model can't loop forever.
                for _ in 0..<Self.maxToolRoundTrips {
                    try await streamTurn(history: history, placeholderId: placeholderId)

                    guard let pending = pendingClientToolCall(in: placeholderId) else { break }
                    await answerClientTool(pending, in: placeholderId)

                    guard let assistant = messages.first(where: { $0.id == placeholderId }) else { break }
                    history.append(assistant)
                    clearPlaceholderToolState(placeholderId)
                }
            } catch is CancellationError {
                // User cancelled — leave the partial response in place
            } catch let urlError as URLError where urlError.code == .cancelled {
                // URLSession reports cancellation as NSURLErrorCancelled (-999),
                // not CancellationError, so it needs its own arm. Without it a
                // cancelled request looks like a failure and wipes the message
                // the user just sent.
            } catch {
                self.error = error.localizedDescription
                messages.removeAll { $0.id == placeholderId }
            }
        }
    }

    func cancelStreaming() {
        streamingTask?.cancel()
        streamingTask = nil
        isStreaming = false
    }

    func clearHistory() {
        cancelStreaming()
        error = nil
        messages.removeAll()
        // Re-seed with the scoped greeting so a cleared pack or item chat still
        // reads as being about that pack or item.
        messages.append(ChatMessage(
            role: .assistant,
            content: context == .general
                ? "Chat cleared. What can I help you with?"
                : context.greeting
        ))
    }

    /// Client-executed tools: declared server-side with no `execute`, so the
    /// model blocks until the client sends the result back.
    ///
    /// Every tool that touches the user's own packs is answered here rather than
    /// on the server, so reads reflect the local store the user is looking at and
    /// writes land in it immediately instead of only in Postgres.
    /// See `packages/api/src/utils/ai/tools.ts`.
    private static let clientExecutedTools: Set<String> = [
        "getPackItemDetails",
        "getPackDetails",
        "listUserPacks",
        "addItemToPack",
    ]
    /// One extra round trip over the previous limit: resolving a pack by name and
    /// then adding to it is legitimately two tool calls before the model speaks.
    private static let maxToolRoundTrips = 4

    /// Streams one turn into the placeholder message.
    private func streamTurn(history: [ChatMessage], placeholderId: UUID) async throws {
        for try await chunk in await service.sendMessage(messages: history, context: context) {
            guard let data = chunk.data(using: .utf8),
                  let parsed = try? JSONDecoder().decode(UIStreamChunk.self, from: data)
            else { continue }

            switch parsed.type {
            case "text-delta":
                if let delta = parsed.delta {
                    appendToPlaceholder(id: placeholderId, text: delta)
                }
            case "tool-input-start":
                if let callId = parsed.toolCallId, let name = parsed.toolName {
                    addToolInvocation(to: placeholderId, invocation: ToolInvocation(toolCallId: callId, toolName: name))
                }
            case "tool-input-available":
                if let callId = parsed.toolCallId, let inputData = parsed.rawInputData {
                    updateToolInput(id: placeholderId, callId: callId, data: inputData)
                }
            case "tool-output-available":
                if let callId = parsed.toolCallId, let outputData = parsed.rawOutputData {
                    updateToolOutput(id: placeholderId, callId: callId, data: outputData)
                }
            default:
                break
            }
        }
    }

    /// A tool the server expects *us* to execute, still awaiting its result.
    private func pendingClientToolCall(in placeholderId: UUID) -> ToolInvocation? {
        messages.first { $0.id == placeholderId }?
            .toolInvocations
            .first { $0.state == .running && Self.clientExecutedTools.contains($0.toolName) }
    }

    /// Fills in a client-executed tool's result from local data.
    private func answerClientTool(_ invocation: ToolInvocation, in placeholderId: UUID) async {
        guard Self.clientExecutedTools.contains(invocation.toolName) else { return }

        let output: [String: Any]
        switch invocation.toolName {
        case "listUserPacks":
            output = listPacksOutput(for: invocation)
        case "addItemToPack":
            output = await addItemOutput(for: invocation)
        default:
            output = packDetailsOutput(for: invocation)
        }

        let data = (try? JSONSerialization.data(withJSONObject: output)) ?? Data("{}".utf8)
        updateToolOutput(id: placeholderId, callId: invocation.id, data: data)
    }

    private func listPacksOutput(for invocation: ToolInvocation) -> [String: Any] {
        guard let packTools else { return Self.failure("Pack list is unavailable on this device.") }

        let summaries = packTools.listPacks(nameQuery: toolArguments(invocation)["nameQuery"] as? String)
        // Hand back JSON rather than the Swift values so the model receives the
        // same field names the tool's schema advertises.
        guard let encoded = try? JSONEncoder().encode(summaries),
              let decoded = try? JSONSerialization.jsonObject(with: encoded)
        else { return Self.failure("Could not read the pack list.") }

        return ["success": true, "data": decoded]
    }

    private func addItemOutput(for invocation: ToolInvocation) async -> [String: Any] {
        guard let packTools else { return Self.failure("Adding items is unavailable on this device.") }
        guard let request = ChatAddItemRequest(toolArguments: toolArguments(invocation)) else {
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
    /// Prefers the conversation's scoped payload, then falls back to the pack the
    /// model actually named. Ignoring the requested id is what made a general
    /// chat insist an existing pack could not be found.
    private func packDetailsOutput(for invocation: ToolInvocation) -> [String: Any] {
        let requested: [String: String]? = if invocation.toolName == "getPackDetails",
                                              let packTools,
                                              let packId = toolArguments(invocation)["packId"] as? String,
                                              !packId.isEmpty {
            packTools.packDetails(id: packId)
        } else {
            nil
        }

        guard let payload = context.toolPayload ?? requested else {
            return Self.failure(
                invocation.toolName == "getPackDetails" ? "Pack not found" : "Item not found"
            )
        }
        return ["success": true, "data": payload]
    }

    private func toolArguments(_ invocation: ToolInvocation) -> [String: Any] {
        guard let data = invocation.inputData,
              let args = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return [:] }
        return args
    }

    private static func failure(_ message: String) -> [String: Any] {
        ["success": false, "error": message]
    }

    /// Drops tool invocations from the live placeholder once they've been folded
    /// into the outgoing history, so the same call isn't answered twice.
    private func clearPlaceholderToolState(_ placeholderId: UUID) {
        guard let idx = messages.firstIndex(where: { $0.id == placeholderId }) else { return }
        var updated = messages[idx]
        updated.toolInvocations.removeAll()
        messages[idx] = updated
    }

    private func appendToPlaceholder(id: UUID, text: String) {
        guard let idx = messages.firstIndex(where: { $0.id == id }) else { return }
        var updated = messages[idx]
        updated.content += text
        messages[idx] = updated
    }

    private func addToolInvocation(to messageId: UUID, invocation: ToolInvocation) {
        guard let idx = messages.firstIndex(where: { $0.id == messageId }) else { return }
        var updated = messages[idx]
        updated.toolInvocations.append(invocation)
        messages[idx] = updated
    }

    private func updateToolInput(id messageId: UUID, callId: String, data: Data) {
        guard let msgIdx = messages.firstIndex(where: { $0.id == messageId }),
              let toolIdx = messages[msgIdx].toolInvocations.firstIndex(where: { $0.id == callId })
        else { return }
        var updated = messages[msgIdx]
        updated.toolInvocations[toolIdx].inputData = data
        messages[msgIdx] = updated
    }

    private func updateToolOutput(id messageId: UUID, callId: String, data: Data) {
        guard let msgIdx = messages.firstIndex(where: { $0.id == messageId }),
              let toolIdx = messages[msgIdx].toolInvocations.firstIndex(where: { $0.id == callId })
        else { return }
        var updated = messages[msgIdx]
        updated.toolInvocations[toolIdx].outputData = data
        updated.toolInvocations[toolIdx].state = .complete
        messages[msgIdx] = updated
    }
}

private struct UIStreamChunk: Decodable {
    let type: String
    let id: String?
    let delta: String?       // text-delta
    let toolCallId: String?  // tool-input-start, tool-input-available, tool-output-available
    let toolName: String?    // tool-input-start, tool-input-available
    // Store raw JSON for input/output — decoded lazily in views
    let rawInputData: Data?
    let rawOutputData: Data?

    enum CodingKeys: String, CodingKey {
        case type, id, delta, toolCallId, toolName, input, output
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        type = try c.decode(String.self, forKey: .type)
        id = try? c.decodeIfPresent(String.self, forKey: .id)
        delta = try? c.decodeIfPresent(String.self, forKey: .delta)
        toolCallId = try? c.decodeIfPresent(String.self, forKey: .toolCallId)
        toolName = try? c.decodeIfPresent(String.self, forKey: .toolName)
        // Capture input/output as raw JSON Data
        rawInputData = try? c.decodeIfPresent(JSONValue.self, forKey: .input).flatMap { try? JSONEncoder().encode($0) }
        rawOutputData = try? c.decodeIfPresent(JSONValue.self, forKey: .output).flatMap { try? JSONEncoder().encode($0) }
    }
}

// Generic JSON value for capturing arbitrary structures
indirect enum JSONValue: Codable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let single = try? decoder.singleValueContainer()
        if let v = try? single?.decode(Bool.self)   { self = .bool(v); return }
        if let v = try? single?.decode(Double.self) { self = .number(v); return }
        if let v = try? single?.decode(String.self) { self = .string(v); return }
        if var c = try? decoder.unkeyedContainer() {
            var arr: [JSONValue] = []
            while !c.isAtEnd { arr.append(try c.decode(JSONValue.self)) }
            self = .array(arr); return
        }
        if let c = try? decoder.container(keyedBy: AnyCodingKey.self) {
            var obj: [String: JSONValue] = [:]
            for k in c.allKeys { obj[k.stringValue] = try c.decode(JSONValue.self, forKey: k) }
            self = .object(obj); return
        }
        self = .null
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let v):  try c.encode(v)
        case .number(let v):  try c.encode(v)
        case .bool(let v):    try c.encode(v)
        case .null:           try c.encodeNil()
        case .array(let arr): try c.encode(arr)
        case .object(let obj):
            var kc = encoder.container(keyedBy: AnyCodingKey.self)
            for (k, v) in obj { try kc.encode(v, forKey: AnyCodingKey(k)) }
        }
    }

    var stringValue: String? { if case .string(let v) = self { return v }; return nil }
    var doubleValue: Double? { if case .number(let v) = self { return v }; return nil }
    var boolValue: Bool? { if case .bool(let v) = self { return v }; return nil }
    var objectValue: [String: JSONValue]? { if case .object(let v) = self { return v }; return nil }
    var arrayValue: [JSONValue]? { if case .array(let v) = self { return v }; return nil }
}

private struct AnyCodingKey: CodingKey {
    let stringValue: String
    var intValue: Int? { nil }
    init(_ string: String) { self.stringValue = string }
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { return nil }
}
