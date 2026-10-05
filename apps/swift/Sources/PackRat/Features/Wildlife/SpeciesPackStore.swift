import Foundation
import Sentry

/// One species pack: a versioned set of species the on-device recogniser can
/// name. The core pack ships in the app bundle; regional packs arrive later
/// through Background Assets and are cached on disk. Both decode from this
/// shape, so the loader does not care which it is holding.
struct SpeciesPack: Codable, Identifiable, Sendable {
    let id: String
    /// Bumped whenever the pack's content changes. Packs ship independently of
    /// the binary, so this — not the app version — decides which copy wins.
    let version: Int
    let displayName: String
    let regions: [String]
    let species: [SpeciesEntry]
}

/// Loads the species packs available on this device and answers lookups over
/// their union.
///
/// The store is deliberately the only thing that knows where packs come from.
/// The classifier asks it for the active species and gets the same answer
/// whether the app is running on a bundled core pack alone or on several
/// downloaded regional packs, which is what lets the Background Assets work
/// land later without touching the recognition path.
@Observable
@MainActor
final class SpeciesPackStore {
    static let shared = SpeciesPackStore()

    /// The core pack's filename in the app bundle, produced by
    /// `bun swift:species-pack`.
    private static let corePackResource = "core"

    private(set) var packs: [SpeciesPack] = []

    /// Every species across the loaded packs, deduplicated by id. When two
    /// packs carry the same species, the one from the higher-versioned pack
    /// wins — a regional pack is expected to correct the core pack, not the
    /// other way round.
    private(set) var species: [SpeciesEntry] = []

    private var speciesByID: [String: SpeciesEntry] = [:]

    init() {
        loadBundledCorePack()
    }

    // MARK: - Loading

    /// Loads the pack that ships inside the binary.
    ///
    /// This runs at init and needs no network, no download and no prior online
    /// moment — the feature has to be able to identify something the first
    /// time the app opens, standing at a trailhead with no signal.
    func loadBundledCorePack() {
        guard let url = Bundle.main.url(forResource: Self.corePackResource, withExtension: "json") else {
            // A missing bundled pack is a build-configuration error, not a
            // runtime condition a user can fix, so it is worth reporting.
            SentrySDK.capture(message: "Bundled core species pack is missing from the app bundle") { scope in
                scope.setTag(value: "wildlife", key: "feature")
                scope.setTag(value: "loadCorePack", key: "action")
            }
            return
        }
        load(from: url)
    }

    /// Loads a pack from a file on disk. The entry point regional packs will
    /// use once Background Assets delivers them.
    func load(from url: URL) {
        do {
            let pack = try JSONDecoder().decode(SpeciesPack.self, from: Data(contentsOf: url))
            register(pack)
        } catch {
            SentrySDK.capture(error: error) { scope in
                scope.setTag(value: "wildlife", key: "feature")
                scope.setTag(value: "loadSpeciesPack", key: "action")
            }
        }
    }

    /// Adds a pack to the active set, replacing any earlier copy of the same
    /// pack id.
    func register(_ pack: SpeciesPack) {
        packs.removeAll { $0.id == pack.id }
        packs.append(pack)
        rebuildIndex()
    }

    private func rebuildIndex() {
        var index: [String: (version: Int, entry: SpeciesEntry)] = [:]
        for pack in packs {
            for entry in pack.species {
                if let existing = index[entry.id], existing.version >= pack.version { continue }
                index[entry.id] = (pack.version, entry)
            }
        }
        speciesByID = index.mapValues(\.entry)
        species = speciesByID.values.sorted { $0.commonName < $1.commonName }
    }

    // MARK: - Lookup

    func species(id: String) -> SpeciesEntry? {
        speciesByID[id]
    }

    /// Whether any loaded pack claims to cover `region`.
    ///
    /// Drives the difference between "no confident match" and "not in the
    /// species pack you have loaded" — one says the subject is unusual, the
    /// other tells the user to download something.
    func coversRegion(_ region: String) -> Bool {
        packs.contains { $0.regions.contains(region) }
    }

    /// What the loaded packs actually cover, for the UI to state plainly
    /// rather than imply.
    var coverageSummary: String {
        let count = species.count
        let names = packs.map(\.displayName).sorted().joined(separator: ", ")
        return "\(count) species · \(names)"
    }
}
