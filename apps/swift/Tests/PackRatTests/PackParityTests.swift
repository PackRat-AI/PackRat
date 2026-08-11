import Foundation
import Testing
@testable import PackRat

// MARK: - Pack-scoped chat context

@Suite("ChatContext")
struct ChatContextTests {
    @Test("pack context exposes packId and name, not itemId")
    func packContextFields() {
        let context = ChatContext.pack(id: "pack-1", name: "Sierra Overnight")
        #expect(context.contextType == "pack")
        #expect(context.packId == "pack-1")
        #expect(context.packName == "Sierra Overnight")
        #expect(context.itemId == nil)
    }

    @Test("general context sends no ids")
    func generalContextFields() {
        let context = ChatContext.general
        #expect(context.contextType == "general")
        #expect(context.packId == nil)
        #expect(context.itemId == nil)
        #expect(context.packName == nil)
    }

    @Test("item context exposes itemId only")
    func itemContextFields() {
        let context = ChatContext.item(id: "item-9")
        #expect(context.contextType == "item")
        #expect(context.itemId == "item-9")
        #expect(context.packId == nil)
    }
}

@Suite("ChatRequest encoding")
struct ChatRequestEncodingTests {
    private func encode(_ request: ChatRequest) throws -> [String: Any] {
        let data = try JSONEncoder().encode(request)
        return try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    /// The chat route's body schema is `z.any()`, so a wrong field name fails
    /// silently as a generic chat instead of erroring. These assertions are the
    /// only thing standing between a typo and a broken pack context.
    @Test("pack context is serialized as contextType + packId")
    func packContextEncoded() throws {
        let request = ChatRequest(
            messages: [ChatMessage(role: .user, content: "What's missing?")],
            context: .pack(id: "pack-42", name: "Desert Loop")
        )
        let dict = try encode(request)
        #expect(dict["contextType"] as? String == "pack")
        #expect(dict["packId"] as? String == "pack-42")
        #expect(dict["date"] as? String != nil)
    }

    @Test("messages carry role, content and a text part")
    func messagesEncoded() throws {
        let request = ChatRequest(
            messages: [ChatMessage(role: .user, content: "Hello")],
            context: .general
        )
        let dict = try encode(request)
        let messages = try #require(dict["messages"] as? [[String: Any]])
        #expect(messages.count == 1)
        #expect(messages[0]["role"] as? String == "user")
        #expect(messages[0]["content"] as? String == "Hello")
        let parts = try #require(messages[0]["parts"] as? [[String: Any]])
        #expect(parts[0]["type"] as? String == "text")
        #expect(parts[0]["text"] as? String == "Hello")
    }

    @Test("general context omits packId")
    func generalContextOmitsPackId() throws {
        let request = ChatRequest(messages: [], context: .general)
        let dict = try encode(request)
        #expect(dict["contextType"] as? String == "general")
        #expect(dict["packId"] == nil)
    }
}

@Suite("ChatViewModel pack scoping")
@MainActor
struct ChatViewModelPackScopingTests {
    @Test("greeting names the pack when scoped to one")
    func greetingNamesPack() {
        let viewModel = ChatViewModel(
            service: StubChatService(),
            context: .pack(id: "p1", name: "Winter Hut Trip")
        )
        #expect(viewModel.messages.first?.content.contains("Winter Hut Trip") == true)
    }

    @Test("generic greeting when unscoped")
    func genericGreeting() {
        let viewModel = ChatViewModel(service: StubChatService(), context: .general)
        #expect(viewModel.messages.first?.content.contains("PackRat AI assistant") == true)
    }

    /// The view model holding a `ChatContext` is not enough — it has to reach the
    /// transport, or the request goes out unscoped and the server silently
    /// answers as a general chat.
    @Test("the pack context is forwarded to the transport")
    func packContextReachesTheService() async throws {
        let service = RecordingChatService()
        let viewModel = ChatViewModel(
            service: service,
            context: .pack(id: "pack-7", name: "Ridge Line")
        )

        viewModel.inputText = "What's missing?"
        viewModel.sendMessage()

        // sendMessage spawns a Task; poll briefly rather than sleeping a fixed
        // amount, so the test is neither flaky nor slower than it needs to be.
        var attempts = 0
        while service.lastContext == nil, attempts < 200 {
            try await Task.sleep(for: .milliseconds(5))
            attempts += 1
        }
        #expect(service.lastContext == .pack(id: "pack-7", name: "Ridge Line"))
    }

    @Test("clearHistory keeps the pack greeting")
    func clearHistoryKeepsPackGreeting() {
        let viewModel = ChatViewModel(
            service: StubChatService(),
            context: .pack(id: "p1", name: "Winter Hut Trip")
        )
        viewModel.clearHistory()
        #expect(viewModel.messages.count == 1)
        #expect(viewModel.messages.first?.content.contains("Winter Hut Trip") == true)
    }
}

private struct StubChatService: ChatServicing {
    func sendMessage(messages _: [ChatMessage], context _: ChatContext) async -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { $0.finish() }
    }
}

/// Captures the context the view model sends, so a test can assert the pack
/// scoping actually reaches the transport.
private final class RecordingChatService: ChatServicing, @unchecked Sendable {
    private(set) var lastContext: ChatContext?

    func sendMessage(messages _: [ChatMessage], context: ChatContext) async -> AsyncThrowingStream<String, Error> {
        lastContext = context
        return AsyncThrowingStream { $0.finish() }
    }
}

// MARK: - Packing mode

@Suite("PackingModeStore")
@MainActor
struct PackingModeStoreTests {
    /// Each test gets its own suite-name UserDefaults so persistence is
    /// Runs `body` against a store backed by a throwaway suite, so persistence is
    /// exercised for real without leaking between tests or into the app domain,
    /// then removes the suite. Suites persist to disk, so leaving them behind
    /// litters the test host with a plist per test per run.
    private func withStore(
        _ body: (PackingModeStore, UserDefaults) throws -> Void
    ) throws {
        let name = "packing-test-\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: name))
        defer { defaults.removePersistentDomain(forName: name) }
        try body(PackingModeStore(defaults: defaults), defaults)
    }

    @Test("items start unpacked")
    func startsUnpacked() throws {
        try withStore { store, _ in
            #expect(store.isPacked("i1", in: "p1") == false)
            #expect(store.packedItems(in: "p1").isEmpty)
        }
    }

    @Test("toggle marks packed then unpacked")
    func toggleRoundTrip() throws {
        try withStore { store, _ in
            store.toggle(itemId: "i1", in: "p1")
            #expect(store.isPacked("i1", in: "p1"))
            store.toggle(itemId: "i1", in: "p1")
            #expect(store.isPacked("i1", in: "p1") == false)
        }
    }

    @Test("unpacking removes the key rather than storing false")
    func unpackingRemovesKey() throws {
        try withStore { store, _ in
            store.setPacked(true, itemId: "i1", in: "p1")
            store.setPacked(false, itemId: "i1", in: "p1")
            #expect(store.packedItems(in: "p1").isEmpty)
        }
    }

    @Test("packs are scoped independently")
    func packsAreIndependent() throws {
        try withStore { store, _ in
            store.setPacked(true, itemId: "shared-item", in: "p1")
            #expect(store.isPacked("shared-item", in: "p1"))
            #expect(store.isPacked("shared-item", in: "p2") == false)
        }
    }

    @Test("reset clears only the target pack")
    func resetIsScoped() throws {
        try withStore { store, _ in
            store.setPacked(true, itemId: "i1", in: "p1")
            store.setPacked(true, itemId: "i2", in: "p2")
            store.reset(packId: "p1")
            #expect(store.packedItems(in: "p1").isEmpty)
            #expect(store.isPacked("i2", in: "p2"))
        }
    }

    @Test("replace overwrites and drops false entries")
    func replaceDropsFalse() throws {
        try withStore { store, _ in
            store.setPacked(true, itemId: "stale", in: "p1")
            store.replace(packedItems: ["i1": true, "i2": false], in: "p1")
            #expect(store.packedItems(in: "p1") == ["i1": true])
        }
    }

    /// Progress is computed against the pack's *current* items. An item checked
    /// off and later deleted must not keep counting, or progress exceeds 100%.
    @Test("packedCount ignores ids no longer in the pack")
    func packedCountIgnoresDeletedItems() throws {
        try withStore { store, _ in
            store.setPacked(true, itemId: "i1", in: "p1")
            store.setPacked(true, itemId: "deleted-item", in: "p1")
            #expect(store.packedCount(in: "p1", among: ["i1", "i2"]) == 1)
        }
    }

    @Test("state survives a new store over the same defaults")
    func statePersists() throws {
        try withStore { store, defaults in
            store.setPacked(true, itemId: "i1", in: "p1")

            let reloaded = PackingModeStore(defaults: defaults)
            #expect(reloaded.isPacked("i1", in: "p1"))
        }
    }

    @Test("a malformed persisted payload degrades to empty, not a crash")
    func malformedPayloadIsIgnored() throws {
        try withStore { _, defaults in
            defaults.set(["p1": "not-a-dictionary"], forKey: "packingMode")

            let store = PackingModeStore(defaults: defaults)
            #expect(store.packedItems(in: "p1").isEmpty)
        }
    }
}

// MARK: - Image detection decoding

@Suite("DetectedItemWithMatches decoding")
struct ImageDetectionDecodingTests {
    private func decode(_ json: String) throws -> [DetectedItemWithMatches] {
        let data = try #require(json.data(using: .utf8))
        return try JSONDecoder().decode([DetectedItemWithMatches].self, from: data)
    }

    /// The analyze route returns a bare array, not an object wrapper.
    @Test("decodes a bare array of detections")
    func decodesBareArray() throws {
        let results = try decode("""
        [{"detected":{"name":"Rain Jacket","description":"Shell","quantity":1,
          "category":"clothing","consumable":false,"worn":true,"confidence":0.92},
          "catalogMatches":[]}]
        """)
        #expect(results.count == 1)
        #expect(results[0].detected.name == "Rain Jacket")
        #expect(results[0].detected.worn)
        #expect(results[0].detected.confidence == 0.92)
        #expect(results[0].primaryMatch == nil)
    }

    /// `consumable`/`worn` carry Zod defaults server-side and may be absent.
    @Test("absent optional flags fall back to false")
    func absentFlagsDefaultFalse() throws {
        let results = try decode("""
        [{"detected":{"name":"Tent","description":"","quantity":1,
          "category":"shelter","confidence":0.5},"catalogMatches":[]}]
        """)
        #expect(results[0].detected.consumable == false)
        #expect(results[0].detected.worn == false)
    }

    /// One malformed detection must not take the whole photo's results with it.
    @Test("a detection missing non-essential fields still decodes")
    func partialDetectionDecodes() throws {
        let results = try decode("""
        [{"detected":{"name":"Mystery Item"},"catalogMatches":[]}]
        """)
        #expect(results[0].detected.name == "Mystery Item")
        #expect(results[0].detected.quantity == 1)
        #expect(results[0].detected.category.isEmpty)
    }

    @Test("primaryMatch is the first catalog match")
    func primaryMatchIsFirst() throws {
        let results = try decode("""
        [{"detected":{"name":"Sleeping Bag","description":"","quantity":1,
          "category":"sleep","confidence":0.8},
          "catalogMatches":[
            {"id":11,"name":"Bag A","productUrl":"u","sku":"s1","weight":900,"weightUnit":"g"},
            {"id":12,"name":"Bag B","productUrl":"u","sku":"s2","weight":800,"weightUnit":"g"}
          ]}]
        """)
        #expect(results[0].primaryMatch?.id == 11)
        #expect(results[0].catalogMatches.count == 2)
    }
}

@Suite("AnalyzeImageRequest encoding")
struct AnalyzeImageRequestTests {
    @Test("sends the object key as `image`")
    func encodesImageKey() throws {
        let request = AnalyzeImageRequest(image: "user-1-abc.jpg", matchLimit: 1)
        let data = try JSONEncoder().encode(request)
        let dict = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        #expect(dict["image"] as? String == "user-1-abc.jpg")
        #expect(dict["matchLimit"] as? Int == 1)
    }

    @Test("omits matchLimit when nil")
    func omitsNilMatchLimit() throws {
        let request = AnalyzeImageRequest(image: "user-1-abc.jpg", matchLimit: nil)
        let data = try JSONEncoder().encode(request)
        let dict = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        #expect(dict["matchLimit"] == nil)
    }
}

// MARK: - Catalog browser search feedback

@Suite("PackCatalogBrowserViewModel search state")
@MainActor
struct PackCatalogBrowserSearchStateTests {
    /// The loader has to appear on the keystroke, not when the request starts —
    /// the 400ms debounce sits in between, and covering only the request leaves
    /// typing with no feedback at all.
    @Test("typing marks the view as searching immediately")
    func typingSetsSearchingBeforeDebounce() {
        let viewModel = PackCatalogBrowserViewModel(service: StubCatalogService())
        #expect(viewModel.isSearching == false)

        viewModel.searchText = "tent"
        viewModel.onSearchTextChanged()

        // Synchronous check: no awaiting, so this is the debounce window.
        #expect(viewModel.isSearching)
    }

    @Test("changing category also shows the loader")
    func categoryChangeSetsSearching() {
        let viewModel = PackCatalogBrowserViewModel(service: StubCatalogService())
        viewModel.selectCategory("shelter")
        #expect(viewModel.isSearching)
        #expect(viewModel.selectedCategory == "shelter")
    }

    /// Selecting an item, then searching for something else, must not lose the
    /// earlier pick — resolving against the visible list alone would drop it.
    @Test("selections survive the result list being replaced")
    func selectionSurvivesNewSearch() async {
        let first = StubCatalogService.item(id: 1, name: "Tent")
        let second = StubCatalogService.item(id: 2, name: "Stove")
        let service = StubCatalogService(pages: [[first], [second]])
        let viewModel = PackCatalogBrowserViewModel(service: service)

        await viewModel.load(reset: true)
        viewModel.toggleSelection(first)
        #expect(viewModel.selectedCount == 1)

        // Second load replaces `items` entirely, as a new query would.
        await viewModel.load(reset: true)
        viewModel.toggleSelection(second)

        let resolved = viewModel.resolvedSelection()
        #expect(resolved.count == 2)
        #expect(Set(resolved.map(\.item.id)) == [1, 2])
    }

    /// A failed append used to consume the page number, so the next scroll asked
    /// for page 3 and page 2's results were never fetched.
    @Test("a failed page load gives the page number back")
    func failedPageIsRetried() async {
        // A full first page, so `hasMore` stays true and paging can continue.
        let firstPage = (1...20).map { StubCatalogService.item(id: $0, name: "Item \($0)") }
        let service = StubCatalogService(pages: [firstPage])
        let viewModel = PackCatalogBrowserViewModel(service: service)
        await viewModel.load(reset: true)

        let last = try? #require(firstPage.last)
        guard let last else { return }

        service.shouldFail = true
        await viewModel.loadMoreIfNeeded(currentItem: last)

        service.shouldFail = false
        service.requestedPages.removeAll()
        await viewModel.loadMoreIfNeeded(currentItem: last)

        // Page 2 is asked for again rather than being skipped for page 3.
        #expect(service.requestedPages == [2])
    }
}

/// In-memory stand-in for `CatalogService`, so these tests never touch the
/// network. Reaching `CatalogService.shared` here made real requests to whatever
/// `PACKRAT_ENV` pointed at, which fails or hangs depending on the machine.
@MainActor
private final class StubCatalogService: CatalogBrowsing, @unchecked Sendable {
    var pages: [[CatalogItem]]
    var shouldFail = false
    var requestedPages: [Int] = []

    init(pages: [[CatalogItem]] = []) {
        self.pages = pages
    }

    static func item(id: Int, name: String) -> CatalogItem {
        CatalogItem(
            id: id, name: name, productUrl: "https://example.com/\(id)",
            sku: "sku-\(id)", weight: 100, weightUnit: .g, description: nil,
            categories: nil, images: nil, brand: nil, model: nil,
            ratingValue: nil, color: nil, size: nil, price: nil,
            availability: nil, seller: nil, reviewCount: nil
        )
    }

    func categories(limit _: Int) async throws -> [String] { [] }

    func browse(query _: String?, category _: String?, page: Int, limit _: Int) async throws -> [CatalogItem] {
        requestedPages.append(page)
        if shouldFail { throw StubError.failed }
        let index = page - 1
        return index < pages.count ? pages[index] : []
    }

    enum StubError: Error { case failed }
}

// MARK: - Catalog category display names

@Suite("catalogCategoryDisplayName")
struct CatalogCategoryDisplayNameTests {
    /// Scraped categories arrive with HTML entities intact. Plain `.capitalized`
    /// renders "hike &amp; camp" as the visibly broken "Hike &Amp; Camp".
    @Test("decodes &amp; instead of capitalizing it")
    func decodesAmpersand() {
        #expect("hike &amp; camp".catalogCategoryDisplayName == "Hike & Camp")
    }

    @Test("title-cases plain categories")
    func titleCasesPlain() {
        #expect("sleeping bags".catalogCategoryDisplayName == "Sleeping Bags")
        #expect("footwear".catalogCategoryDisplayName == "Footwear")
    }

    @Test("decodes the other entities that occur in catalog data")
    func decodesOtherEntities() {
        #expect("men&#39;s".catalogCategoryDisplayName == "Men's")
        #expect("a &lt; b".catalogCategoryDisplayName == "A < B")
    }

    @Test("leaves acronyms uppercase")
    func preservesAcronyms() {
        #expect("UL gear".catalogCategoryDisplayName == "UL Gear")
    }

    @Test("empty string stays empty")
    func emptyStaysEmpty() {
        #expect("".catalogCategoryDisplayName == "")
    }
}

// MARK: - Catalog linkage on created pack items

@Suite("CreatePackItemRequest catalog linkage")
struct CreatePackItemCatalogLinkageTests {
    private func encode(_ request: CreatePackItemRequest) throws -> [String: Any] {
        let data = try JSONEncoder().encode(request)
        return try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    /// Swift previously hardcoded `catalogItemId: nil`, so catalog-added items
    /// lost the link back to the product they came from.
    @Test("catalogItemId and image are sent when present")
    func sendsCatalogLinkage() throws {
        let request = CreatePackItemRequest(
            id: "i1", name: "Tent", weight: 1200, weightUnit: "g",
            quantity: 1, category: "shelter", consumable: false, worn: false,
            notes: nil, catalogItemId: 77, image: "user-1-tent.jpg"
        )
        let dict = try encode(request)
        #expect(dict["catalogItemId"] as? Int == 77)
        #expect(dict["image"] as? String == "user-1-tent.jpg")
    }

    @Test("hand-entered items omit catalog fields entirely")
    func omitsCatalogFieldsWhenAbsent() throws {
        let request = CreatePackItemRequest(id: "i1", name: "Hand-written Item")
        let dict = try encode(request)
        #expect(dict["catalogItemId"] == nil)
        #expect(dict["image"] == nil)
        #expect(dict["name"] as? String == "Hand-written Item")
    }
}
