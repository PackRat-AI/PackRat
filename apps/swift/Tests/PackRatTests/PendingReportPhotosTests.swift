import Foundation
import Testing
@testable import PackRat

// A trail report written without signal keeps its photos on the device until
// the outbox uploads them. These pin the on-disk contract the queue relies on.

@Suite("PendingReportPhotos")
struct PendingReportPhotosTests {
    private let reportId = "test-\(UUID().uuidString.lowercased())"

    @Test("A saved photo reads back and shows as a file URL")
    func roundTrip() throws {
        defer { PendingReportPhotos.remove(reportId: reportId) }
        let jpeg = Data([0xFF, 0xD8, 0xFF, 0xD9])

        let entry = try PendingReportPhotos.save(jpeg, reportId: reportId)

        #expect(entry.hasPrefix("pending-photo:\(reportId)/"))
        #expect(PendingReportPhotos.data(for: entry) == jpeg)
        let shown = PendingReportPhotos.displayable([entry, "user-1-abc.jpg"])
        #expect(shown[0].hasPrefix("file:"))
        #expect(shown[1] == "user-1-abc.jpg")
    }

    @Test("Removing a report deletes its photos")
    func removeClearsFolder() throws {
        let entry = try PendingReportPhotos.save(Data([1, 2, 3]), reportId: reportId)

        PendingReportPhotos.remove(reportId: reportId)

        #expect(PendingReportPhotos.data(for: entry) == nil)
    }

    @Test("An entry cannot name a file outside the photo folder")
    func refusesTraversal() {
        #expect(PendingReportPhotos.fileURL(for: "pending-photo:../../secrets") == nil)
        #expect(PendingReportPhotos.fileURL(for: "pending-photo:a/b/c.jpg") == nil)
        #expect(PendingReportPhotos.fileURL(for: "user-1-abc.jpg") == nil)
    }
}
