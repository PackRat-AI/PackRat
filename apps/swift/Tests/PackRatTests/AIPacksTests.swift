import Testing
import Foundation
@testable import PackRat

// MARK: - Request body encoding

@Suite("GeneratePacksRequest encoding")
struct GeneratePacksRequestTests {
    @Test("encodes the count as a JSON integer")
    func encodesCount() throws {
        let req = GeneratePacksRequest(count: 5)
        let data = try JSONEncoder().encode(req)
        let dict = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        #expect(dict["count"] as? Int == 5)
        #expect(dict.count == 1, "only `count` should appear in the wire body")
    }

    @Test("count of 1 (lower bound) round-trips")
    func lowerBoundEncodes() throws {
        let req = GeneratePacksRequest(count: 1)
        let data = try JSONEncoder().encode(req)
        let decoded = try JSONDecoder().decode([String: Int].self, from: data)
        #expect(decoded["count"] == 1)
    }
}

// MARK: - AIPacksViewModel state transitions

@Suite("AIPacksViewModel")
@MainActor
struct AIPacksViewModelTests {
    @Test("initial state has sensible defaults")
    func initialState() {
        let vm = AIPacksViewModel()
        #expect(vm.count == 3)
        #expect(vm.isGenerating == false)
        #expect(vm.error == nil)
        #expect(vm.generatedPacks.isEmpty)
        #expect(vm.canGenerate == true)
    }

    @Test("canGenerate is false while a request is in flight")
    func canGenerateFalseWhenBusy() {
        let vm = AIPacksViewModel()
        vm.isGenerating = true
        #expect(vm.canGenerate == false)
    }

    @Test("canGenerate is false outside [min, max]")
    func canGenerateBoundsCheck() {
        let vm = AIPacksViewModel()
        vm.count = 0
        #expect(vm.canGenerate == false)
        vm.count = AIPacksViewModel.maxCount + 1
        #expect(vm.canGenerate == false)
        vm.count = AIPacksViewModel.maxCount
        #expect(vm.canGenerate == true)
    }

    @Test("clampCount snaps to the supported range")
    func clampPullsIntoRange() {
        let vm = AIPacksViewModel()
        vm.count = -4
        vm.clampCount()
        #expect(vm.count == AIPacksViewModel.minCount)
        vm.count = 999
        vm.clampCount()
        #expect(vm.count == AIPacksViewModel.maxCount)
    }

    @Test("clearGenerated empties the result cache")
    func clearWipesResults() {
        let vm = AIPacksViewModel()
        vm.generatedPacks = [makePack(id: "1")]
        vm.clearGenerated()
        #expect(vm.generatedPacks.isEmpty)
    }

    @Test("generate aborts early when canGenerate is false")
    func generateAbortsWhenDisallowed() async {
        let vm = AIPacksViewModel()
        vm.isGenerating = true // simulate a request already in flight
        let result = await vm.generate()
        #expect(result.isEmpty)
        // No state changes other than the inflight flag we set
        #expect(vm.error == nil)
        #expect(vm.generatedPacks.isEmpty)
    }
}

// MARK: - Pack JSON decoding for AI-generated payloads

@Suite("AI-generated Pack JSON decoding")
struct AIPackDecodingTests {
    @Test("decodes the wire shape returned by /generate-packs")
    func decodesAIGeneratedPack() throws {
        let json = """
        {
            "id": "ai-pack-1",
            "userId": "user-42-uuid",
            "name": "High-Sierra Summer Hike",
            "description": "A lightweight 3-day kit for granite peaks.",
            "category": "hiking",
            "tags": ["ultralight", "summer", "alpine"],
            "isPublic": true,
            "isAIGenerated": true,
            "deleted": false
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let pack = try decoder.decode(Pack.self, from: json)

        #expect(pack.id == "ai-pack-1")
        #expect(pack.isAIGenerated == true)
        #expect(pack.isPublic == true)
        #expect(pack.category == .hiking)
        #expect(pack.tags?.count == 3)
        #expect(pack.tags?.contains("ultralight") == true)
    }

    @Test("decodes an array of packs from the generate-packs response")
    func decodesArrayResponse() throws {
        let json = """
        [
            {
                "id": "p-1",
                "userId": "user-1",
                "name": "Desert Crossing",
                "category": "desert",
                "isPublic": true,
                "isAIGenerated": true,
                "deleted": false
            },
            {
                "id": "p-2",
                "userId": "user-1",
                "name": "Winter Bivvy",
                "category": "winter",
                "isPublic": true,
                "isAIGenerated": true,
                "deleted": false
            }
        ]
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let packs = try decoder.decode([Pack].self, from: json)

        #expect(packs.count == 2)
        #expect(packs[0].category == .desert)
        #expect(packs[1].category == .winter)
        #expect(packs.allSatisfy { $0.isAIGenerated == true })
    }
}

// MARK: - Helpers

private func makePack(id: String) -> Pack {
    Pack(id: id, userId: "u1", name: "Test", description: nil, category: .hiking,
         isPublic: true, image: nil, tags: nil, templateId: nil, deleted: false,
         isAIGenerated: true, items: nil, totalWeight: nil, baseWeight: nil,
         wornWeight: nil, consumableWeight: nil, createdAt: nil, updatedAt: nil)
}
