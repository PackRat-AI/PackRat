import Foundation
import OSLog
import Sentry

/// One turn of an on-device conversation.
struct LocalLLMMessage: Sendable, Equatable {
    enum Role: Sendable { case user, assistant }

    let role: Role
    let content: String
}

/// A language model that runs on this device.
///
/// Implementations are stateless per call: each reply is generated from the
/// instructions plus the full history passed in, so switching between Cloud and
/// On-device mid-conversation needs no session bookkeeping.
protocol LocalLLMProvider: Sendable {
    /// Streams the reply to the last user message in `history`: text deltas
    /// (new text, never a cumulative snapshot) and the tool calls made on the way.
    func streamReply(
        instructions: String,
        history: [LocalLLMMessage],
        tools: [OnDeviceTool]
    ) -> AsyncThrowingStream<LocalLLMEvent, Error>
}

/// What an on-device reply streams back.
enum LocalLLMEvent: Sendable, Equatable {
    case text(String)
    case toolStarted(id: String, name: String, inputJSON: String)
    case toolFinished(id: String, outputJSON: String)
}

enum LocalLLMError: LocalizedError, Equatable {
    /// The model is missing or not ready (deleted, Apple Intelligence turned off).
    case unavailable
    /// The conversation no longer fits the model's context window.
    case conversationTooLong
    /// The model declined to answer (Apple's safety guardrails).
    case declined
    /// The model failed for any other reason. The cause goes to Sentry and the
    /// log, never to the chat: raw framework text reads as jargon, and words in
    /// it ("session", "token") trip the chat's sign-in error copy.
    case generationFailed

    var errorDescription: String? {
        switch self {
        case .unavailable:
            return "On-device AI isn't ready. Switch to Cloud or set it up again."
        case .conversationTooLong:
            return "This conversation is too long for on-device AI. Clear the chat to keep going."
        case .declined:
            return "On-device AI can't help with that one. Try rephrasing, or switch to Cloud."
        case .generationFailed:
            return "On-device AI couldn't answer. Try again, or switch to Cloud."
        }
    }

    /// Records an unexpected model failure and returns the error the chat shows.
    static func reporting(_ error: Error, model: String) -> LocalLLMError {
        logger.error("\(model, privacy: .public) generation failed: \(String(describing: error), privacy: .public)")
        SentrySDK.capture(error: error) { scope in
            scope.setTag(value: "onDeviceAI", key: "feature")
            scope.setTag(value: model, key: "model")
        }
        return .generationFailed
    }

    private static let logger = Logger(subsystem: "com.packrat.app", category: "onDeviceAI")
}

enum LocalLLMHistory {
    /// Drops the oldest turns until the history fits `characterBudget`, always
    /// keeping the last message. On-device models have small context windows
    /// (Apple's is 4,096 tokens), and losing early turns beats refusing to answer.
    static func trimmed(_ history: [LocalLLMMessage], characterBudget: Int) -> [LocalLLMMessage] {
        var kept: [LocalLLMMessage] = []
        var used = 0
        for message in history.reversed() {
            used += message.content.count
            if used > characterBudget, !kept.isEmpty { break }
            kept.append(message)
        }
        // A history must open with the user, or chat templates reject it.
        while let first = kept.last, first.role != .user, kept.count > 1 {
            kept.removeLast()
        }
        return kept.reversed()
    }
}
