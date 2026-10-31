import Foundation

/// Photos of a report written without signal, kept on disk until the outbox
/// uploads them.
///
/// A queued report names each such photo `pending-photo:<report>/<file>` in
/// its photo list. Only that relative name is stored, not a path: the app
/// container moves between launches and updates, so an absolute path would go
/// stale. Each report's photos share a folder, cleared once it sends.
enum PendingReportPhotos {
    static let prefix = "pending-photo:"

    private static var directory: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("PendingReportPhotos", isDirectory: true)
    }

    static func isPending(_ entry: String) -> Bool { entry.hasPrefix(prefix) }

    /// Writes `jpeg` to disk under `reportId` and returns the entry naming it.
    static func save(_ jpeg: Data, reportId: String) throws -> String {
        let folder = directory.appendingPathComponent(reportId, isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let name = "\(UUID().uuidString.lowercased()).jpg"
        try jpeg.write(to: folder.appendingPathComponent(name), options: .atomic)
        return "\(prefix)\(reportId)/\(name)"
    }

    /// The file behind a pending entry; nil for an uploaded key.
    static func fileURL(for entry: String) -> URL? {
        guard isPending(entry) else { return nil }
        let name = String(entry.dropFirst(prefix.count))
        // A name is `<report>/<file>`; refuse one that tries to leave the directory.
        guard name.split(separator: "/").count == 2, !name.contains("..") else { return nil }
        return directory.appendingPathComponent(name)
    }

    static func data(for entry: String) -> Data? {
        fileURL(for: entry).flatMap { try? Data(contentsOf: $0) }
    }

    /// How a photo list shows on screen: pending entries become file URLs,
    /// uploaded keys pass through.
    static func displayable(_ entries: [String]) -> [String] {
        entries.map { fileURL(for: $0)?.absoluteString ?? $0 }
    }

    /// Deletes every photo kept for `reportId`.
    static func remove(reportId: String) {
        guard !reportId.isEmpty, !reportId.contains("/"), !reportId.contains("..") else { return }
        try? FileManager.default.removeItem(at: directory.appendingPathComponent(reportId, isDirectory: true))
    }
}
