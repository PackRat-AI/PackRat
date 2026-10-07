import Foundation

/// Listens on a post's live channel and yields each time its comments change,
/// so an open comment sheet can refetch without the viewer pulling to refresh.
///
/// The server only ever says "something changed"; the refetch goes through the
/// normal comments endpoint, which applies blocks and moderation for this
/// viewer. A yield also follows every reconnect, since signals sent while the
/// socket was down are lost. Ends when the consuming task is cancelled.
enum CommentsLiveUpdates {
    /// Keeps the socket inside the session's 30 s idle timeout. The server
    /// answers "ping" without waking the room.
    static let keepaliveInterval: Duration = .seconds(20)

    /// 1 s, 2 s, 4 s … capped at 30 s.
    static func reconnectDelay(afterFailures failures: Int) -> Duration {
        .seconds(min(30, 1 << min(max(failures - 1, 0), 5)))
    }

    static func isChangeSignal(_ text: String) -> Bool {
        guard let data = text.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return false }
        return object["type"] as? String == "comments.changed"
    }

    static func changes(postId: Int, api: APIClient = .shared) -> AsyncStream<Void> {
        AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in
            let task = Task {
                var failures = 0
                var hasConnected = false
                while !Task.isCancelled {
                    let isReconnect = hasConnected
                    let opened = await listen(
                        postId: postId,
                        api: api,
                        onOpen: { if isReconnect { continuation.yield() } },
                        onChange: { continuation.yield() }
                    )
                    hasConnected = hasConnected || opened
                    if Task.isCancelled { break }
                    failures = opened ? 1 : failures + 1
                    try? await Task.sleep(for: reconnectDelay(afterFailures: failures))
                }
                continuation.finish()
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    /// One connection's lifetime. Returns whether it got as far as receiving.
    private static func listen(
        postId: Int,
        api: APIClient,
        onOpen: @Sendable () -> Void,
        onChange: @Sendable () -> Void
    ) async -> Bool {
        guard let socket = try? await api.webSocket("/api/feed/\(postId)/live") else { return false }
        socket.resume()
        // The pong is the first frame back, which proves the upgrade was accepted.
        try? await socket.send(.string("ping"))
        let keepalive = Task {
            while !Task.isCancelled {
                try? await Task.sleep(for: keepaliveInterval)
                try? await socket.send(.string("ping"))
            }
        }
        defer {
            keepalive.cancel()
            socket.cancel(with: .goingAway, reason: nil)
        }
        return await withTaskCancellationHandler {
            var opened = false
            while true {
                guard let message = try? await socket.receive() else { return opened }
                if !opened {
                    opened = true
                    onOpen()
                }
                if case .string(let text) = message, isChangeSignal(text) {
                    onChange()
                }
            }
        } onCancel: {
            socket.cancel(with: .goingAway, reason: nil)
        }
    }
}
