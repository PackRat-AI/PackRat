import Defaults
import Foundation
import Observation

extension Defaults.Keys {
    /// Whether the on-device model may download over cellular. Off by default:
    /// it is a multi-gigabyte download.
    static let onDeviceAIAllowsCellular = Key<Bool>("onDeviceAIAllowsCellular", default: false)
}

/// Downloads, verifies and deletes the Gemma weights.
///
/// Files come from a pinned Hugging Face revision and are checked against
/// known sizes, so a truncated or swapped file is never handed to the runtime.
/// An interrupted download keeps its resume data on disk and picks up where it
/// stopped.
@MainActor
@Observable
final class GemmaModelStore {
    enum State: Equatable {
        case notDownloaded
        case waitingForWiFi
        case downloading(fractionCompleted: Double)
        case downloaded
        case failed(String)
    }

    static let shared = GemmaModelStore()

    /// Gemma 4 E2B instruction-tuned, text only, 4-bit. Apache 2.0.
    nonisolated static let repository = "mlx-community/Gemma4-E2B-IT-Text-int4"
    nonisolated static let revision = "61d85e83c959ac93109dc5be7104c8de9942ef66"
    nonisolated static let displayName = "Gemma 4"

    nonisolated static let files: [(name: String, size: Int64)] = [
        ("config.json", 2_774),
        ("generation_config.json", 207),
        ("chat_template.jinja", 17_336),
        ("tokenizer_config.json", 1_837),
        ("tokenizer.json", 36_459_693),
        ("model.safetensors.index.json", 84_084),
        ("model.safetensors", 2_634_535_262),
    ]

    nonisolated static var downloadSize: Int64 { files.reduce(0) { $0 + $1.size } }

    nonisolated static var directory: URL {
        URL.applicationSupportDirectory
            .appending(path: "OnDeviceAI", directoryHint: .isDirectory)
            .appending(path: revision, directoryHint: .isDirectory)
    }

    private(set) var state: State
    private var downloadTask: Task<Void, Never>?

    private init() {
        state = Self.isComplete(at: Self.directory) ? .downloaded : .notDownloaded
    }

    var isDownloaded: Bool { state == .downloaded }

    /// Every file present at its expected size.
    nonisolated static func isComplete(at directory: URL) -> Bool {
        files.allSatisfy { file in
            let url = directory.appending(path: file.name)
            let size = (try? url.resourceValues(forKeys: [.fileSizeKey]))?.fileSize
            return size.map(Int64.init) == file.size
        }
    }

    func download() {
        guard downloadTask == nil, state != .downloaded else { return }
        state = .downloading(fractionCompleted: 0)
        downloadTask = Task { [weak self] in
            do {
                try await GemmaDownloader(
                    allowsCellular: Defaults[.onDeviceAIAllowsCellular],
                    onWaitingForWiFi: { self?.state = .waitingForWiFi },
                    onProgress: { self?.state = .downloading(fractionCompleted: $0) }
                ).run()
                self?.state = .downloaded
            } catch is CancellationError {
                self?.state = .notDownloaded
            } catch let error as URLError where error.code == .cancelled {
                self?.state = .notDownloaded
            } catch {
                self?.state = .failed(Self.message(for: error))
            }
            self?.downloadTask = nil
        }
    }

    func cancel() {
        downloadTask?.cancel()
    }

    func delete() {
        cancel()
        Task {
            await GemmaRuntime.shared.unload()
            try? FileManager.default.removeItem(at: Self.directory.deletingLastPathComponent())
            state = .notDownloaded
        }
    }

    private static func message(for error: Error) -> String {
        if let error = error as? URLError {
            switch error.code {
            case .notConnectedToInternet, .networkConnectionLost, .timedOut:
                return "The download stopped. Try again to pick up where it left off."
            default:
                break
            }
        }
        if (error as NSError).code == NSFileWriteOutOfSpaceError {
            return "There isn't enough storage. Free up space and try again."
        }
        return "The download didn't finish. Try again to pick up where it left off."
    }
}

// MARK: - Downloader

/// Fetches each missing file in turn, resuming a partial one from saved resume data.
private struct GemmaDownloader {
    let allowsCellular: Bool
    let onWaitingForWiFi: @MainActor () -> Void
    let onProgress: @MainActor (Double) -> Void

    private var directory: URL { GemmaModelStore.directory }
    private var resumeDataURL: URL { directory.appending(path: ".resume-data") }

    func run() async throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var excluded = URLResourceValues()
        excluded.isExcludedFromBackup = true
        var root = directory.deletingLastPathComponent()
        try? root.setResourceValues(excluded)

        let configuration = URLSessionConfiguration.default
        configuration.allowsCellularAccess = allowsCellular
        configuration.waitsForConnectivity = true
        configuration.timeoutIntervalForResource = 60 * 60 * 6

        let total = Double(GemmaModelStore.downloadSize)
        var finishedBytes: Int64 = 0

        for file in GemmaModelStore.files {
            try Task.checkCancellation()
            let destination = directory.appending(path: file.name)
            if Self.size(of: destination) == file.size {
                finishedBytes += file.size
                continue
            }

            let base = finishedBytes
            let delegate = ProgressDelegate(
                onWaiting: onWaitingForWiFi,
                onFraction: { fraction in
                    await onProgress((Double(base) + fraction * Double(file.size)) / total)
                }
            )
            let session = URLSession(configuration: configuration, delegate: delegate, delegateQueue: nil)
            defer { session.finishTasksAndInvalidate() }

            let temporary: URL
            do {
                if let resumeData = try? Data(contentsOf: resumeDataURL) {
                    try? FileManager.default.removeItem(at: resumeDataURL)
                    (temporary, _) = try await session.download(resumeFrom: resumeData)
                } else {
                    (temporary, _) = try await session.download(from: Self.url(for: file.name))
                }
            } catch {
                if let resumeData = (error as? URLError)?.downloadTaskResumeData {
                    try? resumeData.write(to: resumeDataURL)
                }
                throw error
            }

            try? FileManager.default.removeItem(at: destination)
            try FileManager.default.moveItem(at: temporary, to: destination)
            guard Self.size(of: destination) == file.size else {
                try? FileManager.default.removeItem(at: destination)
                throw URLError(.cannotDecodeContentData)
            }
            finishedBytes += file.size
            await onProgress(Double(finishedBytes) / total)
        }
    }

    private static func url(for name: String) -> URL {
        URL(string: "https://huggingface.co/\(GemmaModelStore.repository)/resolve/\(GemmaModelStore.revision)/\(name)")!
    }

    private static func size(of url: URL) -> Int64? {
        ((try? url.resourceValues(forKeys: [.fileSizeKey]))?.fileSize).map(Int64.init)
    }
}

/// Reports a download task's progress and connectivity waits.
private final class ProgressDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    private let onWaiting: @MainActor () -> Void
    private let onFraction: @Sendable (Double) async -> Void
    private var observation: NSKeyValueObservation?

    init(onWaiting: @escaping @MainActor () -> Void, onFraction: @escaping @Sendable (Double) async -> Void) {
        self.onWaiting = onWaiting
        self.onFraction = onFraction
    }

    func urlSession(_ session: URLSession, didCreateTask task: URLSessionTask) {
        let onFraction = onFraction
        observation = task.progress.observe(\.fractionCompleted) { progress, _ in
            let fraction = progress.fractionCompleted
            Task { await onFraction(fraction) }
        }
    }

    func urlSession(_ session: URLSession, taskIsWaitingForConnectivity task: URLSessionTask) {
        let onWaiting = onWaiting
        Task { @MainActor in onWaiting() }
    }
}
