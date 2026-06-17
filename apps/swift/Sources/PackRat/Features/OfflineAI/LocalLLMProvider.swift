import Foundation

// MARK: - Context types
//
// Mirror of `apps/expo/features/offline-ai/lib/MockLLMProvider.ts` so the
// Swift and TypeScript on-device LLM seams share a contract. Anything we add
// here should be reflected on the JS side (and vice-versa) until product
// decides the two surfaces diverge.

public struct TrailContext: Sendable, Equatable {
    public let name: String
    public let difficulty: String?
    public let length: Double?

    public init(name: String, difficulty: String? = nil, length: Double? = nil) {
        self.name = name
        self.difficulty = difficulty
        self.length = length
    }
}

public struct WeatherContext: Sendable, Equatable {
    public let temperature: Double
    public let conditions: String

    public init(temperature: Double, conditions: String) {
        self.temperature = temperature
        self.conditions = conditions
    }
}

public struct LLMContext: Sendable, Equatable {
    public var trail: TrailContext?
    public var activity: String?
    public var weather: WeatherContext?

    public init(trail: TrailContext? = nil, activity: String? = nil, weather: WeatherContext? = nil) {
        self.trail = trail
        self.activity = activity
        self.weather = weather
    }
}

public struct GenerateOptions: Sendable, Equatable {
    public var context: LLMContext?
    /// Accepted by the interface for real LLM providers; not necessarily applied by mocks.
    public var systemPrompt: String?

    public init(context: LLMContext? = nil, systemPrompt: String? = nil) {
        self.context = context
        self.systemPrompt = systemPrompt
    }
}

// MARK: - Errors

public enum LocalLLMError: Error, Equatable {
    /// The provider is not yet implemented. Used by `MLXLocalLLMProvider` until
    /// the real MLX integration ships.
    case notImplemented(String)
    /// The model failed to load into memory.
    case modelLoadFailed(String)
    /// Generation failed mid-stream. The associated message comes from the underlying engine.
    case generationFailed(String)
}

// MARK: - Provider protocol

/// Abstraction over an on-device LLM. Mirrors the JS-side `MockLLMProvider`
/// contract so callers (view models, tests) can swap implementations without
/// touching the UI.
///
/// Implementations are expected to be safe to call from any actor; callers may
/// hop to the main actor before mutating UI state.
public protocol LocalLLMProvider: Sendable {
    /// Whether the model has been loaded into memory and is ready to generate.
    var isReady: Bool { get }

    /// Load the model into memory. Cheap if already warm. May allocate
    /// significant RAM in real implementations (GB-scale for 7B Q4 models),
    /// so callers should typically await this off the main actor.
    func warmUp() async throws

    /// Generate a single completion synchronously (no streaming).
    func generate(prompt: String, options: GenerateOptions?) async throws -> String

    /// Generate a streaming completion. Each yielded element is a token or
    /// short text chunk. The stream terminates when generation is complete or
    /// the underlying task is cancelled.
    func generateStream(prompt: String, options: GenerateOptions?) -> AsyncThrowingStream<String, Error>
}
