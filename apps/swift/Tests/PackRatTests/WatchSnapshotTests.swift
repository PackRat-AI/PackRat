import Foundation
import Testing
@testable import PackRat

@Suite("Watch snapshot")
struct WatchSnapshotTests {
    @Test("fallback snapshot is clearly unsynced before phone data arrives")
    func fallbackSnapshotIsClearlyUnsyncedBeforePhoneDataArrives() throws {
        let snapshot = PackRatWatchSnapshot.fallback

        #expect(snapshot.pack.name == "No Pack Synced")
        #expect(snapshot.pack.checklist.isEmpty)
        #expect(snapshot.pack.totalItemCount == 0)
        #expect(snapshot.trip == nil)
        #expect(snapshot.weather.locationName == "No Location")
        #expect(snapshot.weather.temperatureText == "--")
        #expect(snapshot.trail.conditionText == "None")
    }

    @Test("fallback snapshot does not contain screenshot fixture content")
    func fallbackSnapshotDoesNotContainScreenshotFixtureContent() throws {
        let encoded = try JSONEncoder().encode(PackRatWatchSnapshot.fallback)
        let payload = String(decoding: encoded, as: UTF8.self)

        #expect(!payload.contains("Alpine Weekend"))
        #expect(!payload.contains("Denver"))
        #expect(!payload.contains("Local Trail Prep"))
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

    @Test("visual synced sample represents a real companion sync")
    func visualSyncedSampleRepresentsRealCompanionSync() throws {
        let snapshot = PackRatWatchSnapshot.visualSyncedSample

        #expect(snapshot.pack.name == "Alpine Weekend")
        #expect(snapshot.pack.totalItemCount > 0)
        #expect(!snapshot.pack.checklist.isEmpty)
        #expect(snapshot.trip?.name == "Indian Peaks Overnight")
        #expect(snapshot.weather.temperatureText != "--")
        #expect(snapshot.trail.hazardCount > 0)
    }
}
