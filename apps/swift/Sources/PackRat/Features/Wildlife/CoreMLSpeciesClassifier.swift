import CoreML
import Foundation
import ImageIO
import Sentry
import Vision

/// The on-device recogniser: a MobileNetV4 distilled from BioCLIP 2, run
/// through Core ML with Vision doing the scaling and orientation.
///
/// The model is a Core ML classifier whose labels are pack species ids plus
/// `__other__`, the catch-all it was trained to answer for subjects outside
/// the pack. Built by `apps/swift/ml/species-model`.
///
/// `@unchecked Sendable` because `VNCoreMLModel` is not marked `Sendable`. The
/// model is immutable after init and Vision allows concurrent requests
/// against one model, so sharing it is safe.
final class CoreMLSpeciesClassifier: SpeciesClassifier, @unchecked Sendable {
    /// The label for "none of the species this model knows". Never surfaced as
    /// a species; its share of the probability is what pulls the real
    /// candidates below the confidence floor when the subject is unfamiliar.
    static let otherLabel = "__other__"

    /// Loaded once per process: compiling the model for the Neural Engine is
    /// the slow part, and it should not repeat every time the screen opens.
    static let shared = CoreMLSpeciesClassifier()

    private static let modelResource = "WildlifeSpeciesModel"

    private let model: VNCoreMLModel?

    var isModelAvailable: Bool { model != nil }

    init(bundle: Bundle = .main) {
        model = Self.loadModel(from: bundle)
    }

    private static func loadModel(from bundle: Bundle) -> VNCoreMLModel? {
        guard let url = bundle.url(forResource: modelResource, withExtension: "mlmodelc") else {
            // Like a missing core pack, this is a build-configuration error a
            // user cannot fix, so it is worth reporting. The app still runs:
            // `isModelAvailable` is false and the screen says so.
            SentrySDK.capture(message: "Bundled species classifier is missing from the app bundle") { scope in
                scope.setTag(value: "wildlife", key: "feature")
                scope.setTag(value: "loadSpeciesModel", key: "action")
            }
            return nil
        }
        do {
            let configuration = MLModelConfiguration()
            configuration.computeUnits = .all
            return try VNCoreMLModel(for: MLModel(contentsOf: url, configuration: configuration))
        } catch {
            SentrySDK.capture(error: error) { scope in
                scope.setTag(value: "wildlife", key: "feature")
                scope.setTag(value: "loadSpeciesModel", key: "action")
            }
            return nil
        }
    }

    func classify(imageData: Data, candidates: [SpeciesEntry]) async throws -> [SpeciesPrediction] {
        guard let model else { return [] }
        let candidateIDs = Set(candidates.map(\.id))
        let orientation = Self.orientation(of: imageData)

        // Off the main actor: inference is tens of milliseconds on the Neural
        // Engine but much longer on first load, and the camera UI must not
        // stall while it runs.
        let observations = try await Task.detached(priority: .userInitiated) {
            let request = VNCoreMLRequest(model: model)
            // Matches the crop the model was validated with in export.py.
            request.imageCropAndScaleOption = .centerCrop
            try VNImageRequestHandler(data: imageData, orientation: orientation).perform([request])
            return request.results as? [VNClassificationObservation] ?? []
        }.value

        return observations.compactMap { observation in
            guard observation.identifier != Self.otherLabel,
                  candidateIDs.contains(observation.identifier)
            else { return nil }
            return SpeciesPrediction(speciesID: observation.identifier, confidence: Double(observation.confidence))
        }
    }

    /// Reads the EXIF orientation so a portrait photo is not classified on
    /// its side.
    private static func orientation(of imageData: Data) -> CGImagePropertyOrientation {
        guard let source = CGImageSourceCreateWithData(imageData as CFData, nil),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let raw = properties[kCGImagePropertyOrientation] as? UInt32,
              let orientation = CGImagePropertyOrientation(rawValue: raw)
        else { return .up }
        return orientation
    }
}
