import Foundation

/// Answers the AI chat with an on-device model.
///
/// Speaks the same wire format as `ChatService` (AI SDK UI stream chunks), so
/// `ChatViewModel` parses both identically. Tool calls arrive already answered
/// (the on-device model runs its tools itself), so the view model's tool loop
/// ends after one turn.
struct LocalChatService: ChatServicing {
    /// Resolves the provider per message, so a model downloaded or deleted, or
    /// Apple Intelligence switched on, mid-conversation takes effect at once.
    let makeProvider: @MainActor @Sendable () -> (any LocalLLMProvider)?
    let tools: [OnDeviceTool]

    init(
        tools: [OnDeviceTool] = [],
        makeProvider: @escaping @MainActor @Sendable () -> (any LocalLLMProvider)? = {
            OnDeviceAIAvailability.current.makeProvider()
        }
    ) {
        self.tools = tools
        self.makeProvider = makeProvider
    }

    func sendMessage(messages: [ChatMessage], context: ChatContext) async -> AsyncThrowingStream<String, Error> {
        guard let provider = await makeProvider() else {
            return AsyncThrowingStream { $0.finish(throwing: LocalLLMError.unavailable) }
        }

        // The opening greeting is UI, not conversation.
        let history = messages
            .drop { $0.role == .assistant }
            .filter { !$0.content.isEmpty }
            .map { LocalLLMMessage(role: $0.role == .user ? .user : .assistant, content: $0.content) }

        let replies = provider.streamReply(
            instructions: Self.instructions(for: context),
            history: Array(history),
            tools: tools
        )
        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    for try await event in replies {
                        for chunk in Self.chunks(for: event) {
                            continuation.yield(chunk)
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    static func instructions(for context: ChatContext) -> String {
        var lines = [
            "You are PackRat's assistant, an expert in hiking, backpacking, camping and outdoor gear.",
            "Give practical, safety-minded advice in a friendly tone. Keep answers concise and use short lists where they help.",
            "Use the tools to read and add to the user's packs, check the weather, search the PackRat gear catalog and guides, or search the web. When a tool reports no connection, say live data needs a connection and answer from what you know.",
        ]
        if let packName = context.packName {
            lines.append("The user is asking about their pack “\(packName)”. Its contents are in their first message.")
        } else if let itemName = context.itemName {
            lines.append("The user is asking about the gear item “\(itemName)”. Its details are in their first message.")
        }
        return lines.joined(separator: "\n")
    }

    /// The UI stream chunks the cloud chat sends for the same event.
    static func chunks(for event: LocalLLMEvent) -> [String] {
        switch event {
        case .text(let delta):
            return [encode(["type": "text-delta", "delta": delta])]
        case .toolStarted(let id, let name, let inputJSON):
            return [
                encode(["type": "tool-input-start", "toolCallId": id, "toolName": name]),
                encode(["type": "tool-input-available", "toolCallId": id, "toolName": name, "input": jsonObject(inputJSON)]),
            ]
        case .toolFinished(let id, let outputJSON):
            return [encode(["type": "tool-output-available", "toolCallId": id, "output": jsonObject(outputJSON)])]
        }
    }

    private static func jsonObject(_ json: String) -> Any {
        (try? JSONSerialization.jsonObject(with: Data(json.utf8))) ?? [String: Any]()
    }

    private static func encode(_ chunk: [String: Any]) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: chunk) else { return "{}" }
        return String(decoding: data, as: UTF8.self)
    }
}
