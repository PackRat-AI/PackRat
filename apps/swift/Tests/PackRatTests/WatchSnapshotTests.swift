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

    @Test("a payload from a phone build that predates isPro still decodes, as not-Pro")
    func decodesPayloadWithoutIsPro() throws {
        // A watch app can outlive the phone build that last published to it, so
        // the snapshot has to tolerate a missing key rather than failing the
        // whole decode and falling back to a blank watch face. The value it
        // lands on must be false: an old phone cannot vouch for Pro status.
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let legacyPayload = """
        {
          "updatedAt": "2026-08-31T12:00:00Z",
          "pack": {
            "name": "Alpine Weekend",
            "baseWeightText": "10.4 lb",
            "packedItemCount": 1,
            "totalItemCount": 2,
            "checklist": []
          },
          "weather": {
            "locationName": "Brainard Lake",
            "temperatureText": "64°",
            "conditionText": "Partly Cloudy",
            "symbolName": "cloud.sun"
          },
          "trail": {
            "title": "Pawnee Pass",
            "conditionText": "Muddy",
            "hazardCount": 0
          }
        }
        """.data(using: .utf8)!

        let decoded = try decoder.decode(PackRatWatchSnapshot.self, from: legacyPayload)
        #expect(decoded.isPro == false)
        #expect(decoded.pack.name == "Alpine Weekend")
    }

    @Test("isPro survives an encode/decode round trip")
    func isProRoundTrips() throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        var snapshot = PackRatWatchSnapshot.visualSyncedSample
        snapshot.isPro = true

        let decoded = try decoder.decode(
            PackRatWatchSnapshot.self,
            from: try encoder.encode(snapshot)
        )
        #expect(decoded.isPro == true)
    }

    @Test("the fallback snapshot is not Pro")
    func fallbackIsNotPro() {
        // The value a watch shows before it has ever heard from the phone.
        #expect(PackRatWatchSnapshot.fallback.isPro == false)
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
