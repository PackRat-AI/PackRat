import Foundation

/// The shared wildlife domain model, mirroring
/// `apps/expo/features/wildlife/types.ts` — the canonical shape for both
/// platforms. The two apps differ in inference runtime, not in what a species
/// or an identification *is*, so these names track the TypeScript ones exactly
/// and the JSON decoding below is the contract between them.

// MARK: - Category

enum SpeciesCategory: String, Codable, CaseIterable, Sendable {
    case mammal
    case bird
    case reptile
    case amphibian
    case insect
    case plant
    case flower
    case tree
    case mushroom
    case fish
    case other

    /// SF Symbol used wherever a category needs a glyph.
    var symbolName: String {
        switch self {
        case .mammal: "pawprint.fill"
        case .bird: "bird.fill"
        case .reptile, .amphibian: "lizard.fill"
        case .insect: "ant.fill"
        case .plant, .flower: "leaf.fill"
        case .tree: "tree.fill"
        case .mushroom: "circle.hexagongrid.fill"
        case .fish: "fish.fill"
        case .other: "questionmark.circle.fill"
        }
    }

    /// Unknown categories decode as `.other` rather than failing the whole
    /// pack. A pack is shipped independently of the binary, so an older app
    /// will eventually meet a category it has never heard of; dropping one
    /// species' glyph is a better outcome than refusing to load the pack that
    /// contains it.
    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = SpeciesCategory(rawValue: raw) ?? .other
    }
}

// MARK: - Danger level

/// How much care the subject demands. A first-class field, not a detail: a
/// user photographing a mushroom or a snake is asking a safety question in the
/// grammar of a naming question.
enum DangerLevel: String, Codable, Comparable, Sendable {
    case safe
    case caution
    case dangerous

    private var severity: Int {
        switch self {
        case .safe: 0
        case .caution: 1
        case .dangerous: 2
        }
    }

    static func < (lhs: DangerLevel, rhs: DangerLevel) -> Bool {
        lhs.severity < rhs.severity
    }

    /// Unknown values decode as `.caution`. An app that cannot understand a
    /// danger rating must not render it as safe — the same pack-versioning
    /// reasoning as `SpeciesCategory`, but the failure direction matters far
    /// more here.
    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = DangerLevel(rawValue: raw) ?? .caution
    }
}

// MARK: - Species

struct SpeciesEntry: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let commonName: String
    let scientificName: String
    let category: SpeciesCategory
    let description: String
    let habitat: [String]
    let regions: [String]
    let dangerLevel: DangerLevel
    let characteristics: [String]
    let conservationStatus: String?
    let interestingFacts: [String]?
    let imageDescription: String?
}

// MARK: - Identification

/// Where an answer came from. Surfaced to the user, not hidden: they are
/// entitled to know whether the phone or the server named the thing.
enum IdentificationSource: String, Codable, Sendable {
    /// Produced by the on-device classifier.
    case offline
    /// Produced or refined by the server's larger model.
    case online

    var displayName: String {
        switch self {
        case .offline: "On this device"
        case .online: "PackRat server"
        }
    }
}

/// One ranked candidate. Fine-grained species identification is genuinely
/// ambiguous, so results travel as a ranked list rather than a single verdict.
struct IdentificationResult: Codable, Identifiable, Hashable, Sendable {
    let species: SpeciesEntry
    /// Normalized confidence in `[0, 1]`. Never rounded up in the user's
    /// favour — see `ConfidencePolicy`.
    let confidence: Double
    let source: IdentificationSource

    var id: String { "\(source.rawValue):\(species.id)" }
}
