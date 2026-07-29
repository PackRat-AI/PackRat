import Foundation
#if os(iOS)
import UIKit
#endif

final class UploadService: Sendable {
    static let shared = UploadService()
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    struct PresignedURLResponse: Decodable {
        let url: String
        let objectKey: String
        let publicUrl: String
    }

    /// Fetches a presigned R2 upload URL, uploads the data, returns the object's
    /// relative R2 key. The presign route's `publicUrl` field is derived from the
    /// private S3-API presigned URL origin (packrat-bucket-*.r2.cloudflarestorage.com),
    /// not the public R2.dev bucket domain, so it isn't actually fetchable — Expo
    /// ignores it too (apps/expo/features/packs/utils/uploadImage.ts returns
    /// remoteFileName, not data.publicUrl). Callers resolve the key to a fetchable
    /// URL via APIClient.resolvedImageURL.
    func upload(data: Data, fileName: String, mimeType: String) async throws -> String {
        // 1. Get presigned URL from API
        let endpoint = Endpoint(.get, "/api/upload/presigned", query: [
            "fileName": fileName,
            "contentType": mimeType,
        ])
        let presigned: PresignedURLResponse = try await api.send(endpoint)

        // 2. PUT directly to R2 presigned URL (no auth header needed)
        guard let uploadURL = URL(string: presigned.url) else {
            throw PackRatError.unknown
        }
        var request = URLRequest(url: uploadURL)
        request.httpMethod = "PUT"
        request.setValue(mimeType, forHTTPHeaderField: "Content-Type")
        request.httpBody = data

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw PackRatError.httpError(statusCode: (response as? HTTPURLResponse)?.statusCode ?? 0, message: "Upload failed")
        }

        return presigned.objectKey
    }

    #if os(macOS)
    func uploadImage(at url: URL, userId: String) async throws -> String {
        let data = try Data(contentsOf: url)
        let ext = url.pathExtension.lowercased()
        let mimeType = ext == "png" ? "image/png" : "image/jpeg"
        // The presign route requires the object key to start with `{userId}-`
        // (packages/api/src/routes/upload.ts) — matches Expo's remoteFileName convention.
        let fileName = "\(userId)-\(UUID().uuidString).\(ext)"
        return try await upload(data: data, fileName: fileName, mimeType: mimeType)
    }
    #endif

    #if os(iOS)
    func uploadUIImage(_ image: UIImage, userId: String, quality: CGFloat = 0.85) async throws -> String {
        guard let data = image.jpegData(compressionQuality: quality) else {
            throw PackRatError.unknown
        }
        // The presign route requires the object key to start with `{userId}-`
        // (packages/api/src/routes/upload.ts) — matches Expo's remoteFileName convention.
        let fileName = "\(userId)-\(UUID().uuidString).jpg"
        return try await upload(data: data, fileName: fileName, mimeType: "image/jpeg")
    }
    #endif
}
