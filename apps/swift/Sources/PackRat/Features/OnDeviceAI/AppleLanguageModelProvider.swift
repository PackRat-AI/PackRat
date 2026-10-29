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
    /// Apple's context window is 4,096 tokens shared by instructions, history
    /// and the reply; ~3 characters per token leaves room for an answer.
    private static let historyCharacterBudget = 7_000

    func streamReply(instructions: String, history: [LocalLLMMessage]) -> AsyncThrowingStream<String, Error> {
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

                let session = LanguageModelSession(transcript: Self.transcript(
                    instructions: instructions,
                    earlierTurns: turns.dropLast()
                ))

                do {
                    // Snapshots are cumulative; forward only the new suffix.
                    var emitted = ""
                    for try await snapshot in session.streamResponse(to: last.content) {
                        let text = snapshot.content
                        guard text.count > emitted.count, text.hasPrefix(emitted) else {
                            emitted = text
                            continue
                        }
                        continuation.yield(String(text.dropFirst(emitted.count)))
                        emitted = text
                    }
                    continuation.finish()
                } catch let error as LanguageModelSession.GenerationError {
                    continuation.finish(throwing: Self.map(error))
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    private static func transcript(
        instructions: String,
        earlierTurns: ArraySlice<LocalLLMMessage>
    ) -> Transcript {
        var entries: [Transcript.Entry] = [
            .instructions(Transcript.Instructions(
                segments: [.text(Transcript.TextSegment(content: instructions))],
                toolDefinitions: []
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
            return .generationFailed(error.localizedDescription)
        }
    }
}
#endif
