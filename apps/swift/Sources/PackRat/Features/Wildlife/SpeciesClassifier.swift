import Foundation

/// A raw classifier output: a species id from the active packs and the model's
/// confidence in it. Deliberately *not* a `SpeciesEntry` — a model knows label
/// ids, and resolving those to field-guide content is the pack store's job.
struct SpeciesPrediction: Hashable, Sendable {
    let speciesID: String
    let confidence: Double
}

/// The on-device recogniser.
///
/// A protocol rather than a concrete type because the shipped artifact — a
/// MobileNetV4-class model distilled from BioCLIP 2 and converted to Core ML,
/// see `CoreMLSpeciesClassifier` — is produced by a separate pipeline on a
/// separate schedule from the app work. Everything upstream and downstream of this one method (capture,
/// ranking, the location prior, the result UI, history) is independent of
/// which model is behind it, so it is built and tested against this seam.
///
/// See `docs/features/offline-wildlife-id.md` for the model decision.
protocol SpeciesClassifier: Sendable {
    /// Classifies a JPEG/PNG image against `candidates`, returning predictions
    /// in no particular order. Ranking is the caller's job.
    func classify(imageData: Data, candidates: [SpeciesEntry]) async throws -> [SpeciesPrediction]

    /// Whether a real model is loaded. When false the app must say so rather
    /// than present a placeholder answer as an identification.
    var isModelAvailable: Bool { get }
}

/// The classifier for a build with no model in it — tests, and any build
/// where the model failed to load.
///
/// It reports `isModelAvailable == false` and returns nothing. That is a
/// deliberate choice over returning plausible-looking scores: the doc's rule
/// is that the app says what it does not know, and a placeholder that invents
/// confidences would make every surface downstream look correct while it is
/// being built against a lie. With this, the "no local model" path is the one
/// that renders, and it is a path that has to work anyway — a user whose pack
/// download failed sees exactly the same thing.
struct UnavailableSpeciesClassifier: SpeciesClassifier {
    var isModelAvailable: Bool { false }

    func classify(imageData: Data, candidates: [SpeciesEntry]) async throws -> [SpeciesPrediction] {
        []
    }
}

// MARK: - Confidence

/// The thresholds that decide whether a prediction is allowed to read as an
/// answer.
///
/// Centralised because the rule is a safety rule, not a display detail: a
/// low-confidence match on a dangerous species is a caution, not an
/// identification, and the UI must not be able to round that away.
enum ConfidencePolicy {
    /// Below this, nothing is shown as a match at all.
    static let floor = 0.15

    /// At or above this, the top result may be presented as a confident
    /// answer rather than a suggestion.
    static let confident = 0.65

    /// The most candidates ever shown. A ranked list is more truthful than a
    /// single verdict, but a long tail of near-zero guesses is noise.
    static let maximumResults = 5

    /// Dangerous species held to a lower bar for *inclusion*, so a plausible
    /// venomous match is never silently dropped off the end of the list. It
    /// still renders as a caution, not an identification.
    static let dangerousFloor = 0.05

    static func clearsFloor(_ prediction: SpeciesPrediction, dangerLevel: DangerLevel) -> Bool {
        prediction.confidence >= (dangerLevel == .dangerous ? dangerousFloor : floor)
    }

    /// Never rounded up in the user's favour.
    static func displayPercentage(_ confidence: Double) -> Int {
        Int((confidence * 100).rounded(.down))
    }
}
