import Foundation
import Sentry
import SwiftData

/// Drives one identification, local-first.
///
/// The ordering here is the feature's central decision: the on-device
/// classifier runs on every identification, and the server refines afterwards
/// when it is reachable. Server-first-with-local-fallback would make the
/// offline path a degraded mode that only runs once something has already gone
/// wrong — and a path that only runs on failure is one nobody notices has
/// rotted. See `docs/features/offline-wildlife-id.md`.
@Observable
@MainActor
final class OfflineWildlifeViewModel {
    /// What the screen is currently showing.
    enum State: Equatable {
        case idle
        case identifying
        case results([IdentificationResult])
        case noConfidentMatch
        /// The subject is probably outside the loaded packs — a different and
        /// more useful message than "no match", because it tells the user
        /// there is something they can do about it.
        case outsideLoadedPacks
        /// No local model is present on this device.
        case modelUnavailable
    }

    private(set) var state: State = .idle
    private(set) var isRefiningWithServer = false
    var errorMessage: String?

    /// The photo behind the current results, held so a save can stamp it onto
    /// the history row.
    private(set) var currentImageData: Data?

    private let classifier: SpeciesClassifier
    private let packStore: SpeciesPackStore
    private let locationProvider: WildlifeLocationProvider

    init(
        classifier: SpeciesClassifier = CoreMLSpeciesClassifier.shared,
        packStore: SpeciesPackStore = .shared,
        // Constructed in the body rather than as a default argument: a
        // default is evaluated in the caller's isolation, and
        // `WildlifeLocationProvider` is `@MainActor`.
        locationProvider: WildlifeLocationProvider? = nil
    ) {
        self.classifier = classifier
        self.packStore = packStore
        self.locationProvider = locationProvider ?? WildlifeLocationProvider()
    }

    var coverageSummary: String { packStore.coverageSummary }

    /// Asks for a location fix. Called when the screen appears, not when an
    /// identification starts, so the prior is usually ready by the time it is
    /// needed and never delays an answer.
    func prepare() {
        locationProvider.start()
    }

    // MARK: - Identify

    func identify(imageData: Data) async {
        currentImageData = imageData
        errorMessage = nil

        guard classifier.isModelAvailable else {
            state = .modelUnavailable
            return
        }

        state = .identifying

        let region = locationProvider.region
        let speciesByID = Dictionary(uniqueKeysWithValues: packStore.species.map { ($0.id, $0) })

        let localOutcome: IdentificationRanker.Outcome
        do {
            let predictions = try await classifier.classify(
                imageData: imageData,
                candidates: packStore.species
            )
            localOutcome = IdentificationRanker.rank(
                predictions: predictions,
                store: speciesByID,
                source: .offline,
                region: region,
                regionIsCovered: region.map(packStore.coversRegion) ?? true
            )
        } catch {
            SentrySDK.capture(error: error) { scope in
                scope.setTag(value: "wildlife", key: "feature")
                scope.setTag(value: "classifyOnDevice", key: "action")
            }
            errorMessage = "Identification failed on this device."
            state = .idle
            return
        }

        switch localOutcome {
        case .ranked(let results):
            state = .results(results)
            await refineWithServer(imageData: imageData, local: results)
        case .noConfidentMatch:
            state = .noConfidentMatch
        case .outsideLoadedPacks:
            state = .outsideLoadedPacks
        }
    }

    /// Consults the server after a local answer is already on screen.
    ///
    /// Best-effort throughout: the user has an answer, so a failure here is
    /// not something to interrupt them about. Unreachable is the expected case
    /// in the field, and it is not an error.
    private func refineWithServer(imageData: Data, local: [IdentificationResult]) async {
        isRefiningWithServer = true
        defer { isRefiningWithServer = false }

        do {
            let remote = try await WildlifeService.shared.identify(imageData: imageData)
            guard let entry = packStore.species(id: remote.commonName.speciesIDForm) else { return }
            let serverResults = [
                IdentificationResult(species: entry, confidence: remote.confidence, source: .online)
            ]
            let merged = IdentificationRanker.merge(local: local, server: serverResults)
            if case .results = state { state = .results(merged) }
        } catch {
            // Offline or a server error. The local answer stands.
        }
    }

    // MARK: - History

    /// Saves the current results to on-device history.
    func save(context: ModelContext) {
        guard case .results(let results) = state, let imageData = currentImageData else { return }
        let coordinate = locationProvider.coordinate
        context.insert(
            SavedIdentification(
                imageData: imageData,
                results: results,
                latitude: coordinate?.latitude,
                longitude: coordinate?.longitude
            )
        )
        do {
            try context.save()
        } catch {
            SentrySDK.capture(error: error) { scope in
                scope.setTag(value: "wildlife", key: "feature")
                scope.setTag(value: "saveIdentification", key: "action")
            }
            errorMessage = "Could not save this sighting."
        }
    }

    func reset() {
        state = .idle
        currentImageData = nil
        errorMessage = nil
    }
}

private extension String {
    /// The server names species in prose; packs key them by slug. Matching on
    /// the slug is a stopgap until the API returns a species id directly —
    /// tracked as part of the server-refine work in the feature doc.
    var speciesIDForm: String {
        lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }
}
