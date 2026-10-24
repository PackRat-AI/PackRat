import Foundation

/// The AI SDK emits one JSON payload per SSE data line, followed by [DONE].
/// Keep this independent of URLSession so framing and EOF can be tested directly.
struct ChatStreamParser {
    private(set) var isDone = false

    mutating func payload(for line: String) -> String? {
        guard !isDone, line.hasPrefix("data:") else { return nil }
        var payload = String(line.dropFirst(5))
        if payload.hasPrefix(" ") { payload.removeFirst() }
        if payload == "[DONE]" {
            isDone = true
            return nil
        }
        return payload
    }

    func validateCompletion() throws {
        guard isDone else { throw ChatStreamError.interrupted }
    }
}

enum ChatStreamError: LocalizedError {
    case server(String)
    case invalidResponse
    case interrupted
    case emptyResponse
    case toolLimit

    var errorDescription: String? {
        switch self {
        case .server(let message): return message
        case .invalidResponse: return "Could not read the chat response. Please try again."
        case .interrupted: return "The chat response was interrupted. Please try again."
        case .emptyResponse: return "Chat returned no response. Please try again."
        case .toolLimit: return "Chat could not finish the request. Please try again."
        }
    }
}
