import Foundation
#if os(iOS)
import UIKit
#endif

final class UploadService: Sendable {
    static let shared = UploadService()
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    struct PresignedURLResponse: Decodable {
        let uploadUrl: String
        let publicUrl: String
        let key: String
    }

    /// Fetches a presigned R2 upload URL, uploads the data, returns the public URL.
    func upload(data: Data, fileName: String, mimeType: String) async throws -> String {
        // 1. Get presigned URL from API
        let endpoint = Endpoint(.get, "/api/upload/presigned", query: [
            "fileName": fileName,
            "contentType": mimeType,
        ])
        let presigned: PresignedURLResponse = try await api.send(endpoint)

        // 2. PUT directly to R2 presigned URL (no auth header needed)
        guard let uploadURL = URL(string: presigned.uploadUrl) else {
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

        return presigned.publicUrl
    }

    #if os(macOS)
    func uploadImage(at url: URL) async throws -> String {
        let data = try Data(contentsOf: url)
        let ext = url.pathExtension.lowercased()
        let mimeType = ext == "png" ? "image/png" : "image/jpeg"
        let fileName = "\(UUID().uuidString).\(ext)"
        return try await upload(data: data, fileName: fileName, mimeType: mimeType)
    }
    #endif

    #if os(iOS)
    func uploadUIImage(_ image: UIImage, quality: CGFloat = 0.85) async throws -> String {
        guard let data = image.jpegData(compressionQuality: quality) else {
            throw PackRatError.unknown
        }
        let fileName = "\(UUID().uuidString).jpg"
        return try await upload(data: data, fileName: fileName, mimeType: "image/jpeg")
    }
    #endif
}
