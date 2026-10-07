import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

/// Prepares a picked or captured photo for upload.
///
/// Downsamples to a long edge that looks sharp on a phone screen and
/// re-encodes as JPEG from the decoded pixels alone. No source properties are
/// copied into the output, so EXIF, GPS and maker metadata never leave the
/// device — the spec's "location data is removed before upload". Orientation is
/// baked into the pixels by the thumbnail transform, so dropping the EXIF
/// orientation tag cannot rotate the photo.
enum FeedPhotoProcessing {
    static let maxUploadPixelSize = 2048
    static let previewPixelSize = 360

    struct Prepared {
        let jpeg: Data
        let preview: CGImage
    }

    static func prepare(_ data: Data) -> Prepared? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let full = downsample(source, maxPixelSize: maxUploadPixelSize),
              let jpeg = jpegData(full),
              let preview = downsample(source, maxPixelSize: previewPixelSize)
        else { return nil }
        return Prepared(jpeg: jpeg, preview: preview)
    }

    static func downsample(_ source: CGImageSource, maxPixelSize: Int) -> CGImage? {
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
        ]
        return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    }

    static func jpegData(_ image: CGImage, quality: Double = 0.85) -> Data? {
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(
            output as CFMutableData, UTType.jpeg.identifier as CFString, 1, nil
        ) else { return nil }
        let properties: [CFString: Any] = [kCGImageDestinationLossyCompressionQuality: quality]
        CGImageDestinationAddImage(destination, image, properties as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { return nil }
        return output as Data
    }
}
