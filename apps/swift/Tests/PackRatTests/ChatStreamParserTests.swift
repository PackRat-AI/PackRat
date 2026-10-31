import Foundation
import Testing
@testable import PackRat

@Suite("Chat SSE framing")
struct ChatStreamParserTests {
    @Test("SDK frames, comments, optional space and DONE")
    func frames() throws {
        var parser = ChatStreamParser()
        #expect(parser.payload(for: ": keepalive") == nil)
        #expect(parser.payload(for: "event: message") == nil)
        #expect(parser.payload(for: "") == nil)
        #expect(parser.payload(for: #"data: {"type":"text-delta","delta":"Hi"}"#)
            == #"{"type":"text-delta","delta":"Hi"}"#)
        #expect(parser.payload(for: #"data:{"type":"error","errorText":"Retry"}"#)
            == #"{"type":"error","errorText":"Retry"}"#)
        #expect(parser.payload(for: "data: [DONE]") == nil)
        #expect(parser.isDone)
        try parser.validateCompletion()
        #expect(parser.payload(for: "data: ignored after completion") == nil)
    }

    @Test("EOF without DONE fails even after partial content")
    func truncated() {
        var parser = ChatStreamParser()
        _ = parser.payload(for: #"data: {"type":"text-delta","delta":"Partial"}"#)
        #expect(throws: ChatStreamError.self) { try parser.validateCompletion() }
        #expect(throws: ChatStreamError.self) { try ChatStreamParser().validateCompletion() }
    }
}
