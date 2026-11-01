import Foundation
import MLXLLM
import MLXLMCommon
import Tokenizers

/// On-device replies from Qwen3, for devices without Apple Intelligence.
///
/// Reads the weights `QwenModelStore` downloaded. The model is loaded once,
/// on the first reply, and stays resident until the download is deleted.
struct QwenProvider: LocalLLMProvider {
    /// Qwen3 4B has a 256K window, but every token of history costs prefill
    /// time on a phone. ~12K characters keeps a reply starting in seconds.
    private static let historyCharacterBudget = 12_000

    let directory: URL

    func streamReply(
        instructions: String,
        history: [LocalLLMMessage],
        tools: [OnDeviceTool]
    ) -> AsyncThrowingStream<LocalLLMEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                let turns = LocalLLMHistory.trimmed(history, characterBudget: Self.historyCharacterBudget)
                guard let last = turns.last, last.role == .user else {
                    continuation.finish()
                    return
                }

                do {
                    let container = try await QwenRuntime.shared.container(at: directory)
                    let session = ChatSession(
                        container,
                        instructions: instructions,
                        history: turns.dropLast().map { turn in
                            turn.role == .user ? .user(turn.content) : .assistant(turn.content)
                        },
                        generateParameters: GenerateParameters(maxTokens: 1_024, temperature: 0.7),
                        tools: tools.map(Self.toolSpec),
                        toolDispatch: { call in
                            guard let tool = tools.first(where: { $0.name == call.function.name }) else {
                                return #"{"success":false,"error":"Unknown tool"}"#
                            }
                            let arguments = call.function.arguments.mapValues(\.anyValue)
                            let json = (try? JSONSerialization.data(withJSONObject: arguments))
                                .map { String(decoding: $0, as: UTF8.self) } ?? "{}"
                            return await tool.invoke(argumentsJSON: json) { continuation.yield($0) }
                        }
                    )
                    for try await chunk in session.streamResponse(to: last.content) {
                        continuation.yield(.text(chunk))
                    }
                    continuation.finish()
                } catch is CancellationError {
                    continuation.finish(throwing: CancellationError())
                } catch let error as LocalLLMError {
                    continuation.finish(throwing: error)
                } catch {
                    continuation.finish(throwing: LocalLLMError.reporting(error, model: "qwen"))
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}

extension QwenProvider {
    /// The OpenAI-style function schema Qwen3's chat template renders.
    static func toolSpec(_ tool: OnDeviceTool) -> ToolSpec {
        let properties: [String: any Sendable] = Dictionary(uniqueKeysWithValues: tool.parameters.map { parameter in
            let type: String = switch parameter.kind {
            case .string: "string"
            case .integer: "integer"
            case .number: "number"
            case .boolean: "boolean"
            }
            return (parameter.name, ["type": type, "description": parameter.description] as [String: any Sendable])
        })
        return [
            "type": "function",
            "function": [
                "name": tool.name,
                "description": tool.description,
                "parameters": [
                    "type": "object",
                    "properties": properties,
                    "required": tool.parameters.filter(\.isRequired).map(\.name),
                ] as [String: any Sendable],
            ] as [String: any Sendable],
        ]
    }
}

/// Holds the loaded model so it is read from disk once per launch, not per reply.
actor QwenRuntime {
    static let shared = QwenRuntime()

    private var loaded: (directory: URL, container: ModelContainer)?

    func container(at directory: URL) async throws -> ModelContainer {
        if let loaded, loaded.directory == directory { return loaded.container }
        guard QwenModelStore.isComplete(at: directory) else { throw LocalLLMError.unavailable }

        let container = try await loadModelContainer(from: directory, using: TransformersTokenizerLoader())
        loaded = (directory, container)
        return container
    }

    /// Releases the weights' memory. Called before the files are deleted.
    func unload() {
        loaded = nil
    }
}

// MARK: - Tokenizer bridge
//
// mlx-swift-lm 3.x leaves tokenizers to the app. This is the expansion of its
// `#huggingFaceTokenizerLoader()` macro, written out so the build needs no
// macro-plugin trust.

private struct TransformersTokenizerLoader: MLXLMCommon.TokenizerLoader {
    func load(from directory: URL) async throws -> any MLXLMCommon.Tokenizer {
        TransformersTokenizer(try await AutoTokenizer.from(modelFolder: directory))
    }
}

private struct TransformersTokenizer: MLXLMCommon.Tokenizer {
    private let upstream: any Tokenizers.Tokenizer

    init(_ upstream: any Tokenizers.Tokenizer) {
        self.upstream = upstream
    }

    func encode(text: String, addSpecialTokens: Bool) -> [Int] {
        upstream.encode(text: text, addSpecialTokens: addSpecialTokens)
    }

    func decode(tokenIds: [Int], skipSpecialTokens: Bool) -> String {
        upstream.decode(tokens: tokenIds, skipSpecialTokens: skipSpecialTokens)
    }

    func convertTokenToId(_ token: String) -> Int? { upstream.convertTokenToId(token) }
    func convertIdToToken(_ id: Int) -> String? { upstream.convertIdToToken(id) }

    var bosToken: String? { upstream.bosToken }
    var eosToken: String? { upstream.eosToken }
    var unknownToken: String? { upstream.unknownToken }

    func applyChatTemplate(
        messages: [[String: any Sendable]],
        tools: [[String: any Sendable]]?,
        additionalContext: [String: any Sendable]?
    ) throws -> [Int] {
        do {
            return try upstream.applyChatTemplate(
                messages: messages, tools: tools, additionalContext: additionalContext
            )
        } catch Tokenizers.TokenizerError.missingChatTemplate {
            throw MLXLMCommon.TokenizerError.missingChatTemplate
        }
    }
}
