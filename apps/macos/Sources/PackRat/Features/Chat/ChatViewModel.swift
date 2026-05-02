import Foundation
import Observation

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
        streamingTask = Task {
            defer { isStreaming = false }
            do {
                for try await chunk in service.sendMessage(messages: messages.dropLast()) {
                    if let decoded = try? JSONDecoder().decode(ChatStreamChunk.self, from: Data(chunk.utf8)),
                       let delta = decoded.delta?.content
                    {
                        appendToLastMessage(id: placeholderId, text: delta)
                    } else if !chunk.hasPrefix("{") {
                        // Plain text delta
                        appendToLastMessage(id: placeholderId, text: chunk)
                    }
                }
            } catch {
                self.error = error.localizedDescription
                removeMessage(id: placeholderId)
            }
        }
    }

    func cancelStreaming() {
        streamingTask?.cancel()
        isStreaming = false
    }

    func clearHistory() {
        messages.removeAll()
        messages.append(ChatMessage(
            role: .assistant,
            content: "Chat cleared. What can I help you with?"
        ))
    }

    @MainActor
    private func appendToLastMessage(id: UUID, text: String) {
        if let idx = messages.firstIndex(where: { $0.id == id }) {
            messages[idx].content += text
        }
    }

    @MainActor
    private func removeMessage(id: UUID) {
        messages.removeAll { $0.id == id }
    }
}

private extension Array {
    func dropLast() -> [Element] {
        guard count > 1 else { return self }
        return Array(self.prefix(self.count - 1))
    }
}
