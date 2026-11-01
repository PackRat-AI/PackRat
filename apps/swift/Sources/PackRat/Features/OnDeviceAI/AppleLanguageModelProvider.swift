#if canImport(FoundationModels)
import Foundation
import FoundationModels

/// On-device replies from the model built into Apple Intelligence.
///
/// Each reply rebuilds a session from the conversation's transcript, so the
/// provider holds no state and history edits (clearing, switching modes) need
/// no bookkeeping here.
@available(iOS 26.0, macOS 26.0, *)
struct AppleLanguageModelProvider: LocalLLMProvider {
    /// Apple's context window is 4,096 tokens shared by instructions, tool
    /// schemas, history, tool results and the reply. At ~3 characters per
    /// token this leaves room for a lookup or two and an answer.
    private static let historyCharacterBudget = 4_500

    func streamReply(
        instructions: String,
        history: [LocalLLMMessage],
        tools: [OnDeviceTool]
    ) -> AsyncThrowingStream<LocalLLMEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                guard SystemLanguageModel.default.isAvailable else {
                    continuation.finish(throwing: LocalLLMError.unavailable)
                    return
                }

                let turns = LocalLLMHistory.trimmed(history, characterBudget: Self.historyCharacterBudget)
                guard let last = turns.last, last.role == .user else {
                    continuation.finish()
                    return
                }

                let emit: @Sendable (LocalLLMEvent) -> Void = { continuation.yield($0) }
                let modelTools = tools.compactMap { FoundationModelsTool(tool: $0, emit: emit) }
                let session = LanguageModelSession(tools: modelTools, transcript: Self.transcript(
                    instructions: instructions,
                    tools: modelTools,
                    earlierTurns: turns.dropLast()
                ))

                do {
                    // Snapshots are cumulative; forward only the new suffix.
                    var emitted = ""
                    for try await snapshot in session.streamResponse(to: last.content) {
                        let text = snapshot.content
                        // After a tool call the stream opens with the literal
                        // text "null", then restarts with the real reply.
                        if emitted.isEmpty, text == "null" { continue }
                        guard text.count > emitted.count, text.hasPrefix(emitted) else {
                            emitted = text
                            continue
                        }
                        continuation.yield(.text(String(text.dropFirst(emitted.count))))
                        emitted = text
                    }
                    continuation.finish()
                } catch is CancellationError {
                    continuation.finish(throwing: CancellationError())
                } catch let error as LanguageModelSession.GenerationError {
                    continuation.finish(throwing: Self.map(error))
                } catch {
                    continuation.finish(throwing: LocalLLMError.reporting(error, model: "apple"))
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    private static func transcript(
        instructions: String,
        tools: [FoundationModelsTool],
        earlierTurns: ArraySlice<LocalLLMMessage>
    ) -> Transcript {
        var entries: [Transcript.Entry] = [
            .instructions(Transcript.Instructions(
                segments: [.text(Transcript.TextSegment(content: instructions))],
                toolDefinitions: tools.map { Transcript.ToolDefinition(tool: $0) }
            )),
        ]
        for turn in earlierTurns {
            let segments: [Transcript.Segment] = [.text(Transcript.TextSegment(content: turn.content))]
            switch turn.role {
            case .user:
                entries.append(.prompt(Transcript.Prompt(segments: segments)))
            case .assistant:
                entries.append(.response(Transcript.Response(assetIDs: [], segments: segments)))
            }
        }
        return Transcript(entries: entries)
    }

    private static func map(_ error: LanguageModelSession.GenerationError) -> LocalLLMError {
        switch error {
        case .exceededContextWindowSize:
            return .conversationTooLong
        case .guardrailViolation, .refusal:
            return .declined
        case .assetsUnavailable:
            return .unavailable
        default:
            return .reporting(error, model: "apple")
        }
    }
}

/// Adapts an `OnDeviceTool` to Foundation Models. Arguments arrive as
/// `GeneratedContent` shaped by a schema built at runtime, which keeps every
/// tool defined once, in `OnDeviceToolbox`, for both models.
@available(iOS 26.0, macOS 26.0, *)
private struct FoundationModelsTool: Tool {
    let name: String
    let description: String
    let parameters: GenerationSchema
    private let tool: OnDeviceTool
    private let emit: @Sendable (LocalLLMEvent) -> Void

    init?(tool: OnDeviceTool, emit: @escaping @Sendable (LocalLLMEvent) -> Void) {
        let properties = tool.parameters.map { parameter in
            DynamicGenerationSchema.Property(
                name: parameter.name,
                description: parameter.description,
                schema: Self.schema(for: parameter.kind),
                isOptional: !parameter.isRequired
            )
        }
        let root = DynamicGenerationSchema(name: tool.name, properties: properties)
        guard let schema = try? GenerationSchema(root: root, dependencies: []) else { return nil }

        self.name = tool.name
        self.description = tool.description
        self.parameters = schema
        self.tool = tool
        self.emit = emit
    }

    func call(arguments: GeneratedContent) async throws -> String {
        await tool.invoke(argumentsJSON: arguments.jsonString, emit: emit)
    }

    private static func schema(for kind: OnDeviceTool.Parameter.Kind) -> DynamicGenerationSchema {
        switch kind {
        case .string: DynamicGenerationSchema(type: String.self)
        case .integer: DynamicGenerationSchema(type: Int.self)
        case .number: DynamicGenerationSchema(type: Double.self)
        case .boolean: DynamicGenerationSchema(type: Bool.self)
        }
    }
}
#endif
