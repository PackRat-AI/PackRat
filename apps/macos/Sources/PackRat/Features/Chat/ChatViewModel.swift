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
                // Snapshot messages excluding the empty placeholder
                let history = Array(messages.dropLast())
                for try await chunk in service.sendMessage(messages: history) {
                    if let decoded = try? JSONDecoder().decode(ChatStreamChunk.self, from: Data(chunk.utf8)),
                       let delta = decoded.delta?.content
                    {
                        appendToPlaceholder(id: placeholderId, text: delta)
                    } else if !chunk.hasPrefix("{") {
                        appendToPlaceholder(id: placeholderId, text: chunk)
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
}
