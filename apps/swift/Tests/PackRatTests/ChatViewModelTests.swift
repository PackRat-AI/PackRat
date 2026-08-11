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
    private func itemContext(details: String? = nil, fields: [String: String] = [:]) -> ChatContext {
        .item(id: "item-42", name: "Down Quilt", details: details, fields: fields)
    }

    @Test("item context opens with a greeting naming the item")
    func itemContextGreetsWithItemName() {
        let viewModel = ChatViewModel(service: MockChatService(chunks: []), context: itemContext())

        #expect(viewModel.messages.count == 1)
        #expect(viewModel.messages.first?.role == .assistant)
        #expect(viewModel.messages.first?.content == "I see you're looking at Down Quilt. What would you like to know about it?")
    }

    @Test("sendMessage forwards the item scoping to the transport")
    func sendMessageForwardsItemContext() async throws {
        let service = MockChatService(chunks: [#"{"type":"text-delta","id":"m","delta":"ok"}"#])
        let viewModel = ChatViewModel(service: service, context: itemContext())

        viewModel.inputText = "How can I cut weight?"
        viewModel.sendMessage()
        try await waitUntil { !viewModel.isStreaming }

        #expect(service.lastContext?.contextType == "item")
        #expect(service.lastContext?.itemId == "item-42")
        #expect(service.lastContext?.packId == nil)
    }

    @Test("first message is primed with item details, later messages are not")
    func firstMessageCarriesItemDetails() async throws {
        let service = MockChatService(chunks: [#"{"type":"text-delta","id":"m","delta":"ok"}"#])
        let viewModel = ChatViewModel(
            service: service,
            context: itemContext(details: "- Name: Down Quilt\n- Weight: 700 g")
        )

        viewModel.inputText = "How can I cut weight?"
        viewModel.sendMessage()
        try await waitUntil { !viewModel.isStreaming }

        // The visible bubble stays exactly what was typed…
        let bubble = try #require(viewModel.messages.first { $0.role == .user })
        #expect(bubble.content == "How can I cut weight?")

        // …while the wire copy carries the details the tool would have returned.
        let sent = try #require(service.lastMessages?.last)
        #expect(sent.content.contains("- Weight: 700 g"))
        #expect(sent.content.contains("How can I cut weight?"))

        viewModel.inputText = "And the quilt?"
        viewModel.sendMessage()
        try await waitUntil { !viewModel.isStreaming }

        // Second turn goes verbatim — the details are already in the history.
        let second = try #require(service.lastMessages?.last)
        #expect(second.content == "And the quilt?")
    }

    @Test("an unanswered client tool call is answered and the turn resumes")
    func clientToolCallIsAnswered() async throws {
        // getPackItemDetails has no server-side execute, so a turn that calls it
        // ends with no text. The view model must supply the result and re-send.
        let service = MockChatService(chunks: [
            #"{"type":"tool-input-start","toolCallId":"call_1","toolName":"getPackItemDetails"}"#,
            #"{"type":"tool-input-available","toolCallId":"call_1","toolName":"getPackItemDetails","input":{"itemId":"item-42"}}"#,
        ])
        let viewModel = ChatViewModel(
            service: service,
            context: itemContext(fields: ["id": "item-42", "name": "Down Quilt", "weight": "700 g"])
        )

        viewModel.inputText = "How can I cut weight?"
        viewModel.sendMessage()
        try await waitUntil { !viewModel.isStreaming }

        // The re-sent history must carry the answered call, encoded as a
        // tool-<name> part with state output-available.
        let resent = try #require(service.lastMessages)
        let assistantWithTool = resent.first { !$0.toolInvocations.isEmpty }
        let invocation = try #require(assistantWithTool?.toolInvocations.first)
        #expect(invocation.state == .complete)
        #expect(invocation.toolName == "getPackItemDetails")

        let outputData = try #require(invocation.outputData)
        let output = try #require(try JSONSerialization.jsonObject(with: outputData) as? [String: Any])
        #expect(output["success"] as? Bool == true)
        let data = try #require(output["data"] as? [String: String])
        #expect(data["weight"] == "700 g")
    }

    @Test("a URLSession cancellation keeps the user's message and shows no error")
    func urlCancellationIsNotAFailure() async throws {
        // URLSession reports cancellation as NSURLErrorCancelled, not
        // CancellationError. Treating it as a failure used to delete the message
        // the user had just sent.
        let service = MockChatService(chunks: [], error: URLError(.cancelled))
        let viewModel = ChatViewModel(service: service, context: itemContext())

        viewModel.inputText = "How can I cut weight?"
        viewModel.sendMessage()
        try await waitUntil { !viewModel.isStreaming }

        #expect(viewModel.error == nil)
        #expect(viewModel.messages.contains { $0.role == .user && $0.content == "How can I cut weight?" })
    }

    @Test("clearHistory restores the item greeting rather than a general one")
    func clearHistoryKeepsItemScope() {
        let viewModel = ChatViewModel(service: MockChatService(chunks: []), context: itemContext())
        viewModel.messages.append(ChatMessage(role: .user, content: "Hi"))

        viewModel.clearHistory()

        #expect(viewModel.messages.count == 1)
        #expect(viewModel.messages.first?.content.contains("Down Quilt") == true)
    }

    @Test("general context keeps the existing generic greeting and prompt")
    func generalContextUnchanged() async throws {
        let service = MockChatService(chunks: [#"{"type":"text-delta","id":"m","delta":"ok"}"#])
        let viewModel = ChatViewModel(service: service)

        #expect(viewModel.messages.first?.content.hasPrefix("Hi! I'm your PackRat AI assistant") == true)

        viewModel.inputText = "Hello there"
        viewModel.sendMessage()
        try await waitUntil { !viewModel.isStreaming }

        let sent = try #require(service.lastMessages?.last)
        #expect(sent.content == "Hello there")
    }
}

@Suite("ChatContext wire encoding")
struct ChatContextEncodingTests {
    private func encoded(_ context: ChatContext) throws -> [String: Any] {
        let request = ChatRequest(messages: [ChatMessage(role: .user, content: "Hello")], context: context)
        let object = try JSONSerialization.jsonObject(with: try JSONEncoder().encode(request))
        return try #require(object as? [String: Any])
    }

    @Test("item context encodes contextType and itemId for the API")
    func itemContextEncodesItemId() throws {
        let json = try encoded(.item(id: "item-7", name: "Down Quilt"))

        #expect(json["contextType"] as? String == "item")
        #expect(json["itemId"] as? String == "item-7")
        #expect(json["packId"] == nil)
    }

    @Test("pack context still encodes contextType and packId")
    func packContextEncodesPackId() throws {
        let json = try encoded(.pack(id: "pack-3", name: "Summer Kit"))

        #expect(json["contextType"] as? String == "pack")
        #expect(json["packId"] as? String == "pack-3")
        #expect(json["itemId"] == nil)
    }

    @Test("general context sends no item or pack id")
    func generalContextSendsNoIds() throws {
        let json = try encoded(.general)

        #expect(json["contextType"] as? String == "general")
        #expect(json["itemId"] == nil)
        #expect(json["packId"] == nil)
    }

    @Test("item chips name the item; pack and general scopes have none here")
    func itemSuggestionsNameTheItem() {
        let suggestions = ChatContext.item(id: "i", name: "Down Quilt").itemSuggestions

        #expect(!suggestions.isEmpty)
        #expect(suggestions.allSatisfy { !$0.0.isEmpty })
        #expect(suggestions.contains { $0.1.contains("Down Quilt") })
        #expect(ChatContext.pack(id: "p", name: "Kit").itemSuggestions.isEmpty)
        #expect(ChatContext.general.itemSuggestions.isEmpty)
    }

    @Test("pack toolPayload carries the pack contents when supplied")
    func packToolPayloadCarriesContents() {
        let withDetails = ChatContext.pack(id: "p", name: "Kit", details: "- Items:\n  - Tent, qty 1")
        #expect(withDetails.toolPayload?["contents"]?.contains("Tent") == true)
        #expect(withDetails.primingDetails?.contains("Tent") == true)

        // Without contents the payload still identifies the pack, which is what
        // development shipped — the model then says it can't retrieve it.
        let withoutDetails = ChatContext.pack(id: "p", name: "Kit")
        #expect(withoutDetails.toolPayload?["name"] == "Kit")
        #expect(withoutDetails.toolPayload?["contents"] == nil)
    }

    @Test("toolPayload supplies item fields, falling back to id and name")
    func toolPayloadShape() throws {
        let withFields = ChatContext.item(
            id: "i", name: "Down Quilt", fields: ["id": "i", "name": "Down Quilt", "weight": "700 g"]
        )
        #expect(withFields.toolPayload?["weight"] == "700 g")

        let withoutFields = ChatContext.item(id: "i", name: "Down Quilt")
        #expect(withoutFields.toolPayload?["name"] == "Down Quilt")

        #expect(ChatContext.general.toolPayload == nil)
    }
}

private enum MockChatError: LocalizedError {
    case streamFailed

    var errorDescription: String? {
        "Mock stream failed"
    }
}

private final class MockChatService: ChatServicing, @unchecked Sendable {
    let chunks: [String]
    let error: (any Error)?

    /// The context of the most recent `sendMessage` call, so tests can assert
    /// the view model forwards its pack scoping to the transport.
    private(set) var lastContext: ChatContext?

    /// The history handed to the transport on the most recent call. This is the
    /// wire copy, which can differ from what the UI displays.
    private(set) var lastMessages: [ChatMessage]?

    init(chunks: [String], error: (any Error)? = nil) {
        self.chunks = chunks
        self.error = error
    }

    func sendMessage(messages: [ChatMessage], context: ChatContext) async -> AsyncThrowingStream<String, Error> {
        lastContext = context
        lastMessages = messages
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
    // Generous, because a cold first run of the full suite can take seconds to
    // schedule these continuations; the loop exits as soon as the condition holds.
    timeout: Duration = .seconds(10),
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
