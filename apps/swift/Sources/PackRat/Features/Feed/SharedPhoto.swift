import CoreTransferable
import ImageIO
import SwiftUI
import UniformTypeIdentifiers

/// A post photo as it leaves the app through the share sheet: the photo with
/// a small PackRat mark in the bottom corner.
///
/// Rendered lazily, when the user picks a destination, so opening the share
/// menu costs nothing.
struct SharedPhoto: Transferable {
    let imageKey: String

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .jpeg) { photo in
            try await photo.renderJPEG()
        }
        .suggestedFileName("PackRat.jpg")
    }

    enum RenderError: Error {
        case unavailable
    }

    func renderJPEG() async throws -> Data {
        guard let url = APIClient.resolvedImageURL(imageKey) else { throw RenderError.unavailable }
        let (data, _) = try await URLSession.shared.data(from: url)
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let photo = FeedPhotoProcessing.downsample(source, maxPixelSize: FeedPhotoProcessing.maxUploadPixelSize)
        else { throw RenderError.unavailable }

        let marked = await MainActor.run { Self.watermarked(photo) }
        guard let jpeg = FeedPhotoProcessing.jpegData(marked ?? photo) else { throw RenderError.unavailable }
        return jpeg
    }

    @MainActor
    static func watermarked(_ photo: CGImage) -> CGImage? {
        let renderer = ImageRenderer(content: WatermarkedPhotoView(photo: photo))
        renderer.scale = 1
        return renderer.cgImage
    }
}

private struct WatermarkedPhotoView: View {
    let photo: CGImage

    var body: some View {
        let width = CGFloat(photo.width)
        let height = CGFloat(photo.height)
        // Scaled to the photo so the mark reads the same on any resolution.
        let mark = max(width, height) * 0.034

        Image(decorative: photo, scale: 1)
            .resizable()
            .frame(width: width, height: height)
            .overlay(alignment: .bottomTrailing) {
                HStack(spacing: mark * 0.32) {
                    Image("AppLogo")
                        .resizable()
                        .scaledToFit()
                        .frame(width: mark, height: mark)
                        .clipShape(RoundedRectangle(cornerRadius: mark * 0.24, style: .continuous))
                    Text("PackRat")
                        .font(.system(size: mark * 0.6, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                }
                .padding(.leading, mark * 0.28)
                .padding(.trailing, mark * 0.45)
                .padding(.vertical, mark * 0.24)
                .background(.black.opacity(0.38), in: Capsule())
                .padding(mark * 0.6)
            }
    }
}
