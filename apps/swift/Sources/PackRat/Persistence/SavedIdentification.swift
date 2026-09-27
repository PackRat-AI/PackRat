import Foundation
import SwiftData

/// A wildlife identification kept on the device.
///
/// Local and durable by design, not a cache of something the server owns: a
/// recorded sighting is worth more than the moment it was made in, and the
/// places worth identifying wildlife in are the places with no signal. There
/// is no `Cached` prefix for exactly that reason — this row is the original,
/// not a mirror of an API resource.
@Model
final class SavedIdentification {
    @Attribute(.unique) var id: String
    /// The photo, stored externally so a long history does not bloat the
    /// SwiftData store file.
    @Attribute(.externalStorage) var imageData: Data?
    var timestamp: Date
    /// The ranked results, encoded as JSON. Kept whole rather than flattened
    /// into columns because what was shown to the user — every candidate, its
    /// confidence, and who answered — is the thing worth preserving, and a
    /// future pack version must not silently rewrite a past sighting.
    var resultsData: Data?
    var notes: String?
    var latitude: Double?
    var longitude: Double?
    var locationName: String?

    init(
        id: String = UUID().uuidString,
        imageData: Data?,
        results: [IdentificationResult],
        timestamp: Date = Date(),
        notes: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil,
        locationName: String? = nil
    ) {
        self.id = id
        self.imageData = imageData
        self.timestamp = timestamp
        self.resultsData = try? JSONEncoder().encode(results)
        self.notes = notes
        self.latitude = latitude
        self.longitude = longitude
        self.locationName = locationName
    }

    /// The ranked results as recorded. Returns empty rather than throwing: a
    /// sighting whose results can no longer be decoded still has a photo, a
    /// time and a place, and those are worth showing.
    var results: [IdentificationResult] {
        guard let resultsData else { return [] }
        return (try? JSONDecoder().decode([IdentificationResult].self, from: resultsData)) ?? []
    }

    /// The name this sighting is filed under — the top-ranked candidate.
    var primaryName: String {
        results.first?.species.commonName ?? "Unidentified"
    }

    /// The highest danger level among the candidates, so a list row can warn
    /// even when the top match is harmless but a plausible alternative is not.
    var highestDangerLevel: DangerLevel? {
        results.map(\.species.dangerLevel).max()
    }
}
