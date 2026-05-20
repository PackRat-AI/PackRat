import Foundation

/// Canned-response LLM. Mirrors `apps/expo/features/offline-ai/lib/MockLLMProvider.ts`
/// so the Swift contract is testable without bundling a real model.
///
/// Used by:
/// 1. Unit tests — fast, deterministic.
/// 2. The pre-MLX UI seam — lets the OfflineAI surface render real responses
///    on production builds without shipping a large quantized model.
///
/// When the flag `FeatureFlag.useRealLocalLLM` flips true, callers swap this
/// for `MLXLocalLLMProvider`.
public final class MockLocalLLMProvider: LocalLLMProvider {
    public let isReady: Bool = true

    /// Per-chunk delay when streaming; small so unit tests stay fast but
    /// non-zero so SwiftUI Previews and the debug surface feel realistic.
    private let streamingDelay: Duration

    public init(streamingDelay: Duration = .milliseconds(20)) {
        self.streamingDelay = streamingDelay
    }

    public func warmUp() async throws {
        // No-op: the mock is always ready.
    }

    public func generate(prompt: String, options: GenerateOptions? = nil) async throws -> String {
        Self.respond(toPrompt: prompt, options: options)
    }

    public func generateStream(
        prompt: String,
        options: GenerateOptions? = nil
    ) -> AsyncThrowingStream<String, Error> {
        let response = Self.respond(toPrompt: prompt, options: options)
        let delay = streamingDelay

        return AsyncThrowingStream { continuation in
            let task = Task {
                // Split into words but keep separators so reassembly matches.
                let chunks = Self.streamingChunks(for: response)
                for chunk in chunks {
                    if Task.isCancelled {
                        continuation.finish()
                        return
                    }
                    continuation.yield(chunk)
                    try? await Task.sleep(for: delay)
                }
                continuation.finish()
            }

            continuation.onTermination = { _ in
                task.cancel()
            }
        }
    }

    // MARK: - Internals

    /// Mirrors the response logic in `MockLLMProvider.ts`. Kept as a static
    /// function so the streaming and one-shot paths share a single source of
    /// truth.
    static func respond(toPrompt _: String, options: GenerateOptions?) -> String {
        let defaultGreeting = "Hello! How can I help you with your outdoor adventure today?"

        guard let context = options?.context else {
            return defaultGreeting
        }

        var parts: [String] = []

        if let trail = context.trail {
            parts.append("For \(trail.name)")

            if let difficulty = trail.difficulty {
                parts.append(" (\(difficulty) difficulty)")
            }
            if let length = trail.length {
                parts.append(" which is \(Self.formatLength(length)) miles long")
            }
            if context.activity != nil || context.weather != nil {
                parts.append(", ")
            }
        }

        if let activity = context.activity {
            parts.append("for your \(activity) trip")

            if let weather = context.weather {
                parts.append(" ")

                let conditions = weather.conditions.lowercased()
                if conditions.contains("rain") || conditions.contains("wet") {
                    parts.append("Make sure to bring rain gear and waterproof layers!")
                } else if weather.temperature < 40 {
                    parts.append("Dress warmly with insulated layers.")
                } else if weather.temperature > 80 {
                    parts.append("Stay hydrated and wear sun protection.")
                } else {
                    parts.append("The weather looks great for outdoor activities.")
                }
            }
        } else if let weather = context.weather {
            if weather.conditions.lowercased().contains("rain") {
                parts.append("Rain gear recommended!")
            }
        }

        if parts.isEmpty {
            return defaultGreeting
        }

        return parts.joined().trimmingCharacters(in: .whitespaces)
    }

    /// Format `length` the way the JS implementation does — integer values
    /// without trailing `.0`, otherwise the natural floating-point string.
    private static func formatLength(_ length: Double) -> String {
        if length.rounded() == length {
            return String(Int(length))
        }
        return String(length)
    }

    /// Split a response into "stream-like" chunks (word + trailing space) so
    /// the streaming API has something realistic to emit. Empty strings are
    /// filtered out so the stream count is deterministic.
    static func streamingChunks(for response: String) -> [String] {
        guard !response.isEmpty else { return [] }

        var chunks: [String] = []
        var current = ""

        for char in response {
            current.append(char)
            if char == " " {
                chunks.append(current)
                current = ""
            }
        }
        if !current.isEmpty {
            chunks.append(current)
        }

        return chunks
    }
}
