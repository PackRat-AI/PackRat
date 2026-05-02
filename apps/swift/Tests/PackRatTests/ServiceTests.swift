import Testing
import Foundation
@testable import PackRat

// MARK: - Request body encoding helpers

@Suite("CreatePackRequest encoding")
struct CreatePackRequestTests {
    @Test("encodes all required fields")
    func encodesFields() throws {
        let req = CreatePackRequest(id: "abc", name: "Hike Pack", description: "For day hikes",
                                    category: "hiking", isPublic: false,
                                    localCreatedAt: "2025-01-01T00:00:00Z",
                                    localUpdatedAt: "2025-01-01T00:00:00Z")
        let data = try JSONEncoder().encode(req)
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        #expect(dict["id"] as? String == "abc")
        #expect(dict["name"] as? String == "Hike Pack")
        #expect(dict["isPublic"] as? Bool == false)
    }
}

@Suite("CreatePackItemRequest encoding")
struct CreatePackItemRequestTests {
    @Test("optional fields omitted when nil")
    func optionalFieldsOmitted() throws {
        let req = CreatePackItemRequest(id: "i1", name: "Rain Jacket", weight: nil,
                                        weightUnit: nil, quantity: nil, category: nil,
                                        consumable: nil, worn: nil, notes: nil)
        let data = try JSONEncoder().encode(req)
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        #expect(dict["name"] as? String == "Rain Jacket")
        // nil values should not be present (standard Swift Encodable omits nil optionals)
        #expect(dict["weight"] == nil)
        #expect(dict["weightUnit"] == nil)
    }

    @Test("weight and unit encoded when present")
    func weightEncoded() throws {
        let req = CreatePackItemRequest(id: "i1", name: "Tent", weight: 1200, weightUnit: "g",
                                        quantity: 1, category: "shelter",
                                        consumable: false, worn: false, notes: nil)
        let data = try JSONEncoder().encode(req)
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        #expect(dict["weight"] as? Double == 1200)
        #expect(dict["weightUnit"] as? String == "g")
    }
}

@Suite("CreateTripRequest encoding")
struct CreateTripRequestTests {
    @Test("location is encoded as nested object")
    func locationEncoded() throws {
        let location = TripLocationBody(latitude: 37.8, longitude: -119.5, name: "Yosemite")
        let req = CreateTripRequest(id: "t1", name: "Summer Trip", description: nil,
                                    location: location, startDate: "2025-06-01T00:00:00Z",
                                    endDate: nil, notes: nil, packId: nil,
                                    localCreatedAt: "2025-01-01T00:00:00Z",
                                    localUpdatedAt: "2025-01-01T00:00:00Z")
        let data = try JSONEncoder().encode(req)
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        let loc = try #require(dict["location"] as? [String: Any])
        #expect(loc["latitude"] as? Double == 37.8)
        #expect(loc["name"] as? String == "Yosemite")
    }
}

// MARK: - Decodable model round-trips

@Suite("Pack JSON decoding")
struct PackDecodingTests {
    private let packJSON = """
    {
        "id": "pack-1",
        "userId": "user-1",
        "name": "Three-Season Hiking",
        "category": "hiking",
        "isPublic": true,
        "baseWeight": 3200.5,
        "totalWeight": 5100.0,
        "items": [
            {
                "id": "item-1",
                "packId": "pack-1",
                "name": "Sleeping Bag",
                "weight": 900,
                "weightUnit": "g",
                "quantity": 1,
                "category": "sleep"
            }
        ]
    }
    """.data(using: .utf8)!

    @Test("decodes pack with nested items")
    func decodesPackWithItems() throws {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let pack = try decoder.decode(Pack.self, from: packJSON)
        #expect(pack.id == "pack-1")
        #expect(pack.name == "Three-Season Hiking")
        #expect(pack.isPublic == true)
        #expect(pack.baseWeight == 3200.5)
        #expect(pack.items?.count == 1)
        #expect(pack.items?.first?.name == "Sleeping Bag")
    }
}

@Suite("WeatherForecastResponse decoding")
struct WeatherForecastDecodingTests {
    private let json = """
    {
        "location": { "name": "Denver", "region": "Colorado", "country": "United States of America", "lat": 39.74, "lon": -104.98 },
        "current": {
            "temp_f": 72.0,
            "temp_c": 22.2,
            "humidity": 35,
            "wind_mph": 8.5,
            "condition": { "text": "Sunny", "code": 1000 }
        },
        "forecast": {
            "forecastday": [
                {
                    "date": "2025-06-01",
                    "day": { "maxtemp_f": 82.0, "mintemp_f": 58.0, "daily_chance_of_rain": 10, "condition": { "text": "Sunny", "code": 1000 } }
                }
            ]
        }
    }
    """.data(using: .utf8)!

    @Test("decodes full forecast response")
    func decodesForecast() throws {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let resp = try decoder.decode(WeatherForecastResponse.self, from: json)
        #expect(resp.location?.name == "Denver")
        #expect(resp.current?.tempF == 72.0)
        #expect(resp.current?.humidity == 35)
        #expect(resp.current?.condition?.code == 1000)
        #expect(resp.forecast?.forecastday?.count == 1)
        #expect(resp.forecast?.forecastday?.first?.day?.maxtempF == 82.0)
        #expect(resp.forecast?.forecastday?.first?.day?.dailyChanceOfRain == 10)
    }
}

@Suite("TrailConditionReport decoding")
struct TrailConditionDecodingTests {
    @Test("conditionSymbol maps correctly")
    func conditionSymbols() {
        func report(_ condition: String) -> TrailConditionReport {
            TrailConditionReport(id: "1", userId: nil, trailName: "Test", trailRegion: nil,
                                 surface: nil, overallCondition: condition, hazards: nil,
                                 waterCrossings: nil, waterCrossingDifficulty: nil, notes: nil,
                                 photos: nil, tripId: nil, deleted: false, createdAt: nil,
                                 updatedAt: nil, user: nil)
        }
        #expect(report("excellent").conditionSymbol == "checkmark.circle.fill")
        #expect(report("good").conditionSymbol == "checkmark.circle")
        #expect(report("fair").conditionSymbol == "exclamationmark.circle")
        #expect(report("poor").conditionSymbol == "xmark.circle.fill")
        #expect(report("unknown").conditionSymbol == "questionmark.circle")
    }
}
