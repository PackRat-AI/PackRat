import XCTest
@testable import PackRat

final class GuidesTests: XCTestCase {
    private func decode(_ json: String) throws -> Guide {
        try JSONDecoder().decode(Guide.self, from: Data(json.utf8))
    }

    func testReadingTimeDecodesFromNumberOrString() throws {
        XCTAssertEqual(try decode(#"{"id":"a","title":"T","readingTime":6}"#).readingTime, 6)
        XCTAssertEqual(try decode(#"{"id":"a","title":"T","readingTime":"7"}"#).readingTime, 7)
        XCTAssertEqual(try decode(#"{"id":"a","title":"T","readingTime":"6.6"}"#).readingTime, 7)
        XCTAssertNil(try decode(#"{"id":"a","title":"T","readingTime":"soon"}"#).readingTime)
        XCTAssertNil(try decode(#"{"id":"a","title":"T"}"#).readingTime)
    }

    func testTopicLabelUsesEditorialNameThenTitleCasesTags() {
        XCTAssertEqual(GuideTopic.label(for: "food-nutrition"), "Food & Nutrition")
        XCTAssertEqual(GuideTopic.label(for: "maintenance"), "Gear Care")
        XCTAssertEqual(GuideTopic.label(for: "winter-camping"), "Winter Camping")
    }

    func testOverlineAndBylineJoinWhicheverPartsExist() throws {
        let full = try decode(#"{"id":"a","title":"T","categories":["food-nutrition","trails"],"difficulty":"Beginner","author":"Jamie Rivera","readingTime":6}"#)
        XCTAssertEqual(full.overline, "Food & Nutrition · Beginner")
        XCTAssertEqual(full.byline, "By Jamie Rivera · 6 min read")

        let bare = try decode(#"{"id":"a","title":"T"}"#)
        XCTAssertNil(bare.overline)
        XCTAssertNil(bare.byline)
    }

    @MainActor
    func testPagerAppendsNextPageWithoutDuplicates() async {
        let pager = GuidePager()
        let first = [Guide(id: "1", title: "A", content: nil, description: nil, category: nil, categories: nil, author: nil, difficulty: nil, createdAt: nil),
                     Guide(id: "2", title: "B", content: nil, description: nil, category: nil, categories: nil, author: nil, difficulty: nil, createdAt: nil)]
        let second = [first[1], Guide(id: "3", title: "C", content: nil, description: nil, category: nil, categories: nil, author: nil, difficulty: nil, createdAt: nil)]
        await pager.load(key: "") { page in
            GuidesResponse(items: page == 1 ? first : second, totalCount: 3, page: page, limit: 2, totalPages: 2)
        }
        XCTAssertEqual(pager.phase, .loaded)
        XCTAssertTrue(pager.hasMore)
        await pager.loadMore()
        XCTAssertEqual(pager.items.map(\.id), ["1", "2", "3"])
        XCTAssertFalse(pager.hasMore)
    }

    @MainActor
    func testPagerFailureOnFirstPageIsAnErrorButRefreshFailureKeepsItems() async {
        struct Boom: Error {}
        let pager = GuidePager()
        await pager.load(key: "") { _ in throw Boom() }
        XCTAssertEqual(pager.phase, .failed)

        let guide = Guide(id: "1", title: "A", content: nil, description: nil, category: nil, categories: nil, author: nil, difficulty: nil, createdAt: nil)
        await pager.load(key: "") { page in
            GuidesResponse(items: [guide], totalCount: 1, page: page, limit: 20, totalPages: 1)
        }
        await pager.load(key: "", refreshing: true) { _ in throw Boom() }
        XCTAssertEqual(pager.phase, .loaded)
        XCTAssertEqual(pager.items.map(\.id), ["1"])
    }
}
