import Foundation

/// Turns raw classifier predictions into the ranked, resolved list the user
/// sees.
///
/// Pure and synchronous on purpose: the ordering rules here are the ones most
/// worth pinning in tests, and none of them need a model, a network or a
/// device to exercise.
enum IdentificationRanker {
    /// The outcome of a ranking pass. Distinguishes the two "no answer" cases,
    /// because they call for different things from the user.
    enum Outcome: Equatable {
        /// Ranked candidates, best first. Never empty.
        case ranked([IdentificationResult])
        /// Predictions existed but none cleared the confidence floor.
        case noConfidentMatch
        /// Nothing plausible, and the device's region is not covered by any
        /// loaded pack — so the likely problem is a missing pack, not an
        /// unusual subject.
        case outsideLoadedPacks
    }

    /// Ranks `predictions` against the species the packs know about.
    ///
    /// - Parameters:
    ///   - predictions: raw classifier output.
    ///   - store: resolves label ids to field-guide content.
    ///   - source: who produced the predictions.
    ///   - region: the device's region, when a location fix is available.
    ///     Species that do not occur there are demoted rather than removed —
    ///     animals stray, and users travel, so a regional mismatch is evidence
    ///     and not a verdict.
    ///   - regionIsCovered: whether any loaded pack claims the region.
    static func rank(
        predictions: [SpeciesPrediction],
        store speciesByID: [String: SpeciesEntry],
        source: IdentificationSource,
        region: String?,
        regionIsCovered: Bool
    ) -> Outcome {
        let resolved: [(entry: SpeciesEntry, confidence: Double)] = predictions.compactMap {
            guard let entry = speciesByID[$0.speciesID] else { return nil }
            return (entry, $0.confidence)
        }

        let kept = resolved.filter {
            ConfidencePolicy.clearsFloor(
                SpeciesPrediction(speciesID: $0.entry.id, confidence: $0.confidence),
                dangerLevel: $0.entry.dangerLevel
            )
        }

        guard !kept.isEmpty else {
            return regionIsCovered ? .noConfidentMatch : .outsideLoadedPacks
        }

        var scored: [Scored] = []
        for candidate in kept {
            let rankingScore = score(for: candidate.entry, confidence: candidate.confidence, region: region)
            scored.append(Scored(entry: candidate.entry, confidence: candidate.confidence, score: rankingScore))
        }

        // Ties broken by name so the order is stable across runs — a list that
        // reshuffles between identical photos reads as the app being unsure of
        // itself.
        scored.sort { lhs, rhs in
            lhs.score == rhs.score ? lhs.entry.commonName < rhs.entry.commonName : lhs.score > rhs.score
        }

        // The reported confidence is the model's, not the region-adjusted
        // score. The prior decides ordering; it is not evidence about the
        // photo, so it must not inflate or deflate what the app claims to be
        // sure of.
        let ranked = scored.prefix(ConfidencePolicy.maximumResults).map { candidate in
            IdentificationResult(species: candidate.entry, confidence: candidate.confidence, source: source)
        }

        return .ranked(Array(ranked))
    }

    private struct Scored {
        let entry: SpeciesEntry
        let confidence: Double
        let score: Double
    }

    /// Ordering score: confidence, demoted when the species is not known to
    /// occur where the user is standing.
    private static func score(for entry: SpeciesEntry, confidence: Double, region: String?) -> Double {
        guard let region, !entry.regions.isEmpty, !entry.regions.contains(region) else {
            return confidence
        }
        return confidence * outOfRegionPenalty
    }

    /// Enough to push an out-of-region species below an in-region rival of
    /// similar confidence, not enough to bury a strong match.
    private static let outOfRegionPenalty = 0.4

    /// Merges a server answer into a local one.
    ///
    /// The server supersedes the device only when it is meaningfully more
    /// confident. Otherwise the local answer stands — the on-device path is
    /// the primary one, and a marginal remote improvement is not worth showing
    /// the user a different name for the same photo.
    static func merge(local: [IdentificationResult], server: [IdentificationResult]) -> [IdentificationResult] {
        guard let bestServer = server.first else { return local }
        guard let bestLocal = local.first else { return server }
        return bestServer.confidence >= bestLocal.confidence + serverSupersedeMargin ? server : local
    }

    private static let serverSupersedeMargin = 0.15
}
