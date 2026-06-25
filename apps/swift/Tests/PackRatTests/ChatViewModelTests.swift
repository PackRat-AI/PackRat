import Foundation
import Testing
@testable import PackRat

@Suite("ChatViewModel streaming")
@MainActor
struct ChatStreamViewModelTests {
    @Test("sendMessage appends streamed assistant text")
    func sendMessageAppendsStreamedAssistantText() async throws {
        let service = MockChatService(chunks: [
            #"{"type":"text-start","id":"msg_1"}"#,
            #"{"type":"text-delta","id":"msg_1","delta":"Trail "}"#,
            #"{"type":"text-delta","id":"msg_1","delta":"ready"}"#,
            #"{"type":"text-end","id":"msg_1"}"#,
        ])
        let viewModel = ChatViewModel(service: service)

        viewModel.inputText = "Can you help me pack?"
        viewModel.sendMessage()

        try await waitUntil {
            !viewModel.isStreaming && viewModel.messages.last?.content == "Trail ready"
        }

        #expect(viewModel.error == nil)
        #expect(viewModel.messages.map(\.role) == [.assistant, .user, .assistant])
        #expect(viewModel.messages.last?.content == "Trail ready")
    }

    @Test("sendMessage removes placeholder and surfaces stream errors")
    func sendMessageSurfacesStreamErrors() async throws {
        let service = MockChatService(chunks: [], error: MockChatError.streamFailed)
        let viewModel = ChatViewModel(service: service)

        viewModel.inputText = "Hello"
        viewModel.sendMessage()

        try await waitUntil {
            !viewModel.isStreaming && viewModel.error != nil
        }

        #expect(viewModel.messages.map(\.role) == [.assistant, .user])
        #expect(viewModel.error?.isEmpty == false)
    }
}

private enum MockChatError: LocalizedError {
    case streamFailed

    var errorDescription: String? {
        "Mock stream failed"
    }
}

private struct MockChatService: ChatServicing {
    let chunks: [String]
    let error: (any Error)?

    init(chunks: [String], error: (any Error)? = nil) {
        self.chunks = chunks
        self.error = error
    }

    func sendMessage(messages _: [ChatMessage]) async -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            for chunk in chunks {
                continuation.yield(chunk)
            }
            if let error {
                continuation.finish(throwing: error)
            } else {
                continuation.finish()
            }
        }
    }
}

@MainActor
private func waitUntil(
    timeout: Duration = .seconds(2),
    condition: @escaping @MainActor () -> Bool
) async throws {
    let start = ContinuousClock.now
    while !condition() {
        if start.duration(to: .now) > timeout {
            Issue.record("Timed out waiting for condition")
            return
        }
        try await Task.sleep(for: .milliseconds(10))
    }
}
