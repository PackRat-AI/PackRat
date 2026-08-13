import Foundation
import Testing
@testable import PackRat

// Tools that touch the user's own packs are declared server-side with no
// `execute`, so the model's call is answered here on the device. These tests
// drive the real dispatch in `ChatViewModel` and the real `LocalChatPackTools`,
// rather than a stand-in, because the whole point of the client-side placement
// is that the local store is what answers.

@Suite("ChatAddItemRequest decoding")
struct ChatAddItemRequestTests {
    @Test("decodes a full tool call")
    func decodesFullCall() throws {
        let request = try #require(ChatAddItemRequest(toolArguments: [
            "packId": "pack-1",
            "name": "Merino T-Shirt",
            "weight": 150.0,
            "weightUnit": "g",
            "quantity": 3,
            "category": "clothing",
            "consumable": false,
            "worn": true,
            "notes": "base layer",
            "catalogItemId": "4242",
        ]))

        #expect(request.packId == "pack-1")
        #expect(request.name == "Merino T-Shirt")
        #expect(request.weight == 150.0)
        #expect(request.weightUnit == .g)
        #expect(request.quantity == 3)
        #expect(request.category == "clothing")
        #expect(request.worn)
        #expect(!request.consumable)
        #expect(request.notes == "base layer")
        #expect(request.catalogItemId == "4242")
    }

    @Test("defaults the optional fields the schema documents")
    func appliesDefaults() throws {
        let request = try #require(ChatAddItemRequest(toolArguments: [
            "packId": "pack-1",
            "name": "Headtorch",
        ]))

        #expect(request.quantity == 1)
        #expect(request.weight == nil)
        #expect(request.weightUnit == nil)
        #expect(!request.consumable)
        #expect(!request.worn)
        #expect(request.category == nil)
    }

    @Test("accepts an integer weight, which JSON may deliver instead of a double")
    func acceptsIntegerWeight() throws {
        let request = try #require(ChatAddItemRequest(toolArguments: [
            "packId": "pack-1", "name": "Stove", "weight": 300,
        ]))

        #expect(request.weight == 300.0)
    }

    @Test("treats an empty string as absent rather than storing it")
    func emptyStringsBecomeNil() throws {
        let request = try #require(ChatAddItemRequest(toolArguments: [
            "packId": "pack-1", "name": "Mug", "category": "  ", "notes": "",
        ]))

        #expect(request.category == nil)
        #expect(request.notes == nil)
    }

    @Test("rejects a call with no packId or no name")
    func rejectsMissingRequiredFields() {
        #expect(ChatAddItemRequest(toolArguments: ["name": "Tent"]) == nil)
        #expect(ChatAddItemRequest(toolArguments: ["packId": "pack-1"]) == nil)
        #expect(ChatAddItemRequest(toolArguments: ["packId": "", "name": "Tent"]) == nil)
        #expect(ChatAddItemRequest(toolArguments: ["packId": "pack-1", "name": "   "]) == nil)
    }

    @Test("never lets the model add a zero or negative quantity")
    func clampsQuantity() throws {
        let zero = try #require(ChatAddItemRequest(toolArguments: [
            "packId": "p", "name": "n", "quantity": 0,
        ]))
        let negative = try #require(ChatAddItemRequest(toolArguments: [
            "packId": "p", "name": "n", "quantity": -5,
        ]))

        #expect(zero.quantity == 1)
        #expect(negative.quantity == 1)
    }
}

@Suite("LocalChatPackTools")
@MainActor
struct LocalChatPackToolsTests {
    /// A view model seeded in memory. No session token exists under test, so
    /// `PacksViewModel.addItem` takes its local path and never reaches the API.
    private func makeTools(packs: [Pack]) -> (LocalChatPackTools, PacksViewModel) {
        let viewModel = PacksViewModel()
        viewModel.packs = packs
        return (LocalChatPackTools(packsViewModel: viewModel), viewModel)
    }

    private func makePack(id: String, name: String) -> Pack {
        makeTestPack(id: id, name: name)
    }

    @Test("lists every pack when no filter is given")
    func listsAllPacks() {
        let (tools, _) = makeTools(packs: [
            makePack(id: "p1", name: "Japan Trip"),
            makePack(id: "p2", name: "Ski Week"),
        ])

        let result = tools.listPacks(nameQuery: nil)

        #expect(result.map(\.name) == ["Japan Trip", "Ski Week"])
    }

    @Test("matches a pack name case-insensitively, on a substring")
    func matchesNameLoosely() {
        let (tools, _) = makeTools(packs: [
            makePack(id: "p1", name: "Japan Trip"),
            makePack(id: "p2", name: "Ski Week"),
        ])

        // The reported bug was the assistant insisting "Japan Trip" did not
        // exist, so partial and differently-cased names both have to resolve.
        #expect(tools.listPacks(nameQuery: "japan").map(\.id) == ["p1"])
        #expect(tools.listPacks(nameQuery: "JAPAN TRIP").map(\.id) == ["p1"])
        #expect(tools.listPacks(nameQuery: "  Ski  ").map(\.id) == ["p2"])
    }

    @Test("returns nothing for a pack the user does not have")
    func returnsEmptyForUnknownName() {
        let (tools, _) = makeTools(packs: [makePack(id: "p1", name: "Japan Trip")])

        #expect(tools.listPacks(nameQuery: "Everest Basecamp").isEmpty)
    }

    @Test("treats an empty filter as no filter")
    func emptyQueryListsEverything() {
        let (tools, _) = makeTools(packs: [
            makePack(id: "p1", name: "Japan Trip"),
            makePack(id: "p2", name: "Ski Week"),
        ])

        #expect(tools.listPacks(nameQuery: "").count == 2)
        #expect(tools.listPacks(nameQuery: "   ").count == 2)
    }

    @Test("returns a pack's details by id, and nil for an unknown id")
    func returnsPackDetails() {
        let (tools, _) = makeTools(packs: [makePack(id: "p1", name: "Japan Trip")])

        let details = tools.packDetails(id: "p1")
        #expect(details?["id"] == "p1")
        #expect(details?["name"] == "Japan Trip")
        #expect(details?["contents"]?.isEmpty == false)

        #expect(tools.packDetails(id: "nope") == nil)
    }

    @Test("adds an item to the pack the model named")
    func addsItemToNamedPack() async throws {
        let (tools, viewModel) = makeTools(packs: [
            makePack(id: "p1", name: "Japan Trip"),
            makePack(id: "p2", name: "Ski Week"),
        ])
        let request = try #require(ChatAddItemRequest(toolArguments: [
            "packId": "p1", "name": "Merino T-Shirt", "weight": 150.0, "weightUnit": "g",
        ]))

        let result = try await tools.addItem(request)

        #expect(result.packId == "p1")
        #expect(result.packName == "Japan Trip")
        #expect(result.itemName == "Merino T-Shirt")
        #expect(result.quantity == 1)

        // The write has to land in the store the UI renders, not just be reported.
        let target = viewModel.packs.first { $0.id == "p1" }
        #expect(target?.activeItems.map(\.name) == ["Merino T-Shirt"])
        // And it must not touch any other pack.
        #expect(viewModel.packs.first { $0.id == "p2" }?.activeItems.isEmpty == true)
    }

    @Test("carries the weight and quantity through to the stored item")
    func storesWeightAndQuantity() async throws {
        let (tools, viewModel) = makeTools(packs: [makePack(id: "p1", name: "Japan Trip")])
        let request = try #require(ChatAddItemRequest(toolArguments: [
            "packId": "p1", "name": "Socks", "weight": 60.0, "weightUnit": "g", "quantity": 3,
        ]))

        _ = try await tools.addItem(request)

        let item = try #require(viewModel.packs.first?.activeItems.first)
        #expect(item.weight == 60.0)
        #expect(item.weightUnit == .g)
        #expect(item.quantity == 3)
    }

    @Test("refuses to write when the pack does not exist")
    func rejectsUnknownPack() async throws {
        let (tools, viewModel) = makeTools(packs: [makePack(id: "p1", name: "Japan Trip")])
        let request = try #require(ChatAddItemRequest(toolArguments: [
            "packId": "hallucinated-id", "name": "Sleeping Bag",
        ]))

        await #expect(throws: ChatPackToolError.self) {
            _ = try await tools.addItem(request)
        }

        // A guessed pack id must not silently land the item somewhere else.
        #expect(viewModel.packs.allSatisfy { $0.activeItems.isEmpty })
    }
}

@Suite("ChatViewModel client tool dispatch")
@MainActor
struct ChatClientToolDispatchTests {
    /// Streams a single tool call for `toolName`, so the view model has to answer
    /// it from the injected pack tools and send the result back.
    private func toolCallChunks(id: String, toolName: String, input: String) -> [String] {
        [
            #"{"type":"tool-input-start","toolCallId":"\#(id)","toolName":"\#(toolName)"}"#,
            #"{"type":"tool-input-available","toolCallId":"\#(id)","toolName":"\#(toolName)","input":\#(input)}"#,
        ]
    }

    private func makePack(id: String, name: String) -> Pack {
        makeTestPack(id: id, name: name)
    }

    @Test("answers listUserPacks from the local store")
    func answersListUserPacks() async throws {
        let packsViewModel = PacksViewModel()
        packsViewModel.packs = [makePack(id: "p1", name: "Japan Trip")]
        let service = MockToolChatService(chunks: toolCallChunks(
            id: "call_1", toolName: "listUserPacks", input: #"{"nameQuery":"Japan"}"#
        ))
        let viewModel = ChatViewModel(
            service: service,
            packTools: LocalChatPackTools(packsViewModel: packsViewModel)
        )

        viewModel.inputText = "What's in my Japan Trip pack?"
        viewModel.sendMessage()
        try await waitUntilIdle(viewModel)

        let output = try #require(lastToolOutput(in: service))
        #expect(output["success"] as? Bool == true)
        let data = try #require(output["data"] as? [[String: Any]])
        #expect(data.first?["name"] as? String == "Japan Trip")
    }

    @Test("addItemToPack is answered by the pack tools, not the server")
    func addItemToPackIsClientExecuted() async throws {
        // `addItemToPack` must be in the client-executed set, or the model's call
        // would be left for a server that has no tool to answer it. The write
        // itself is covered by `LocalChatPackToolsTests`; driving it through a
        // full streaming turn here would also hit `PacksViewModel.addItem`'s
        // network path whenever the host machine holds a session token.
        let packsViewModel = PacksViewModel()
        packsViewModel.packs = [makePack(id: "p1", name: "Japan Trip")]
        let tools = LocalChatPackTools(packsViewModel: packsViewModel)
        let request = try #require(ChatAddItemRequest(toolArguments: [
            "packId": "p1", "name": "Merino T-Shirt", "weight": 150.0, "weightUnit": "g",
        ]))

        let result = try await tools.addItem(request)

        #expect(result.itemName == "Merino T-Shirt")
        #expect(packsViewModel.packs.first?.activeItems.map(\.name) == ["Merino T-Shirt"])
    }

    @Test("reports a failure instead of writing when the pack is unknown")
    func reportsAddFailure() async throws {
        let packsViewModel = PacksViewModel()
        packsViewModel.packs = [makePack(id: "p1", name: "Japan Trip")]
        let service = MockToolChatService(chunks: toolCallChunks(
            id: "call_1", toolName: "addItemToPack",
            input: #"{"packId":"made-up","name":"Sleeping Bag"}"#
        ))
        let viewModel = ChatViewModel(
            service: service,
            packTools: LocalChatPackTools(packsViewModel: packsViewModel)
        )

        viewModel.inputText = "Add a sleeping bag to my Everest pack"
        viewModel.sendMessage()
        try await waitUntilIdle(viewModel)

        let output = try #require(lastToolOutput(in: service))
        #expect(output["success"] as? Bool == false)
        #expect((output["error"] as? String)?.isEmpty == false)
        #expect(packsViewModel.packs.first?.activeItems.isEmpty == true)
    }

    @Test("getPackDetails answers for the requested pack, not the scoped one")
    func doesNotLeakScopedPackForADifferentId() async throws {
        let packsViewModel = PacksViewModel()
        packsViewModel.packs = [
            makePack(id: "scoped", name: "Japan Trip"),
            makePack(id: "other", name: "Ski Week"),
        ]
        let service = MockToolChatService(chunks: toolCallChunks(
            id: "call_1", toolName: "getPackDetails", input: #"{"packId":"other"}"#
        ))
        // Scoped to one pack, but the model asks about a different one.
        let viewModel = ChatViewModel(
            service: service,
            context: .pack(id: "scoped", name: "Japan Trip", details: "Japan contents"),
            packTools: LocalChatPackTools(packsViewModel: packsViewModel)
        )

        viewModel.inputText = "What's in my Ski Week pack?"
        viewModel.sendMessage()
        try await waitUntilIdle(viewModel)

        let output = try #require(lastToolOutput(in: service))
        let data = try #require(output["data"] as? [String: String])
        // Returning the scoped pack here would answer confidently with the wrong
        // pack's contents, which is worse than reporting a miss.
        #expect(data["id"] == "other")
        #expect(data["name"] == "Ski Week")
    }

    @Test("reports the tool unavailable when no pack tools are wired")
    func reportsUnavailableWithoutPackTools() async throws {
        let service = MockToolChatService(chunks: toolCallChunks(
            id: "call_1", toolName: "listUserPacks", input: #"{}"#
        ))
        let viewModel = ChatViewModel(service: service)

        viewModel.inputText = "list my packs"
        viewModel.sendMessage()
        try await waitUntilIdle(viewModel)

        let output = try #require(lastToolOutput(in: service))
        #expect(output["success"] as? Bool == false)
    }
}

// MARK: - Helpers

/// An empty pack. Field order follows the generated `Pack` in Generated.swift.
private func makeTestPack(id: String, name: String) -> Pack {
    Pack(
        id: id,
        userId: "user-1",
        name: name,
        description: nil,
        category: .custom,
        isPublic: false,
        image: nil,
        tags: nil,
        templateId: nil,
        deleted: false,
        isAIGenerated: false,
        items: [],
        totalWeight: 0,
        baseWeight: 0,
        wornWeight: 0,
        consumableWeight: 0,
        createdAt: "2026-08-12T00:00:00Z",
        updatedAt: "2026-08-12T00:00:00Z"
    )
}

/// The tool result the view model produced, read from the history it handed back
/// to the transport.
///
/// `ChatViewModel` clears a placeholder's invocations once they are folded into
/// the outgoing history, so the live `messages` array is the wrong place to look.
/// Reading the wire copy also asserts the more useful thing: what the model
/// actually receives.
@MainActor
private func lastToolOutput(in service: MockToolChatService) -> [String: Any]? {
    guard let data = (service.lastMessages ?? [])
        .flatMap(\.toolInvocations)
        .compactMap(\.outputData)
        .last
    else { return nil }
    return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
}

/// Polls until `condition` holds, so a test can assert on the first observable
/// effect rather than on the whole turn finishing.
@MainActor
private func waitUntil(
    timeout: Duration = .seconds(10),
    _ condition: @MainActor () -> Bool
) async throws {
    let deadline = ContinuousClock.now.advanced(by: timeout)
    while ContinuousClock.now < deadline {
        if condition() { return }
        try await Task.sleep(for: .milliseconds(20))
    }
    Issue.record("Timed out waiting for condition")
}

@MainActor
private func waitUntilIdle(_ viewModel: ChatViewModel, timeout: Duration = .seconds(10)) async throws {
    let deadline = ContinuousClock.now.advanced(by: timeout)
    while ContinuousClock.now < deadline {
        if !viewModel.isStreaming { return }
        try await Task.sleep(for: .milliseconds(20))
    }
    Issue.record("Timed out waiting for the chat turn to finish")
}

/// Replays a fixed set of stream chunks on every turn. The view model answers a
/// client tool and then streams again, so each turn sees the same call; the
/// round-trip cap stops that looping and the assertions read the last output.
private final class MockToolChatService: ChatServicing, @unchecked Sendable {
    private let chunks: [String]

    /// History from the most recent call. The second turn carries the tool
    /// output the view model produced locally, which is what the tests assert on.
    private(set) var lastMessages: [ChatMessage]?

    init(chunks: [String]) {
        self.chunks = chunks
    }

    func sendMessage(messages: [ChatMessage], context: ChatContext) async -> AsyncThrowingStream<String, Error> {
        lastMessages = messages
        return AsyncThrowingStream { continuation in
            for chunk in chunks {
                continuation.yield(chunk)
            }
            continuation.finish()
        }
    }
}
