import Foundation
import Testing
@testable import PackRat

/// Apple-only: URLSession.AsyncBytes is not implemented by FoundationNetworking.
/// URLProtocol intercepts every request; these tests never contact an API.
@Suite("Chat URLSession transport", .serialized)
struct ChatTransportTests {
    private func stream(_ fixture: String) async -> AsyncThrowingStream<String, Error> {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [ChatFixtureProtocol.self]
        let api = APIClient(session: URLSession(configuration: configuration))
        return await api.stream(Endpoint(.post, "/api/chat", query: ["fixture": fixture], requiresAuth: false))
    }

    @Test("HTTP error JSON keeps status and message", arguments: [401, 429, 500])
    func httpError(status: Int) async throws {
        do {
            for try await _ in await stream(String(status)) {}
            Issue.record("Expected an HTTP failure")
        } catch PackRatError.httpError(let actualStatus, let message) {
            #expect(actualStatus == status)
            #expect(message == "Synthetic error \(status)")
        }
    }

    @Test("SSE finishes at DONE and requests the correct content type")
    func success() async throws {
        var chunks: [String] = []
        for try await chunk in await stream("success") { chunks.append(chunk) }
        #expect(chunks == [#"{"type":"text-delta","delta":"Ready"}"#])
    }

    @Test("HTTP 200 in-band error reaches the view model intact")
    func inBandError() async throws {
        var chunks: [String] = []
        for try await chunk in await stream("error") { chunks.append(chunk) }
        #expect(chunks == [#"{"type":"error","errorText":"Please try again."}"#])
    }

    @Test("truncated and non-SSE responses fail", arguments: ["truncated", "html"])
    func invalidResponse(fixture: String) async throws {
        do {
            for try await _ in await stream(fixture) {}
            Issue.record("Expected a stream failure")
        } catch is ChatStreamError {
            // Must be a protocol error, not a successful empty response.
        }
    }

    @Test("consumer cancellation stops the underlying request")
    func cancellation() async throws {
        ChatFixtureProtocol.resetStopped()
        let stream = await stream("hanging")
        let consumer = Task {
            for try await _ in stream { }
        }
        // Wait until URLProtocol has opened the response, not an arbitrary sleep.
        let start = ContinuousClock.now
        while !ChatFixtureProtocol.hasStarted {
            if start.duration(to: .now) > .seconds(5) {
                consumer.cancel()
                Issue.record("Request never started")
                return
            }
            try await Task.sleep(for: .milliseconds(10))
        }
        consumer.cancel()
        _ = await consumer.result
        while !ChatFixtureProtocol.hasStopped {
            if start.duration(to: .now) > .seconds(5) {
                Issue.record("Cancelling consumer did not stop URLSession")
                return
            }
            try await Task.sleep(for: .milliseconds(10))
        }
        #expect(ChatFixtureProtocol.hasStopped)
    }
}

private final class ChatFixtureProtocol: URLProtocol, @unchecked Sendable {
    private static let lock = NSLock()
    private static var started = false
    private static var stopped = false
    static var hasStarted: Bool { lock.withLock { started } }
    static var hasStopped: Bool { lock.withLock { stopped } }
    static func resetStopped() { lock.withLock { started = false; stopped = false } }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let url = request.url else { return }
        let fixture = URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?.first(where: { $0.name == "fixture" })?.value ?? ""
        let status = Int(fixture) ?? 200
        var headers = ["Content-Type": "text/event-stream; charset=utf-8"]
        let body: String
        if status != 200 {
            headers["Content-Type"] = "application/json"
            body = "{\"error\":\"Synthetic error \(status)\"}"
        } else if fixture == "html" {
            headers["Content-Type"] = "text/html"
            body = "<html>Unexpected page</html>"
        } else if fixture == "error" {
            body = "data: {\"type\":\"error\",\"errorText\":\"Please try again.\"}\n\ndata: [DONE]\n\n"
        } else {
            body = "data: {\"type\":\"text-delta\",\"delta\":\"Ready\"}\n\n"
                + (fixture == "success" ? "data: [DONE]\n\n" : "")
        }
        #expect(request.httpMethod == "POST")
        #expect(url.path == "/api/chat")
        #expect(request.value(forHTTPHeaderField: "Accept") == "text/event-stream")
        #expect(request.value(forHTTPHeaderField: "Origin") == "packrat://")
        let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: nil, headerFields: headers)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(body.utf8))
        if fixture == "hanging" {
            Self.lock.withLock { Self.started = true }
        } else {
            client?.urlProtocolDidFinishLoading(self)
        }
    }

    override func stopLoading() {
        Self.lock.withLock { Self.stopped = true }
    }
}
