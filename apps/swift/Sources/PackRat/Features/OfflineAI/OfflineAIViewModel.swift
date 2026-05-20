import Foundation
import Observation

/// State machine for the OfflineAI debug surface.
///
/// - `idle`: no generation in flight, may have a previous response in `response`.
/// - `generating`: a `Task` is consuming the provider's stream.
/// - `error`: last attempt failed. `response` holds any partial text.
public enum OfflineAIState: Equatable, Sendable {
    case idle
    case generating
    case error(String)
}

@MainActor
@Observable
public final class OfflineAIViewModel {
    public var prompt: String = ""
    public var response: String = ""
    public var state: OfflineAIState = .idle

    private let provider: LocalLLMProvider
    private var generationTask: Task<Void, Never>?

    /// Defaults to whatever the `useRealLocalLLM` feature flag resolves to.
    /// Pass an explicit provider for tests / previews.
    public init(provider: LocalLLMProvider = LocalLLMProviderFactory.makeProvider()) {
        self.provider = provider
    }

    public var isGenerating: Bool {
        if case .generating = state { return true }
        return false
    }

    public var canSubmit: Bool {
        !prompt.trimmingCharacters(in: .whitespaces).isEmpty && !isGenerating
    }

    /// Provider-readiness signal exposed for the view. The real MLX provider
    /// can return false until `warmUp()` completes.
    public var providerIsReady: Bool { provider.isReady }

    public func submit() {
        let trimmed = prompt.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, !isGenerating else { return }

        response = ""
        state = .generating

        generationTask = Task { @MainActor [provider] in
            defer {
                if case .generating = self.state {
                    self.state = .idle
                }
            }

            do {
                for try await chunk in provider.generateStream(prompt: trimmed, options: nil) {
                    if Task.isCancelled { return }
                    self.response.append(chunk)
                }
            } catch is CancellationError {
                // Stream was cancelled; leave any partial response in place.
            } catch let error as LocalLLMError {
                self.state = .error(Self.message(for: error))
            } catch {
                self.state = .error(error.localizedDescription)
            }
        }
    }

    public func cancel() {
        generationTask?.cancel()
        generationTask = nil
        if isGenerating { state = .idle }
    }

    public func reset() {
        cancel()
        prompt = ""
        response = ""
        state = .idle
    }

    // MARK: - Helpers

    private static func message(for error: LocalLLMError) -> String {
        switch error {
        case .notImplemented(let detail):
            return "Local LLM not yet wired: \(detail)"
        case .modelLoadFailed(let detail):
            return "Failed to load model: \(detail)"
        case .generationFailed(let detail):
            return "Generation failed: \(detail)"
        }
    }
}
