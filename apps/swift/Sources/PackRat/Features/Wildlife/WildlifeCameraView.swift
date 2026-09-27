#if os(iOS)
import AVFoundation
import SwiftUI
import UIKit

/// Live camera capture for identification.
///
/// The camera is the primary entry point, not the photo library: this is a
/// thing you do while standing in front of the subject, and routing it through
/// a picker adds two taps and a mental context switch to the one moment where
/// the animal might still be there.
///
/// iOS only. The macOS target builds the same sources but is sandboxed without
/// a camera entitlement, so it keeps the library picker.
struct WildlifeCameraView: UIViewControllerRepresentable {
    let onCapture: (Data) -> Void
    let onCancel: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onCapture: onCapture, onCancel: onCancel)
    }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let controller = UIImagePickerController()
        // Falls back to the library when no camera exists — the simulator,
        // mostly. A crash there would make the feature untestable off-device.
        controller.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        private let onCapture: (Data) -> Void
        private let onCancel: () -> Void

        init(onCapture: @escaping (Data) -> Void, onCancel: @escaping () -> Void) {
            self.onCapture = onCapture
            self.onCancel = onCancel
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            guard let image = info[.originalImage] as? UIImage,
                  // Compressed before it goes anywhere. The classifier
                  // downsamples to its own input size regardless, and a saved
                  // sighting keeps this copy on the device forever.
                  let data = image.jpegData(compressionQuality: 0.8)
            else {
                onCancel()
                return
            }
            onCapture(data)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onCancel()
        }
    }
}
#endif
