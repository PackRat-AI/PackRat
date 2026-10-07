import CoreGraphics
import Foundation
import ImageIO
import Testing
import UniformTypeIdentifiers
@testable import PackRat

private func person(_ id: String, _ first: String, _ last: String? = nil) -> PostAuthor {
    PostAuthor(id: id, firstName: first, lastName: last)
}

private func comment(_ id: Int, parent: Int? = nil, userId: String = "u1") -> PackRat.Comment {
    PackRat.Comment(
        id: id, postId: 1, userId: userId, content: "c\(id)", parentCommentId: parent,
        createdAt: "2026-10-07T07:21:18.205Z", updatedAt: "2026-10-07T07:21:18.205Z",
        author: nil, likeCount: 0, likedByMe: false
    )
}

@Suite("Mentions")
struct MentionsTests {
    @Test("an @ at the start of a word opens a query")
    func activeQuery() {
        #expect(Mentions.activeQuery(in: "Great hike with @Sa")?.query == "Sa")
        #expect(Mentions.activeQuery(in: "@Sam Riv")?.query == "Sam Riv")
    }

    @Test("an @ inside a word, a trailing space or a newline closes the query")
    func closedQuery() {
        #expect(Mentions.activeQuery(in: "me@example") == nil)
        #expect(Mentions.activeQuery(in: "with @Sam Rivera ") == nil)
        #expect(Mentions.activeQuery(in: "with @Sam\nnext line") == nil)
        #expect(Mentions.activeQuery(in: "with @") == nil)
    }

    @Test("accepting a suggestion replaces the query with the full name and a space")
    func insert() {
        let sam = person("1", "Sam", "Rivera")
        #expect(Mentions.insert(sam, into: "Hiked with @sa") == "Hiked with @Sam Rivera ")
    }

    @Test("only people still named in the text are tagged, once each")
    func taggedIds() {
        let sam = person("1", "Sam", "Rivera")
        let ana = person("2", "Ana")
        let text = "With @Sam Rivera and @Sam Rivera again"
        #expect(Mentions.taggedIds(in: text, candidates: [sam, ana, sam]) == ["1"])
    }

    @Test("highlighting colours each tagged @Name and leaves untagged names plain")
    func highlighted() {
        let sam = person("1", "Sam", "Rivera")
        let attributed = Mentions.highlighted("Thanks @Sam Rivera and @Ana", people: [sam])
        let emphasized = attributed.runs
            .filter { $0.inlinePresentationIntent == .stronglyEmphasized }
            .map { String(attributed[$0.range].characters) }
        #expect(emphasized == ["@Sam Rivera"])
    }
}

@Suite("CommentThread")
struct CommentThreadTests {
    @Test("replies sit under their parent, in order, one level deep")
    func groupsReplies() {
        let threads = CommentThread.threads(from: [
            comment(1), comment(2), comment(3, parent: 1), comment(4, parent: 2), comment(5, parent: 1),
        ])
        #expect(threads.map(\.root.id) == [1, 2])
        #expect(threads[0].replies.map(\.id) == [3, 5])
        #expect(threads[1].replies.map(\.id) == [4])
    }

    @Test("a reply whose parent is gone becomes its own thread")
    func orphanedReply() {
        let threads = CommentThread.threads(from: [comment(1), comment(7, parent: 99)])
        #expect(threads.map(\.root.id) == [1, 7])
    }
}

@Suite("FeedPhotoProcessing")
struct FeedPhotoProcessingTests {
    /// A JPEG of the given size carrying GPS and EXIF metadata.
    private func jpegWithLocation(width: Int, height: Int) throws -> Data {
        let context = try #require(CGContext(
            data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
        ))
        context.setFillColor(CGColor(red: 0.2, green: 0.5, blue: 0.3, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        let image = try #require(context.makeImage())

        let output = NSMutableData()
        let destination = try #require(CGImageDestinationCreateWithData(
            output as CFMutableData, UTType.jpeg.identifier as CFString, 1, nil
        ))
        let properties: [CFString: Any] = [
            kCGImagePropertyGPSDictionary: [
                kCGImagePropertyGPSLatitude: 37.7749,
                kCGImagePropertyGPSLatitudeRef: "N",
                kCGImagePropertyGPSLongitude: 122.4194,
                kCGImagePropertyGPSLongitudeRef: "W",
            ],
            kCGImagePropertyExifDictionary: [kCGImagePropertyExifLensModel: "Test Lens"],
        ]
        CGImageDestinationAddImage(destination, image, properties as CFDictionary)
        #expect(CGImageDestinationFinalize(destination))
        return output as Data
    }

    private func properties(of data: Data) throws -> [CFString: Any] {
        let source = try #require(CGImageSourceCreateWithData(data as CFData, nil))
        return (CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]) ?? [:]
    }

    @Test("the fixture really carries a location")
    func fixtureHasLocation() throws {
        let original = try jpegWithLocation(width: 64, height: 48)
        #expect(try properties(of: original)[kCGImagePropertyGPSDictionary] != nil)
    }

    @Test("location and camera metadata are stripped before upload")
    func stripsLocation() throws {
        let original = try jpegWithLocation(width: 64, height: 48)
        let prepared = try #require(FeedPhotoProcessing.prepare(original))
        let props = try properties(of: prepared.jpeg)
        #expect(props[kCGImagePropertyGPSDictionary] == nil)
        let exif = props[kCGImagePropertyExifDictionary] as? [CFString: Any]
        #expect(exif?[kCGImagePropertyExifLensModel] == nil)
    }

    @Test("large photos are downsampled to the upload size, keeping their shape")
    func downsamples() throws {
        let original = try jpegWithLocation(width: 4000, height: 3000)
        let prepared = try #require(FeedPhotoProcessing.prepare(original))
        let props = try properties(of: prepared.jpeg)
        #expect(props[kCGImagePropertyPixelWidth] as? Int == FeedPhotoProcessing.maxUploadPixelSize)
        #expect(props[kCGImagePropertyPixelHeight] as? Int == 1536)
        #expect(max(prepared.preview.width, prepared.preview.height) == FeedPhotoProcessing.previewPixelSize)
    }

    @Test("data that is not an image is rejected")
    func rejectsGarbage() {
        #expect(FeedPhotoProcessing.prepare(Data("not an image".utf8)) == nil)
    }
}

@Suite("Post share link")
struct PostShareLinkTests {
    @Test("the share link is packratai.com/p/{publicId}")
    func shareURL() {
        var post = Post(
            id: 6, userId: "u", caption: nil, images: [], createdAt: "", updatedAt: "",
            author: nil, likeCount: 0, commentCount: 0, likedByMe: false
        )
        #expect(post.shareURL == nil)
        post.publicId = "036ebe2f-fac2-4615-b7fa-6cb26897df23"
        #expect(post.shareURL?.absoluteString == "https://packratai.com/p/036ebe2f-fac2-4615-b7fa-6cb26897df23")
    }

    @Test("a real API post decodes with the photo sharing fields")
    func decodesPost() throws {
        let json = """
        {"id":6,"userId":"a","caption":"Edited caption","images":["a-1.jpg"],
         "createdAt":"2026-10-07T07:21:18.205Z","updatedAt":"2026-10-07T07:21:44.686Z",
         "author":{"id":"a","firstName":"Alice","lastName":null,"avatarUrl":"a-avatar.jpg"},
         "likeCount":1,"commentCount":2,"likedByMe":false,
         "publicId":"036ebe2f-fac2-4615-b7fa-6cb26897df23",
         "captionEditedAt":"2026-10-07T07:21:44.686Z","savedByMe":true,
         "tags":[{"id":"b","firstName":"Bo","lastName":null,"avatarUrl":null}]}
        """
        let post = try JSONDecoder().decode(Post.self, from: Data(json.utf8))
        #expect(post.isEdited)
        #expect(post.isSaved)
        #expect(post.taggedPeople.map(\.id) == ["b"])
        #expect(post.author?.avatarUrl == "a-avatar.jpg")
    }
}

@Suite("Post photo shape")
struct PostPhotoAspectTests {
    @Test("a landscape photo keeps its own shape")
    func landscape() {
        #expect(abs(PostPhotoAspect.clamped(width: 1600, height: 1067) - 1.4995) < 0.001)
    }

    @Test("a tall portrait photo is held at 4:5")
    func tallPortrait() {
        #expect(abs(PostPhotoAspect.clamped(width: 1080, height: 1920) - 0.8) < 0.001)
    }

    @Test("a panorama is held at 1.91:1")
    func panorama() {
        #expect(PostPhotoAspect.clamped(width: 4000, height: 1000) == 1.91)
    }

    @Test("a photo with no size falls back to the placeholder shape")
    func unknownSize() {
        #expect(PostPhotoAspect.clamped(width: 0, height: 0) == PostPhotoAspect.placeholder)
    }
}
