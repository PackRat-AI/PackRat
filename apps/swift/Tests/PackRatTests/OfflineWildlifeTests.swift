import CoreLocation
import CoreML
import Foundation
import Testing
@testable import PackRat

// MARK: - Fixtures

private func species(
    id: String,
    name: String? = nil,
    danger: DangerLevel = .safe,
    regions: [String] = ["north-america"]
) -> SpeciesEntry {
    SpeciesEntry(
        id: id,
        commonName: name ?? id,
        scientificName: "Testus \(id)",
        category: .mammal,
        description: "A test species.",
        habitat: ["forests"],
        regions: regions,
        dangerLevel: danger,
        characteristics: ["testable"],
        conservationStatus: nil,
        interestingFacts: nil,
        imageDescription: nil
    )
}

private func index(_ entries: [SpeciesEntry]) -> [String: SpeciesEntry] {
    Dictionary(uniqueKeysWithValues: entries.map { ($0.id, $0) })
}

private func results(_ outcome: IdentificationRanker.Outcome) -> [IdentificationResult] {
    guard case .ranked(let results) = outcome else { return [] }
    return results
}

// MARK: - Ranking

@Suite("IdentificationRanker")
struct IdentificationRankerTests {
    @Test("orders candidates by confidence, best first")
    func ordersByConfidence() {
        let entries = [species(id: "a"), species(id: "b"), species(id: "c")]
        let outcome = IdentificationRanker.rank(
            predictions: [
                SpeciesPrediction(speciesID: "a", confidence: 0.3),
                SpeciesPrediction(speciesID: "b", confidence: 0.9),
                SpeciesPrediction(speciesID: "c", confidence: 0.6),
            ],
            store: index(entries),
            source: .offline,
            region: nil,
            regionIsCovered: true
        )

        #expect(results(outcome).map(\.species.id) == ["b", "c", "a"])
    }

    @Test("returns a ranked list rather than a single verdict")
    func returnsRankedList() {
        let entries = [species(id: "a"), species(id: "b")]
        let outcome = IdentificationRanker.rank(
            predictions: [
                SpeciesPrediction(speciesID: "a", confidence: 0.9),
                SpeciesPrediction(speciesID: "b", confidence: 0.5),
            ],
            store: index(entries),
            source: .offline,
            region: nil,
            regionIsCovered: true
        )

        #expect(results(outcome).count == 2)
    }

    @Test("caps the list so a long tail of weak guesses is not shown")
    func capsListLength() {
        let entries = (0..<12).map { species(id: "s\($0)") }
        let predictions = (0..<12).map {
            SpeciesPrediction(speciesID: "s\($0)", confidence: 0.9 - Double($0) * 0.05)
        }
        let outcome = IdentificationRanker.rank(
            predictions: predictions,
            store: index(entries),
            source: .offline,
            region: nil,
            regionIsCovered: true
        )

        #expect(results(outcome).count == ConfidencePolicy.maximumResults)
    }

    @Test("drops candidates below the confidence floor")
    func dropsBelowFloor() {
        let entries = [species(id: "strong"), species(id: "noise")]
        let outcome = IdentificationRanker.rank(
            predictions: [
                SpeciesPrediction(speciesID: "strong", confidence: 0.8),
                SpeciesPrediction(speciesID: "noise", confidence: 0.02),
            ],
            store: index(entries),
            source: .offline,
            region: nil,
            regionIsCovered: true
        )

        #expect(results(outcome).map(\.species.id) == ["strong"])
    }

    @Test("keeps a weak dangerous candidate that a safe one at the same score loses")
    func keepsWeakDangerousCandidate() {
        let entries = [species(id: "venomous", danger: .dangerous), species(id: "harmless")]
        let weak = 0.08 // between dangerousFloor and floor
        let outcome = IdentificationRanker.rank(
            predictions: [
                SpeciesPrediction(speciesID: "venomous", confidence: weak),
                SpeciesPrediction(speciesID: "harmless", confidence: weak),
            ],
            store: index(entries),
            source: .offline,
            region: nil,
            regionIsCovered: true
        )

        #expect(results(outcome).map(\.species.id) == ["venomous"])
    }

    @Test("demotes a species that does not occur where the user is standing")
    func demotesOutOfRegion() {
        let entries = [
            species(id: "elsewhere", regions: ["asia"]),
            species(id: "here", regions: ["north-america"]),
        ]
        let outcome = IdentificationRanker.rank(
            predictions: [
                SpeciesPrediction(speciesID: "elsewhere", confidence: 0.8),
                SpeciesPrediction(speciesID: "here", confidence: 0.5),
            ],
            store: index(entries),
            source: .offline,
            region: "north-america",
            regionIsCovered: true
        )

        #expect(results(outcome).map(\.species.id) == ["here", "elsewhere"])
    }

    @Test("demotes rather than removes an out-of-region species")
    func keepsOutOfRegionCandidate() {
        let entries = [species(id: "stray", regions: ["asia"])]
        let outcome = IdentificationRanker.rank(
            predictions: [SpeciesPrediction(speciesID: "stray", confidence: 0.9)],
            store: index(entries),
            source: .offline,
            region: "north-america",
            regionIsCovered: true
        )

        #expect(results(outcome).map(\.species.id) == ["stray"])
    }

    @Test("reports the model's confidence, not the region-adjusted score")
    func reportsUnadjustedConfidence() {
        let entries = [species(id: "stray", regions: ["asia"])]
        let outcome = IdentificationRanker.rank(
            predictions: [SpeciesPrediction(speciesID: "stray", confidence: 0.9)],
            store: index(entries),
            source: .offline,
            region: "north-america",
            regionIsCovered: true
        )

        #expect(results(outcome).first?.confidence == 0.9)
    }

    @Test("ignores the prior entirely when no location fix is available")
    func noRegionMeansNoPrior() {
        let entries = [
            species(id: "elsewhere", regions: ["asia"]),
            species(id: "here", regions: ["north-america"]),
        ]
        let outcome = IdentificationRanker.rank(
            predictions: [
                SpeciesPrediction(speciesID: "elsewhere", confidence: 0.8),
                SpeciesPrediction(speciesID: "here", confidence: 0.5),
            ],
            store: index(entries),
            source: .offline,
            region: nil,
            regionIsCovered: true
        )

        #expect(results(outcome).map(\.species.id) == ["elsewhere", "here"])
    }

    @Test("says 'no confident match' when the region is covered but nothing scores")
    func noConfidentMatchWhenCovered() {
        let outcome = IdentificationRanker.rank(
            predictions: [SpeciesPrediction(speciesID: "a", confidence: 0.01)],
            store: index([species(id: "a")]),
            source: .offline,
            region: "north-america",
            regionIsCovered: true
        )

        #expect(outcome == .noConfidentMatch)
    }

    @Test("says the subject is outside the loaded packs when the region is not covered")
    func outsidePacksWhenRegionUncovered() {
        let outcome = IdentificationRanker.rank(
            predictions: [SpeciesPrediction(speciesID: "a", confidence: 0.01)],
            store: index([species(id: "a")]),
            source: .offline,
            region: "africa",
            regionIsCovered: false
        )

        #expect(outcome == .outsideLoadedPacks)
    }

    @Test("skips predictions naming species no loaded pack knows")
    func skipsUnknownLabels() {
        let outcome = IdentificationRanker.rank(
            predictions: [SpeciesPrediction(speciesID: "not-in-any-pack", confidence: 0.99)],
            store: index([species(id: "a")]),
            source: .offline,
            region: nil,
            regionIsCovered: true
        )

        #expect(outcome == .noConfidentMatch)
    }

    @Test("orders ties by name so repeated runs do not reshuffle")
    func stableTieBreaking() {
        let entries = [species(id: "b", name: "Beta"), species(id: "a", name: "Alpha")]
        let outcome = IdentificationRanker.rank(
            predictions: [
                SpeciesPrediction(speciesID: "b", confidence: 0.5),
                SpeciesPrediction(speciesID: "a", confidence: 0.5),
            ],
            store: index(entries),
            source: .offline,
            region: nil,
            regionIsCovered: true
        )

        #expect(results(outcome).map(\.species.id) == ["a", "b"])
    }
}

// MARK: - Server refinement

@Suite("IdentificationRanker.merge")
struct IdentificationMergeTests {
    private func result(_ id: String, _ confidence: Double, _ source: IdentificationSource) -> IdentificationResult {
        IdentificationResult(species: species(id: id), confidence: confidence, source: source)
    }

    @Test("keeps the local answer when the server is only marginally better")
    func keepsLocalOnMarginalGain() {
        let local = [result("local", 0.70, .offline)]
        let server = [result("server", 0.75, .online)]

        #expect(IdentificationRanker.merge(local: local, server: server).map(\.species.id) == ["local"])
    }

    @Test("takes the server answer when it is meaningfully more confident")
    func supersedesOnMeaningfulGain() {
        let local = [result("local", 0.40, .offline)]
        let server = [result("server", 0.95, .online)]

        #expect(IdentificationRanker.merge(local: local, server: server).map(\.species.id) == ["server"])
    }

    @Test("keeps the local answer when the server returns nothing")
    func keepsLocalWhenServerSilent() {
        let local = [result("local", 0.40, .offline)]

        #expect(IdentificationRanker.merge(local: local, server: []).map(\.species.id) == ["local"])
    }
}

// MARK: - Confidence policy

@Suite("ConfidencePolicy")
struct ConfidencePolicyTests {
    @Test("never rounds a confidence up in the user's favour")
    func roundsDown() {
        #expect(ConfidencePolicy.displayPercentage(0.6999) == 69)
        #expect(ConfidencePolicy.displayPercentage(0.499) == 49)
    }

    @Test("holds dangerous species to a lower inclusion bar than safe ones")
    func dangerousFloorIsLower() {
        let weak = SpeciesPrediction(speciesID: "x", confidence: 0.08)

        #expect(ConfidencePolicy.clearsFloor(weak, dangerLevel: .dangerous))
        #expect(!ConfidencePolicy.clearsFloor(weak, dangerLevel: .safe))
    }
}

// MARK: - Danger level

@Suite("DangerLevel")
struct DangerLevelTests {
    @Test("orders by severity so the worst candidate can be surfaced")
    func ordersBySeverity() {
        #expect([DangerLevel.safe, .dangerous, .caution].max() == .dangerous)
    }

    @Test("decodes an unrecognised rating as caution, never as safe")
    func unknownDecodesAsCaution() throws {
        let decoded = try JSONDecoder().decode(DangerLevel.self, from: Data(#""lethal""#.utf8))

        #expect(decoded == .caution)
    }
}

// MARK: - Region prior

@Suite("WildlifeLocationProvider.region")
struct WildlifeRegionTests {
    @Test("maps coordinates to the pack region vocabulary")
    func mapsKnownRegions() {
        let cases: [(CLLocationCoordinate2D, String)] = [
            (CLLocationCoordinate2D(latitude: 44.0, longitude: -72.0), "north-america"),
            (CLLocationCoordinate2D(latitude: 48.85, longitude: 2.35), "europe"),
            (CLLocationCoordinate2D(latitude: 35.68, longitude: 139.69), "asia"),
            (CLLocationCoordinate2D(latitude: -33.87, longitude: 151.21), "oceania"),
        ]

        for (coordinate, expected) in cases {
            #expect(WildlifeLocationProvider.region(for: coordinate) == expected)
        }
    }

    @Test("yields no region mid-ocean so the ranker falls back to no prior")
    func unknownCoordinateYieldsNil() {
        let midPacific = CLLocationCoordinate2D(latitude: 0, longitude: -150)

        #expect(WildlifeLocationProvider.region(for: midPacific) == nil)
    }
}

// MARK: - Species pack

@Suite("SpeciesPack decoding")
struct SpeciesPackTests {
    /// The pack that actually ships. Read from the repo rather than the test
    /// bundle so a malformed generated pack fails here, not on a user's phone.
    private static func bundledCorePackData() throws -> Data {
        let repoRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent() // PackRatTests
            .deletingLastPathComponent() // Tests
            .deletingLastPathComponent() // swift
        let url = repoRoot.appending(path: "Resources/SpeciesPacks/core.json")
        return try Data(contentsOf: url)
    }

    @Test("the bundled core pack decodes into the shared domain model")
    func corePackDecodes() throws {
        let pack = try JSONDecoder().decode(SpeciesPack.self, from: Self.bundledCorePackData())

        #expect(pack.id == "core")
        #expect(pack.version >= 1)
        #expect(pack.species.count >= 20)
    }

    @Test("every bundled species carries a danger rating and a region")
    func corePackIsComplete() throws {
        let pack = try JSONDecoder().decode(SpeciesPack.self, from: Self.bundledCorePackData())

        for entry in pack.species {
            #expect(!entry.commonName.isEmpty)
            #expect(!entry.scientificName.isEmpty)
            #expect(!entry.regions.isEmpty, "\(entry.id) has no region, so the prior cannot place it")
        }
    }

    @Test("the pack includes dangerous species, which are the ones that matter most")
    func corePackCoversDangerousSpecies() throws {
        let pack = try JSONDecoder().decode(SpeciesPack.self, from: Self.bundledCorePackData())

        #expect(pack.species.contains { $0.dangerLevel == .dangerous })
    }

    @Test("an unrecognised category decodes as other rather than failing the pack")
    func unknownCategoryDegradesGracefully() throws {
        let json = Data(#""tardigrade""#.utf8)

        #expect(try JSONDecoder().decode(SpeciesCategory.self, from: json) == .other)
    }
}

// MARK: - Classifier seam

@Suite("UnavailableSpeciesClassifier")
struct UnavailableClassifierTests {
    @Test("reports no model rather than inventing confidences")
    func reportsUnavailable() async throws {
        let classifier = UnavailableSpeciesClassifier()

        #expect(!classifier.isModelAvailable)
        #expect(try await classifier.classify(imageData: Data(), candidates: []).isEmpty)
    }
}

@Suite("CoreMLSpeciesClassifier")
struct CoreMLClassifierTests {
    @Test("a bundle without the model reports unavailable and answers nothing")
    func missingModel() async throws {
        let classifier = CoreMLSpeciesClassifier(bundle: Bundle(for: BundleMarker.self))

        #expect(!classifier.isModelAvailable)
        #expect(try await classifier.classify(imageData: Data(), candidates: []).isEmpty)
    }

    @Test("the bundled model loads and knows every core-pack species")
    @MainActor
    func bundledModelCoversCorePack() throws {
        #expect(CoreMLSpeciesClassifier.shared.isModelAvailable)

        // A pack species the model has no label for could never be
        // identified, and the app would not say why. Retraining is the fix.
        let url = try #require(Bundle.main.url(forResource: "WildlifeSpeciesModel", withExtension: "mlmodelc"))
        let labels = try MLModel(contentsOf: url).modelDescription.classLabels as? [String] ?? []
        let packIDs = Set(SpeciesPackStore().species.map(\.id))

        #expect(packIDs.isSubset(of: Set(labels)))
        #expect(labels.contains(CoreMLSpeciesClassifier.otherLabel))
    }
}

/// Anchors `Bundle(for:)` to the test bundle, which carries no model.
private final class BundleMarker {}
