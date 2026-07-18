import Foundation
import Defaults
import Testing
@testable import PackRat

// MARK: - MockLocalLLMProvider

@Suite("MockLocalLLMProvider")
struct MockLocalLLMProviderTests {
    @Test("returns a basic response for simple prompts")
    func basicResponse() async throws {
        let provider = MockLocalLLMProvider()
        let response = try await provider.generate(prompt: "Hello", options: nil)
        #expect(!response.isEmpty)
    }

    @Test("includes trail name in response when trail context is provided")
    func includesTrailName() async throws {
        let provider = MockLocalLLMProvider()
        let context = LLMContext(
            trail: TrailContext(name: "Test Trail", difficulty: "moderate", length: 5.2),
            activity: "hiking"
        )
        let response = try await provider.generate(
            prompt: "What gear do I need for this trail?",
            options: GenerateOptions(context: context)
        )
        #expect(response.contains("Test Trail"))
    }

    @Test("incorporates weather context into response")
    func incorporatesWeather() async throws {
        let provider = MockLocalLLMProvider()
        let context = LLMContext(
            trail: TrailContext(name: "Mountain Loop", difficulty: "hard"),
            activity: "backpacking",
            weather: WeatherContext(temperature: 45, conditions: "rainy")
        )
        let response = try await provider.generate(
            prompt: "What should I pack?",
            options: GenerateOptions(context: context)
        )
        let lower = response.lowercased()
        #expect(lower.contains("rain") || lower.contains("wet") || lower.contains("waterproof"))
    }

    @Test("handles empty context gracefully")
    func handlesEmptyContext() async throws {
        let provider = MockLocalLLMProvider()
        let response = try await provider.generate(
            prompt: "Hello",
            options: GenerateOptions(context: nil)
        )
        #expect(!response.isEmpty)
    }

    @Test("accepts system prompt without error (not applied in mock)")
    func acceptsSystemPrompt() async throws {
        let provider = MockLocalLLMProvider()
        let response = try await provider.generate(
            prompt: "Hello",
            options: GenerateOptions(systemPrompt: "You are a helpful hiking assistant.")
        )
        #expect(!response.isEmpty)
    }

    @Test("incorporates activity context into recommendations")
    func incorporatesActivity() async throws {
        let provider = MockLocalLLMProvider()
        let context = LLMContext(
            trail: TrailContext(name: "Lakeside Camp"),
            activity: "camping"
        )
        let response = try await provider.generate(
            prompt: "What do I need?",
            options: GenerateOptions(context: context)
        )
        #expect(response.contains("Lakeside Camp"))
    }

    @Test("isReady reports true and warmUp is a no-op")
    func warmUpIsNoOp() async throws {
        let provider = MockLocalLLMProvider()
        #expect(provider.isReady)
        try await provider.warmUp()
        #expect(provider.isReady)
    }

    // MARK: - Streaming

    @Test("generateStream emits chunks that reassemble into the full response")
    func streamEmitsChunks() async throws {
        let provider = MockLocalLLMProvider(streamingDelay: .zero)
        let context = LLMContext(trail: TrailContext(name: "Stream Trail"), activity: "hiking")
        let options = GenerateOptions(context: context)

        var chunks: [String] = []
        for try await chunk in provider.generateStream(prompt: "Hi", options: options) {
            chunks.append(chunk)
        }

        #expect(chunks.count > 1, "Expected the stream to emit more than one chunk")
        let reassembled = chunks.joined()
        let oneShot = try await provider.generate(prompt: "Hi", options: options)
        #expect(reassembled == oneShot)
    }

    @Test("generateStream terminates")
    func streamTerminates() async throws {
        let provider = MockLocalLLMProvider(streamingDelay: .zero)
        var iterator = provider.generateStream(prompt: "Hi", options: nil).makeAsyncIterator()
        var consumed = 0
        while let _ = try await iterator.next() {
            consumed += 1
            if consumed > 1000 { Issue.record("Stream did not terminate"); break }
        }
        #expect(consumed > 0)
    }
}

// MARK: - MLXLocalLLMProvider stub

@Suite("MLXLocalLLMProvider")
struct MLXLocalLLMProviderTests {
    @Test("isReady is false until MLX integration lands")
    func notReadyByDefault() {
        let provider = MLXLocalLLMProvider()
        #expect(provider.isReady == false)
    }

    @Test("warmUp throws notImplemented")
    func warmUpThrowsNotImplemented() async {
        let provider = MLXLocalLLMProvider()
        await #expect(throws: LocalLLMError.self) {
            try await provider.warmUp()
        }
    }

    @Test("generate throws notImplemented")
    func generateThrowsNotImplemented() async {
        let provider = MLXLocalLLMProvider()
        await #expect(throws: LocalLLMError.self) {
            _ = try await provider.generate(prompt: "Anything", options: nil)
        }
    }

    @Test("generateStream finishes with notImplemented error")
    func streamFinishesWithError() async {
        let provider = MLXLocalLLMProvider()
        var caught: Error?
        do {
            for try await _ in provider.generateStream(prompt: "Anything", options: nil) {
                Issue.record("Stub stream should not emit chunks")
            }
        } catch {
            caught = error
        }
        #expect(caught is LocalLLMError)
        if case .notImplemented = (caught as? LocalLLMError) {
            // expected
        } else {
            Issue.record("Expected LocalLLMError.notImplemented, got \(String(describing: caught))")
        }
    }
}

// MARK: - OfflineAIViewModel

@Suite("OfflineAIViewModel")
@MainActor
struct OfflineAIViewModelTests {
    @Test("starts in idle with empty prompt and response")
    func initialState() {
        let vm = OfflineAIViewModel(provider: MockLocalLLMProvider(streamingDelay: .zero))
        #expect(vm.state == .idle)
        #expect(vm.prompt.isEmpty)
        #expect(vm.response.isEmpty)
        #expect(vm.canSubmit == false)
        #expect(vm.isGenerating == false)
    }

    @Test("canSubmit toggles with prompt content")
    func canSubmitTogglesWithPrompt() {
        let vm = OfflineAIViewModel(provider: MockLocalLLMProvider(streamingDelay: .zero))
        #expect(vm.canSubmit == false)
        vm.prompt = "   "
        #expect(vm.canSubmit == false)
        vm.prompt = "Hello"
        #expect(vm.canSubmit)
    }

    @Test("submit drives idle -> generating -> idle and populates response")
    func submitDrivesStateMachine() async throws {
        let vm = OfflineAIViewModel(provider: MockLocalLLMProvider(streamingDelay: .zero))
        vm.prompt = "Hello"
        #expect(vm.state == .idle)

        vm.submit()
        #expect(vm.state == .generating)
        #expect(vm.isGenerating)

        // Spin until the background task finishes. Bounded so a regression
        // doesn't hang CI.
        for _ in 0 ..< 200 {
            if case .idle = vm.state, !vm.response.isEmpty { break }
            try await Task.sleep(for: .milliseconds(10))
        }

        #expect(vm.state == .idle)
        #expect(!vm.response.isEmpty)
    }

    @Test("submit with MLX stub surfaces a notImplemented error")
    func mlxStubSurfacesError() async throws {
        let vm = OfflineAIViewModel(provider: MLXLocalLLMProvider())
        vm.prompt = "Hello"
        vm.submit()

        for _ in 0 ..< 200 {
            if case .error = vm.state { break }
            try await Task.sleep(for: .milliseconds(10))
        }

        if case .error(let message) = vm.state {
            #expect(message.lowercased().contains("not yet wired") || message.lowercased().contains("not implemented") || message.lowercased().contains("stub"))
        } else {
            Issue.record("Expected error state, got \(vm.state)")
        }
    }

    @Test("cancel from generating returns to idle")
    func cancelReturnsToIdle() async throws {
        // Slow streaming so we have time to cancel mid-flight.
        let vm = OfflineAIViewModel(provider: MockLocalLLMProvider(streamingDelay: .milliseconds(50)))
        vm.prompt = "Hello"
        vm.submit()
        #expect(vm.isGenerating)

        vm.cancel()
        #expect(vm.isGenerating == false)
        #expect(vm.state == .idle)
    }

    @Test("reset clears prompt, response, and state")
    func resetClears() async throws {
        let vm = OfflineAIViewModel(provider: MockLocalLLMProvider(streamingDelay: .zero))
        vm.prompt = "Hello"
        vm.submit()

        for _ in 0 ..< 200 {
            if case .idle = vm.state, !vm.response.isEmpty { break }
            try await Task.sleep(for: .milliseconds(10))
        }

        #expect(!vm.response.isEmpty)
        vm.reset()
        #expect(vm.prompt.isEmpty)
        #expect(vm.response.isEmpty)
        #expect(vm.state == .idle)
    }
}

// MARK: - LocalLLMProviderFactory

@Suite("LocalLLMProviderFactory")
@MainActor
struct LocalLLMProviderFactoryTests {
    @Test("uses mock provider even when stale MLX debug preference is enabled")
    func staleMLXPreferenceUsesMockProvider() {
        let previousValue = Defaults[.useRealLocalLLM]
        Defaults[.useRealLocalLLM] = true
        defer { Defaults[.useRealLocalLLM] = previousValue }

        let provider = LocalLLMProviderFactory.makeProvider()

        #expect(provider is MockLocalLLMProvider)
    }
}
