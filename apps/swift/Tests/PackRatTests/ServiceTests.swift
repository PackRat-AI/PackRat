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

// MARK: - Template request encoding

@Suite("UpdateTemplateRequest encoding")
struct UpdateTemplateRequestTests {
    @Test("encodes provided fields")
    func encodesFields() throws {
        let req = UpdateTemplateRequest(name: "New Name", description: "Desc",
                                        category: "hiking", localUpdatedAt: "2025-01-01T00:00:00Z")
        let data = try JSONEncoder().encode(req)
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        #expect(dict["name"] as? String == "New Name")
        #expect(dict["category"] as? String == "hiking")
        #expect(dict["localUpdatedAt"] as? String == "2025-01-01T00:00:00Z")
    }

    @Test("nil fields are omitted from output")
    func nilFieldsOmitted() throws {
        let req = UpdateTemplateRequest(name: nil, description: nil,
                                        category: nil, localUpdatedAt: "2025-01-01T00:00:00Z")
        let data = try JSONEncoder().encode(req)
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        #expect(dict["name"] == nil)
        #expect(dict["description"] == nil)
        #expect(dict["category"] == nil)
    }
}

@Suite("CreateTemplateItemRequest encoding")
struct CreateTemplateItemRequestTests {
    @Test("encodes all required fields")
    func encodesRequired() throws {
        let req = CreateTemplateItemRequest(id: "item-1", name: "Tent", weight: 1200,
                                            weightUnit: "g", quantity: 1, category: "shelter",
                                            consumable: false, worn: false, notes: nil)
        let data = try JSONEncoder().encode(req)
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        #expect(dict["id"] as? String == "item-1")
        #expect(dict["name"] as? String == "Tent")
        #expect(dict["weight"] as? Double == 1200)
        #expect(dict["weightUnit"] as? String == "g")
        #expect(dict["quantity"] as? Int == 1)
        #expect(dict["consumable"] as? Bool == false)
        #expect(dict["worn"] as? Bool == false)
    }

    @Test("notes and category omitted when nil")
    func optionalFieldsOmitted() throws {
        let req = CreateTemplateItemRequest(id: "i1", name: "Pad", weight: 400,
                                            weightUnit: "g", quantity: 1, category: nil,
                                            consumable: true, worn: false, notes: nil)
        let data = try JSONEncoder().encode(req)
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        #expect(dict["notes"] == nil)
        #expect(dict["category"] == nil)
        #expect(dict["consumable"] as? Bool == true)
    }
}

@Suite("UpdateTemplateItemRequest encoding")
struct UpdateTemplateItemRequestTests {
    @Test("all nil fields produce empty object")
    func allNilProducesEmpty() throws {
        let req = UpdateTemplateItemRequest(name: nil, weight: nil, weightUnit: nil,
                                            quantity: nil, category: nil,
                                            consumable: nil, worn: nil, notes: nil)
        let data = try JSONEncoder().encode(req)
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        #expect(dict.isEmpty)
    }

    @Test("partial update encodes only set fields")
    func partialEncoding() throws {
        let req = UpdateTemplateItemRequest(name: "Updated Tent", weight: 900,
                                            weightUnit: "g", quantity: nil,
                                            category: nil, consumable: nil, worn: nil, notes: nil)
        let data = try JSONEncoder().encode(req)
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        #expect(dict["name"] as? String == "Updated Tent")
        #expect(dict["weight"] as? Double == 900)
        #expect(dict["quantity"] == nil)
        #expect(dict["category"] == nil)
    }
}

// MARK: - Decodable model round-trips

@Suite("Pack JSON decoding")
struct PackDecodingTests {
    private let packJSON = """
    {
        "id": "pack-1",
        "userId": 1,
        "name": "Three-Season Hiking",
        "category": "hiking",
        "isPublic": true,
        "deleted": false,
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
                "category": "sleep",
                "consumable": false,
                "worn": false,
                "deleted": false
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

    @Test("unknown category falls back to .custom")
    func unknownCategoryFallback() throws {
        let json = """
        {
            "id": "pack-2",
            "userId": 1,
            "name": "Old Pack",
            "category": "travel",
            "isPublic": false,
            "deleted": false
        }
        """.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let pack = try decoder.decode(Pack.self, from: json)
        #expect(pack.category == .custom)
    }

    @Test("unknown weightUnit falls back to .g")
    func unknownWeightUnitFallback() throws {
        let json = """
        {
            "id": "item-1",
            "packId": "pack-1",
            "name": "Old Tent",
            "weight": 900,
            "weightUnit": "lbs",
            "quantity": 1,
            "consumable": false,
            "worn": false,
            "deleted": false
        }
        """.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let item = try decoder.decode(PackItem.self, from: json)
        #expect(item.weightUnit == .lb)
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

@Suite("WeatherForecastResponse with alerts")
struct WeatherForecastAlertsTests {
    private let alertJSON = """
    {
        "location": { "id": 1, "name": "Miami", "region": "Florida", "country": "USA", "lat": 25.77, "lon": -80.19 },
        "current": {
            "temp_f": 85.0,
            "temp_c": 29.4,
            "humidity": 80,
            "wind_mph": 15.0,
            "condition": { "text": "Partly Cloudy", "code": 1003 }
        },
        "forecast": { "forecastday": [] },
        "alerts": {
            "alert": [
                {
                    "headline": "Hurricane Warning",
                    "event": "Hurricane",
                    "severity": "Extreme",
                    "urgency": "Immediate",
                    "areas": "Miami-Dade County",
                    "effective": "2025-09-01T12:00:00+00:00",
                    "expires": "2025-09-02T12:00:00+00:00",
                    "desc": "A major hurricane is approaching",
                    "instruction": "Evacuate immediately"
                }
            ]
        }
    }
    """.data(using: .utf8)!

    @Test("decodes alerts array from forecast response")
    func decodesAlerts() throws {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let resp = try decoder.decode(WeatherForecastResponse.self, from: alertJSON)
        let alerts = resp.alerts?.alert
        #expect(alerts?.count == 1)
        #expect(alerts?.first?.headline == "Hurricane Warning")
        #expect(alerts?.first?.severity == "Extreme")
        #expect(alerts?.first?.severityColor == "red")
        #expect(alerts?.first?.areas == "Miami-Dade County")
    }

    @Test("missing alerts field decodes as nil")
    func missingAlertsDecodeNil() throws {
        let noAlertsJSON = """
        {
            "location": { "id": 1, "name": "Denver", "region": "Colorado", "country": "USA", "lat": 39.74, "lon": -104.98 },
            "current": { "temp_f": 72.0, "temp_c": 22.2, "humidity": 35, "wind_mph": 8.5, "condition": { "text": "Sunny", "code": 1000 } },
            "forecast": { "forecastday": [] }
        }
        """.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let resp = try decoder.decode(WeatherForecastResponse.self, from: noAlertsJSON)
        #expect(resp.alerts == nil)
    }
}

@Suite("TrailConditionReport decoding")
struct TrailConditionDecodingTests {
    @Test("conditionSymbol maps correctly")
    func conditionSymbols() {
        func report(_ condition: String) -> TrailConditionReport {
            TrailConditionReport(id: "1", trailName: "Test", trailRegion: nil,
                                 surface: "dirt", overallCondition: condition,
                                 hazards: [], waterCrossings: 0,
                                 waterCrossingDifficulty: nil, notes: nil,
                                 photos: [], userId: nil, tripId: nil,
                                 deleted: false, createdAt: nil, updatedAt: nil)
        }
        #expect(report("excellent").conditionSymbol == "checkmark.circle.fill")
        #expect(report("good").conditionSymbol == "checkmark.circle")
        #expect(report("fair").conditionSymbol == "exclamationmark.circle")
        #expect(report("poor").conditionSymbol == "xmark.circle.fill")
        #expect(report("unknown").conditionSymbol == "questionmark.circle")
    }
}
