import Foundation

/// Detects gear items in a photo and matches them against the catalog.
///
/// Three-step flow, matching Expo's
/// (apps/expo/features/packs/hooks/useImageDetection.ts):
///   1. presign + PUT the image to R2 (`UploadService`)
///   2. POST the resulting object key to `/api/packs/analyze-image`
///   3. the server analyzes it and **deletes the R2 object**
///
/// Step 3 makes analysis one-shot: re-analyzing the same photo needs a fresh
/// upload, so callers must not retry step 2 with a spent key.
final class ImageDetectionService: Sendable {
    static let shared = ImageDetectionService()

    private let api: APIClient
    private let uploader: UploadService

    init(api: APIClient = .shared, uploader: UploadService = .shared) {
        self.api = api
        self.uploader = uploader
    }

    /// Analyzes an already-uploaded R2 object key.
    ///
    /// `objectKey` must start with `{userId}-` or the route returns 403 — the
    /// server checks the prefix to stop one user analyzing another's upload.
    /// `UploadService` builds keys that way already.
    func analyze(objectKey: String, matchLimit: Int = 1) async throws -> [DetectedItemWithMatches] {
        let endpoint = Endpoint(
            .post,
            "/api/packs/analyze-image",
            body: AnalyzeImageRequest(image: objectKey, matchLimit: matchLimit)
        )
        return try await api.send(endpoint, as: [DetectedItemWithMatches].self)
    }

    /// Uploads raw JPEG data, then analyzes it.
    func detectItems(
        imageData: Data,
        userId: String,
        matchLimit: Int = 1
    ) async throws -> [DetectedItemWithMatches] {
        let fileName = "\(userId)-\(UUID().uuidString).jpg"
        let objectKey = try await uploader.upload(
            data: imageData,
            fileName: fileName,
            mimeType: "image/jpeg"
        )
        return try await analyze(objectKey: objectKey, matchLimit: matchLimit)
    }
}
