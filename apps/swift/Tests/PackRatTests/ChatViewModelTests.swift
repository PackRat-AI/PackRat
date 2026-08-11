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

@Suite("ChatViewModel item context")
@MainActor
struct ChatItemContextViewModelTests {
    @Test("item context opens with a greeting naming the item")
    func itemContextGreetsWithItemName() {
        let viewModel = ChatViewModel(
            service: MockChatService(chunks: []),
            context: .item(id: "item-1", name: "Down Quilt")
        )

        #expect(viewModel.messages.count == 1)
        #expect(viewModel.messages.first?.role == .assistant)
        #expect(viewModel.messages.first?.content == "I see you're looking at Down Quilt. What would you like to know about it?")
    }

    @Test("sendMessage forwards the item context to the service")
    func sendMessageForwardsItemContext() async throws {
        let service = MockChatService(chunks: [
            #"{"type":"text-delta","id":"msg_1","delta":"Lighter options exist."}"#,
        ])
        let viewModel = ChatViewModel(
            service: service,
            context: .item(id: "item-42", name: "Down Quilt")
        )

        viewModel.inputText = "How can I cut weight?"
        viewModel.sendMessage()

        try await waitUntil { !viewModel.isStreaming }

        #expect(service.recorder.context?.itemId == "item-42")
        #expect(service.recorder.context?.contextType == "item")
    }

    @Test("first message is primed with item details, later messages are not")
    func firstMessageCarriesItemDetails() async throws {
        let service = MockChatService(chunks: [
            #"{"type":"text-delta","id":"m","delta":"ok"}"#,
        ])
        let viewModel = ChatViewModel(
            service: service,
            context: .item(id: "i", name: "Down Quilt", details: "- Name: Down Quilt\n- Weight: 700 g")
        )

        viewModel.inputText = "How can I cut weight?"
        viewModel.sendMessage()
        try await waitUntil { !viewModel.isStreaming }

        // The visible bubble stays exactly what the user typed…
        let firstUserBubble = try #require(viewModel.messages.first { $0.role == .user })
        #expect(firstUserBubble.content == "How can I cut weight?")

        // …while the wire copy carries the details the tool would have returned.
        let firstSent = try #require(service.recorder.lastMessages?.last)
        #expect(firstSent.content.contains("- Weight: 700 g"))
        #expect(firstSent.content.contains("How can I cut weight?"))

        viewModel.inputText = "And the quilt?"
        viewModel.sendMessage()
        try await waitUntil { !viewModel.isStreaming }

        // Second turn is sent verbatim — details are already in the history.
        let secondSent = try #require(service.recorder.lastMessages?.last)
        #expect(secondSent.content == "And the quilt?")
    }

    @Test("a URLSession cancellation keeps the user's message and shows no error")
    func urlCancellationIsNotAFailure() async throws {
        // URLSession reports cancellation as NSURLErrorCancelled, not
        // CancellationError. Treating it as a failure used to delete the
        // message the user had just sent.
        let service = MockChatService(
            chunks: [],
            error: URLError(.cancelled)
        )
        let viewModel = ChatViewModel(
            service: service,
            context: .item(id: "i", name: "Down Quilt")
        )

        viewModel.inputText = "How can I cut weight?"
        viewModel.sendMessage()
        try await waitUntil { !viewModel.isStreaming }

        #expect(viewModel.error == nil)
        #expect(viewModel.messages.contains { $0.role == .user && $0.content == "How can I cut weight?" })
    }

    @Test("general context sends the message unchanged")
    func generalContextSendsVerbatim() async throws {
        let service = MockChatService(chunks: [
            #"{"type":"text-delta","id":"m","delta":"ok"}"#,
        ])
        let viewModel = ChatViewModel(service: service)

        viewModel.inputText = "Hello there"
        viewModel.sendMessage()
        try await waitUntil { !viewModel.isStreaming }

        let sent = try #require(service.recorder.lastMessages?.last)
        #expect(sent.content == "Hello there")
    }

    @Test("clearHistory restores the item greeting rather than a general one")
    func clearHistoryKeepsItemScope() {
        let viewModel = ChatViewModel(
            service: MockChatService(chunks: []),
            context: .item(id: "item-1", name: "Down Quilt")
        )
        viewModel.messages.append(ChatMessage(role: .user, content: "Hi"))

        viewModel.clearHistory()

        #expect(viewModel.messages.count == 1)
        #expect(viewModel.messages.first?.content.contains("Down Quilt") == true)
    }

    @Test("general context keeps the existing generic greeting")
    func generalContextUnchanged() {
        let viewModel = ChatViewModel(service: MockChatService(chunks: []))

        #expect(viewModel.context == .general)
        #expect(viewModel.messages.first?.content.hasPrefix("Hi! I'm your PackRat AI assistant") == true)
    }
}

@Suite("ChatContext wire encoding")
struct ChatContextEncodingTests {
    private func encodedRequest(context: ChatContext) throws -> [String: Any] {
        let request = ChatRequest(
            messages: [ChatMessage(role: .user, content: "Hello")],
            context: context
        )
        let data = try JSONEncoder().encode(request)
        let object = try JSONSerialization.jsonObject(with: data)
        return try #require(object as? [String: Any])
    }

    @Test("item context encodes contextType and itemId for the API")
    func itemContextEncodesItemId() throws {
        let json = try encodedRequest(context: .item(id: "item-7", name: "Down Quilt"))

        #expect(json["contextType"] as? String == "item")
        #expect(json["itemId"] as? String == "item-7")
        #expect(json["packId"] == nil)
    }

    @Test("pack context encodes contextType and packId for the API")
    func packContextEncodesPackId() throws {
        let json = try encodedRequest(context: .pack(id: "pack-3", name: "Summer Kit"))

        #expect(json["contextType"] as? String == "pack")
        #expect(json["packId"] as? String == "pack-3")
        #expect(json["itemId"] == nil)
    }

    @Test("general context sends no item or pack id")
    func generalContextSendsNoIds() throws {
        let json = try encodedRequest(context: .general)

        #expect(json["contextType"] as? String == "general")
        #expect(json["itemId"] == nil)
        #expect(json["packId"] == nil)
    }

    @Test("item suggestions name the item so the chips read naturally")
    func itemSuggestionsNameTheItem() {
        let suggestions = ChatContext.item(id: "i", name: "Down Quilt").suggestions

        #expect(!suggestions.isEmpty)
        #expect(suggestions.allSatisfy { !$0.0.isEmpty })
        #expect(suggestions.contains { $0.1.contains("Down Quilt") })
    }
}

private enum MockChatError: LocalizedError {
    case streamFailed

    var errorDescription: String? {
        "Mock stream failed"
    }
}

/// Records the context of the last call so tests can assert that the item
/// scope actually reaches the service rather than only affecting the UI.
private final class RecordedContext: @unchecked Sendable {
    private let lock = NSLock()
    private var value: ChatContext?
    private var sentMessages: [ChatMessage]?

    var context: ChatContext? {
        lock.lock()
        defer { lock.unlock() }
        return value
    }

    /// The message history handed to the service on the most recent call —
    /// this is the wire copy, which may differ from what the UI displays.
    var lastMessages: [ChatMessage]? {
        lock.lock()
        defer { lock.unlock() }
        return sentMessages
    }

    func record(_ context: ChatContext, messages: [ChatMessage]) {
        lock.lock()
        value = context
        sentMessages = messages
        lock.unlock()
    }
}

private struct MockChatService: ChatServicing {
    let chunks: [String]
    let error: (any Error)?
    let recorder = RecordedContext()

    init(chunks: [String], error: (any Error)? = nil) {
        self.chunks = chunks
        self.error = error
    }

    func sendMessage(messages: [ChatMessage], context: ChatContext) async -> AsyncThrowingStream<String, Error> {
        recorder.record(context, messages: messages)
        return AsyncThrowingStream { continuation in
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
