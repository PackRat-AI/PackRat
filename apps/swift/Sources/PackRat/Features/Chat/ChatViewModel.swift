import Foundation
import Observation

@MainActor
@Observable
final class ChatViewModel {
    var messages: [ChatMessage] = []
    var inputText = ""
    var isStreaming = false
    var error: String?

    private let service: ChatService
    private var streamingTask: Task<Void, Never>?

    init(service: ChatService = .shared) {
        self.service = service
        messages.append(ChatMessage(
            role: .assistant,
            content: "Hi! I'm your PackRat AI assistant. I can help you plan trips, build packing lists, research gear, and answer questions about outdoor adventures. What are you working on?"
        ))
    }

    var canSend: Bool { !inputText.trimmingCharacters(in: .whitespaces).isEmpty && !isStreaming }

    func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty, !isStreaming else { return }

        inputText = ""
        error = nil
        messages.append(ChatMessage(role: .user, content: text))

        let placeholder = ChatMessage(role: .assistant, content: "")
        messages.append(placeholder)
        let placeholderId = placeholder.id

        isStreaming = true
        streamingTask = Task { @MainActor in
            defer { isStreaming = false }
            do {
                let history = Array(messages.dropLast())
                for try await chunk in await service.sendMessage(messages: history) {
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
            } catch is CancellationError {
                // User cancelled — leave the partial response in place
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
        messages.removeAll()
        messages.append(ChatMessage(
            role: .assistant,
            content: "Chat cleared. What can I help you with?"
        ))
    }

    private func appendToPlaceholder(id: UUID, text: String) {
        guard let idx = messages.firstIndex(where: { $0.id == id }) else { return }
        messages[idx].content += text
    }

    private func addToolInvocation(to messageId: UUID, invocation: ToolInvocation) {
        guard let idx = messages.firstIndex(where: { $0.id == messageId }) else { return }
        messages[idx].toolInvocations.append(invocation)
    }

    private func updateToolInput(id messageId: UUID, callId: String, data: Data) {
        guard let msgIdx = messages.firstIndex(where: { $0.id == messageId }),
              let toolIdx = messages[msgIdx].toolInvocations.firstIndex(where: { $0.id == callId })
        else { return }
        messages[msgIdx].toolInvocations[toolIdx].inputData = data
    }

    private func updateToolOutput(id messageId: UUID, callId: String, data: Data) {
        guard let msgIdx = messages.firstIndex(where: { $0.id == messageId }),
              let toolIdx = messages[msgIdx].toolInvocations.firstIndex(where: { $0.id == callId })
        else { return }
        messages[msgIdx].toolInvocations[toolIdx].outputData = data
        messages[msgIdx].toolInvocations[toolIdx].state = .complete
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
