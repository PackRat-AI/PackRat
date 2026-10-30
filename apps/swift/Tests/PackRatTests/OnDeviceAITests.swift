import Foundation
import Testing
@testable import PackRat

@Suite("On-device AI history trimming")
struct LocalLLMHistoryTests {
    private func message(_ role: LocalLLMMessage.Role, _ length: Int) -> LocalLLMMessage {
        LocalLLMMessage(role: role, content: String(repeating: "a", count: length))
    }

    @Test("keeps the whole history when it fits")
    func keepsHistoryThatFits() {
        let history = [message(.user, 10), message(.assistant, 10), message(.user, 10)]
        #expect(LocalLLMHistory.trimmed(history, characterBudget: 100) == history)
    }

    @Test("drops the oldest turns first and still opens with the user")
    func dropsOldestTurns() {
        let history = [
            message(.user, 40), message(.assistant, 40),
            message(.user, 40), message(.assistant, 40),
            message(.user, 10),
        ]
        let trimmed = LocalLLMHistory.trimmed(history, characterBudget: 100)

        #expect(trimmed.first?.role == .user)
        #expect(trimmed.last == history.last)
        #expect(trimmed.count == 3)
    }

    @Test("keeps the last message even when it alone exceeds the budget")
    func keepsOversizedLastMessage() {
        let history = [message(.user, 10), message(.assistant, 10), message(.user, 500)]
        #expect(LocalLLMHistory.trimmed(history, characterBudget: 100) == [message(.user, 500)])
    }
}

@Suite("LocalChatService")
@MainActor
struct LocalChatServiceTests {
    @Test("wraps provider deltas as UI stream text-delta chunks")
    func wrapsDeltasAsChunks() async throws {
        let provider = ScriptedProvider(deltas: ["Pack ", "light"])
        let service = LocalChatService(makeProvider: { provider })

        var chunks: [String] = []
        for try await chunk in await service.sendMessage(
            messages: [ChatMessage(role: .user, content: "Tips?")],
            context: .general
        ) {
            chunks.append(chunk)
        }

        let decoded = try chunks.map {
            try JSONSerialization.jsonObject(with: Data($0.utf8)) as? [String: String]
        }
        #expect(decoded == [
            ["type": "text-delta", "delta": "Pack "],
            ["type": "text-delta", "delta": "light"],
        ])
    }

    @Test("drops the greeting and empty placeholders from the history it sends")
    func dropsGreetingAndPlaceholders() async throws {
        let provider = ScriptedProvider(deltas: [])
        let service = LocalChatService(makeProvider: { provider })

        for try await _ in await service.sendMessage(
            messages: [
                ChatMessage(role: .assistant, content: "Hi! I'm your PackRat AI assistant."),
                ChatMessage(role: .user, content: "First"),
                ChatMessage(role: .assistant, content: "Answer"),
                ChatMessage(role: .user, content: "Second"),
            ],
            context: .general
        ) {}

        #expect(provider.receivedHistory == [
            LocalLLMMessage(role: .user, content: "First"),
            LocalLLMMessage(role: .assistant, content: "Answer"),
            LocalLLMMessage(role: .user, content: "Second"),
        ])
    }

    @Test("fails with unavailable when no model is ready")
    func failsWhenNoModel() async {
        let service = LocalChatService(makeProvider: { nil })

        await #expect(throws: LocalLLMError.unavailable) {
            for try await _ in await service.sendMessage(
                messages: [ChatMessage(role: .user, content: "Hi")],
                context: .general
            ) {}
        }
    }

    @Test("instructions name the pack a pack-scoped chat is about")
    func instructionsNamePack() {
        let instructions = LocalChatService.instructions(for: .pack(id: "p1", name: "JMT Thru-hike"))
        #expect(instructions.contains("“JMT Thru-hike”"))
        #expect(instructions.contains("Use the tools"))
    }

    @Test("reports a tool call as the same chunks the cloud chat sends")
    func toolEventsBecomeChunks() throws {
        let started = LocalChatService.chunks(for: .toolStarted(id: "c1", name: "getWeatherForLocation", inputJSON: #"{"location":"Yosemite"}"#))
        let finished = LocalChatService.chunks(for: .toolFinished(id: "c1", outputJSON: #"{"success":true}"#))

        let decoded = try (started + finished).map {
            try #require(JSONSerialization.jsonObject(with: Data($0.utf8)) as? [String: Any])
        }
        #expect(decoded.map { $0["type"] as? String } == ["tool-input-start", "tool-input-available", "tool-output-available"])
        #expect(decoded.allSatisfy { $0["toolCallId"] as? String == "c1" })
        #expect((decoded[1]["input"] as? [String: String]) == ["location": "Yosemite"])
        #expect((decoded[2]["output"] as? [String: Bool]) == ["success": true])
    }
}

@Suite("OnDeviceTool")
struct OnDeviceToolTests {
    @Test("a call reports its start and finish with one id and returns the tool's result")
    func invokeReportsAndReturns() async throws {
        let tool = OnDeviceTool(name: "echo", description: "", parameters: []) { arguments in
            ["success": true, "data": arguments["text"] ?? ""]
        }
        let events = EventRecorder()

        let output = await tool.invoke(argumentsJSON: #"{"text":"hi"}"#) { events.append($0) }

        let result = try #require(JSONSerialization.jsonObject(with: Data(output.utf8)) as? [String: Any])
        #expect(result["data"] as? String == "hi")
        guard case .toolStarted(let startId, "echo", _) = events.all.first,
              case .toolFinished(let finishId, output) = events.all.last
        else {
            Issue.record("Unexpected events: \(events.all)")
            return
        }
        #expect(startId == finishId)
        #expect(events.all.count == 2)
    }
}

@Suite("ChatViewModel on-device mode")
@MainActor
struct ChatViewModelOnDeviceModeTests {
    @Test("on-device mode answers from the local service, not the cloud")
    func routesToOnDeviceService() async throws {
        let provider = ScriptedProvider(deltas: ["Offline ", "answer"])
        let viewModel = ChatViewModel(
            service: FailingCloudService(),
            onDeviceService: LocalChatService(makeProvider: { provider }),
            mode: .onDevice
        )

        viewModel.inputText = "What should I bring?"
        viewModel.sendMessage()
        try await waitUntil { !viewModel.isStreaming && viewModel.messages.count == 3 }

        #expect(viewModel.error == nil)
        #expect(viewModel.messages.last?.content == "Offline answer")
        #expect(provider.receivedHistory == [LocalLLMMessage(role: .user, content: "What should I bring?")])
    }

    @Test("an unavailable on-device model surfaces a readable error")
    func surfacesUnavailable() async throws {
        let viewModel = ChatViewModel(
            service: FailingCloudService(),
            onDeviceService: LocalChatService(makeProvider: { nil }),
            mode: .onDevice
        )

        viewModel.inputText = "Hello"
        viewModel.sendMessage()
        try await waitUntil { !viewModel.isStreaming && viewModel.error != nil }

        #expect(viewModel.error == LocalLLMError.unavailable.errorDescription)
        #expect(viewModel.messages.map(\.role) == [.assistant, .user])
    }

    @Test("an on-device tool call shows as finished and is not answered again")
    func toolCallsCompleteInOneTurn() async throws {
        let provider = ScriptedProvider(events: [
            .toolStarted(id: "c1", name: "listUserPacks", inputJSON: "{}"),
            .toolFinished(id: "c1", outputJSON: #"{"success":true,"data":[]}"#),
            .text("You have no packs yet."),
        ])
        let viewModel = ChatViewModel(
            service: FailingCloudService(),
            onDeviceService: LocalChatService(makeProvider: { provider }),
            mode: .onDevice
        )

        viewModel.inputText = "What packs do I have?"
        viewModel.sendMessage()
        try await waitUntil { !viewModel.isStreaming && viewModel.messages.count == 3 }

        let reply = try #require(viewModel.messages.last)
        #expect(reply.content == "You have no packs yet.")
        #expect(reply.toolInvocations.map(\.toolName) == ["listUserPacks"])
        #expect(reply.toolInvocations.allSatisfy { $0.state == .complete })
        #expect(provider.callCount == 1)
    }

    @Test("every on-device error reads as its own message, never the sign-in prompt")
    func errorsKeepTheirOwnCopy() {
        let errors: [LocalLLMError] = [.unavailable, .conversationTooLong, .declined, .generationFailed]
        for error in errors {
            let message = error.errorDescription ?? ""
            let presentation = FriendlyErrorPresentation(message)
            #expect(presentation.inlineDescription(forRawMessage: message) == message)
        }
    }
}

// MARK: - Doubles

private final class ScriptedProvider: LocalLLMProvider, @unchecked Sendable {
    let events: [LocalLLMEvent]
    private(set) var receivedHistory: [LocalLLMMessage]?
    private(set) var callCount = 0

    init(deltas: [String]) {
        self.events = deltas.map(LocalLLMEvent.text)
    }

    init(events: [LocalLLMEvent]) {
        self.events = events
    }

    func streamReply(
        instructions _: String,
        history: [LocalLLMMessage],
        tools _: [OnDeviceTool]
    ) -> AsyncThrowingStream<LocalLLMEvent, Error> {
        receivedHistory = history
        callCount += 1
        return AsyncThrowingStream { continuation in
            for event in events { continuation.yield(event) }
            continuation.finish()
        }
    }
}

private final class EventRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var events: [LocalLLMEvent] = []

    var all: [LocalLLMEvent] { lock.withLock { events } }

    func append(_ event: LocalLLMEvent) {
        lock.withLock { events.append(event) }
    }
}

private struct FailingCloudService: ChatServicing {
    func sendMessage(messages _: [ChatMessage], context _: ChatContext) async -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { $0.finish(throwing: URLError(.notConnectedToInternet)) }
    }
}

@MainActor
private func waitUntil(
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
