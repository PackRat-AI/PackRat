import Foundation
import Testing
@testable import PackRat

@Suite("Watch snapshot")
struct WatchSnapshotTests {
    @Test("fallback snapshot is useful before phone sync")
    func fallbackSnapshotIsUsefulBeforePhoneSync() throws {
        let snapshot = PackRatWatchSnapshot.fallback

        #expect(snapshot.pack.name == "Alpine Weekend")
        #expect(!snapshot.pack.checklist.isEmpty)
        #expect(snapshot.weather.temperatureText == "64°")
        #expect(snapshot.trail.conditionText == "Good")
    }

    @Test("snapshot round-trips through JSON")
    func snapshotRoundTripsThroughJSON() throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let data = try encoder.encode(PackRatWatchSnapshot.fallback)
        let decoded = try decoder.decode(PackRatWatchSnapshot.self, from: data)

        #expect(decoded == PackRatWatchSnapshot.fallback)
    }
}
