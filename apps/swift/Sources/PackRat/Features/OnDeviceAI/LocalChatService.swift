import Foundation

/// Answers the AI chat with an on-device model.
///
/// Speaks the same wire format as `ChatService` (AI SDK UI stream chunks), so
/// `ChatViewModel` parses both identically. It only ever emits text: on-device
/// replies have no tools, so the view model's tool loop ends after one turn.
struct LocalChatService: ChatServicing {
    /// Resolves the provider per message, so a model downloaded or deleted, or
    /// Apple Intelligence switched on, mid-conversation takes effect at once.
    let makeProvider: @MainActor @Sendable () -> (any LocalLLMProvider)?

    init(makeProvider: @escaping @MainActor @Sendable () -> (any LocalLLMProvider)? = {
        OnDeviceAIAvailability.current.makeProvider()
    }) {
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

        let replies = provider.streamReply(instructions: Self.instructions(for: context), history: Array(history))
        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    for try await delta in replies {
                        continuation.yield(Self.textDeltaChunk(delta))
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
            "You cannot look up the user's other packs, search the gear catalog, browse the web or fetch live weather. If a question needs that, say so briefly and suggest switching the chat to Cloud.",
        ]
        if let packName = context.packName {
            lines.append("The user is asking about their pack “\(packName)”. Its contents are in their first message.")
        } else if let itemName = context.itemName {
            lines.append("The user is asking about the gear item “\(itemName)”. Its details are in their first message.")
        }
        return lines.joined(separator: "\n")
    }

    static func textDeltaChunk(_ delta: String) -> String {
        let chunk = ["type": "text-delta", "delta": delta]
        guard let data = try? JSONSerialization.data(withJSONObject: chunk) else { return "{}" }
        return String(decoding: data, as: UTF8.self)
    }
}
