import Testing
import Foundation
@testable import PackRat

// MARK: - User

@Suite("User model")
struct UserModelTests {
    @Test("displayName joins first and last name")
    func displayNameJoinsNames() {
        let user = User(id: 1, email: "a@b.com", firstName: "Jane", lastName: "Doe",
                        role: "USER", emailVerified: true, avatarUrl: nil,
                        createdAt: nil, updatedAt: nil)
        #expect(user.displayName == "Jane Doe")
    }

    @Test("displayName falls back to email when names are empty")
    func displayNameFallback() {
        let user = User(id: 1, email: "a@b.com", firstName: nil, lastName: nil,
                        role: "USER", emailVerified: true, avatarUrl: nil,
                        createdAt: nil, updatedAt: nil)
        #expect(user.displayName == "a@b.com")
    }

    @Test("displayName ignores blank first name")
    func displayNameIgnoresBlank() {
        let user = User(id: 1, email: "a@b.com", firstName: "", lastName: "Doe",
                        role: "USER", emailVerified: true, avatarUrl: nil,
                        createdAt: nil, updatedAt: nil)
        #expect(user.displayName == "Doe")
    }

    @Test("initials are uppercased first letters")
    func initials() {
        let user = User(id: 1, email: "a@b.com", firstName: "Jane", lastName: "Doe",
                        role: "USER", emailVerified: true, avatarUrl: nil,
                        createdAt: nil, updatedAt: nil)
        #expect(user.initials == "JD")
    }

    @Test("isAdmin true for ADMIN role")
    func isAdmin() {
        let admin = User(id: 1, email: "a@b.com", firstName: nil, lastName: nil,
                         role: "ADMIN", emailVerified: true, avatarUrl: nil,
                         createdAt: nil, updatedAt: nil)
        let user = User(id: 2, email: "b@b.com", firstName: nil, lastName: nil,
                        role: "USER", emailVerified: true, avatarUrl: nil,
                        createdAt: nil, updatedAt: nil)
        #expect(admin.isAdmin == true)
        #expect(user.isAdmin == false)
    }
}

// MARK: - Pack

@Suite("Pack model")
struct PackModelTests {
    private func makePack(items: [PackItem] = []) -> Pack {
        Pack(id: "p1", userId: 1, name: "Test Pack", description: nil, category: .hiking,
             isPublic: false, image: nil, tags: nil, templateId: nil, deleted: false,
             isAIGenerated: nil, items: items, totalWeight: 2000, baseWeight: 1500,
             wornWeight: 300, consumableWeight: 200, createdAt: nil, updatedAt: nil)
    }

    private func makeItem(id: String, deleted: Bool = false) -> PackItem {
        PackItem(id: id, packId: "p1", name: "Item \(id)", description: nil,
                 weight: 100, weightUnit: .g, quantity: 1, category: "shelter",
                 consumable: false, worn: false, image: nil, notes: nil,
                 catalogItemId: nil, userId: nil, deleted: deleted,
                 isAIGenerated: nil, templateItemId: nil, createdAt: nil, updatedAt: nil)
    }

    @Test("activeItems excludes deleted items")
    func activeItemsExcludesDeleted() {
        let pack = makePack(items: [makeItem(id: "1"), makeItem(id: "2", deleted: true)])
        #expect(pack.activeItems.count == 1)
        #expect(pack.activeItems.first?.id == "1")
    }

    @Test("itemCount reflects only active items")
    func itemCount() {
        let pack = makePack(items: [makeItem(id: "1"), makeItem(id: "2"), makeItem(id: "3", deleted: true)])
        #expect(pack.itemCount == 2)
    }

    @Test("formattedWeight shows grams when under 1kg")
    func formattedWeightGrams() {
        let pack = makePack()
        #expect(pack.formattedWeight(500) == "500 g")
    }

    @Test("formattedWeight shows kg when 1000g or more")
    func formattedWeightKg() {
        let pack = makePack()
        #expect(pack.formattedWeight(1500) == "1.50 kg")
    }

    @Test("formattedWeight returns 0 g for nil")
    func formattedWeightNil() {
        let pack = makePack()
        #expect(pack.formattedWeight(nil) == "0 g")
    }
}

// MARK: - PackItem

@Suite("PackItem model")
struct PackItemModelTests {
    @Test("displayWeight formats correctly")
    func displayWeight() {
        let item = PackItem(id: "1", packId: "p1", name: "Tent", description: nil,
                            weight: 1200, weightUnit: .g, quantity: 1, category: nil,
                            consumable: false, worn: false, image: nil, notes: nil,
                            catalogItemId: nil, userId: nil, deleted: false,
                            isAIGenerated: nil, templateItemId: nil, createdAt: nil, updatedAt: nil)
        #expect(item.displayWeight == "1200 g")
    }

    @Test("displayWeight is empty when weight is zero")
    func displayWeightEmpty() {
        let item = PackItem(id: "1", packId: "p1", name: "Tent", description: nil,
                            weight: 0, weightUnit: .g, quantity: 1, category: nil,
                            consumable: false, worn: false, image: nil, notes: nil,
                            catalogItemId: nil, userId: nil, deleted: false,
                            isAIGenerated: nil, templateItemId: nil, createdAt: nil, updatedAt: nil)
        #expect(item.displayWeight == "")
    }

    @Test("effectiveQuantity returns quantity")
    func effectiveQuantity() {
        let item = PackItem(id: "1", packId: "p1", name: "Tent", description: nil,
                            weight: 100, weightUnit: .oz, quantity: 3, category: nil,
                            consumable: false, worn: false, image: nil, notes: nil,
                            catalogItemId: nil, userId: nil, deleted: false,
                            isAIGenerated: nil, templateItemId: nil, createdAt: nil, updatedAt: nil)
        #expect(item.effectiveQuantity == 3)
    }
}

// MARK: - Trip

@Suite("Trip model")
struct TripModelTests {
    @Test("dateRange produces readable string")
    func dateRange() {
        let trip = Trip(id: "1", name: "PCT", description: nil,
                        notes: nil, location: nil,
                        startDate: "2025-06-01T00:00:00Z", endDate: "2025-06-07T00:00:00Z",
                        userId: 1, packId: nil, deleted: false, createdAt: nil, updatedAt: nil)
        #expect(!trip.dateRange.isEmpty)
        #expect(trip.dateRange.contains("–"))
    }

    @Test("dateRange is empty when no dates")
    func dateRangeEmpty() {
        let trip = Trip(id: "1", name: "PCT", description: nil,
                        notes: nil, location: nil,
                        startDate: nil, endDate: nil,
                        userId: nil, packId: nil, deleted: false, createdAt: nil, updatedAt: nil)
        #expect(trip.dateRange.isEmpty)
    }
}

// MARK: - WeatherLocation

@Suite("WeatherLocation model")
struct WeatherLocationTests {
    @Test("displayName joins name and region")
    func displayNameJoinsFields() {
        let loc = WeatherLocation(id: 1, name: "Denver", region: "Colorado", country: "USA",
                                  lat: 39.7, lon: -104.9)
        #expect(loc.displayName == "Denver, Colorado")
    }

    @Test("displayName skips empty fields")
    func displayNameSkipsEmpty() {
        let loc = WeatherLocation(id: 1, name: "Tokyo", region: nil, country: "Japan",
                                  lat: nil, lon: nil)
        #expect(loc.displayName == "Tokyo, Japan")
    }
}

// MARK: - CatalogItem

@Suite("CatalogItem model")
struct CatalogItemTests {
    @Test("displayPrice formats USD correctly")
    func displayPriceUSD() {
        let item = CatalogItem(id: 1, name: "Tent", productUrl: "https://example.com",
                               sku: "MSR-TENT-001", weight: 1200, weightUnit: .g,
                               description: nil, categories: nil, images: nil,
                               brand: "MSR", model: nil, ratingValue: nil,
                               color: nil, size: nil, price: 499.99,
                               availability: "in_stock", seller: nil, reviewCount: nil)
        #expect(item.displayPrice == "$499.99")
    }

    @Test("displayPrice is nil when price is zero or nil")
    func displayPriceZero() {
        let item = CatalogItem(id: 1, name: "Tent", productUrl: "https://example.com",
                               sku: "TEST-001", weight: 100, weightUnit: .g,
                               description: nil, categories: nil, images: nil,
                               brand: nil, model: nil, ratingValue: nil,
                               color: nil, size: nil, price: nil,
                               availability: "in_stock", seller: nil, reviewCount: nil)
        #expect(item.displayPrice == nil)
    }

    @Test("isInStock false for out_of_stock")
    func isInStock() {
        let inStock = CatalogItem(id: 1, name: "T", productUrl: "https://example.com",
                                  sku: "A", weight: 100, weightUnit: .g,
                                  description: nil, categories: nil, images: nil,
                                  brand: nil, model: nil, ratingValue: nil,
                                  color: nil, size: nil, price: nil,
                                  availability: "in_stock", seller: nil, reviewCount: nil)
        let outOfStock = CatalogItem(id: 2, name: "T", productUrl: "https://example.com",
                                     sku: "B", weight: 100, weightUnit: .g,
                                     description: nil, categories: nil, images: nil,
                                     brand: nil, model: nil, ratingValue: nil,
                                     color: nil, size: nil, price: nil,
                                     availability: "out_of_stock", seller: nil, reviewCount: nil)
        #expect(inStock.isInStock == true)
        #expect(outOfStock.isInStock == false)
    }
}

// MARK: - Enum decoding

@Suite("Enum graceful decoding")
struct EnumDecodingTests {
    @Test("PackCategory decodes known value")
    func packCategoryKnown() throws {
        let data = #"{"category":"hiking"}"#.data(using: .utf8)!
        let result = try JSONDecoder().decode(WrappedCategory.self, from: data)
        #expect(result.category == .hiking)
    }

    @Test("PackCategory falls back to .custom for unknown values")
    func packCategoryUnknown() throws {
        let data = #"{"category":"travel"}"#.data(using: .utf8)!
        let result = try JSONDecoder().decode(WrappedCategory.self, from: data)
        #expect(result.category == .custom)
    }

    @Test("WeightUnit decodes known value")
    func weightUnitKnown() throws {
        let data = #"{"unit":"oz"}"#.data(using: .utf8)!
        let result = try JSONDecoder().decode(WrappedUnit.self, from: data)
        #expect(result.unit == .oz)
    }

    @Test("WeightUnit maps legacy lbs to lb")
    func weightUnitLegacyLbs() throws {
        let data = #"{"unit":"lbs"}"#.data(using: .utf8)!
        let result = try JSONDecoder().decode(WrappedUnit.self, from: data)
        #expect(result.unit == .lb)
    }

    @Test("WeightUnit falls back to .g for completely unknown values")
    func weightUnitUnknown() throws {
        let data = #"{"unit":"stones"}"#.data(using: .utf8)!
        let result = try JSONDecoder().decode(WrappedUnit.self, from: data)
        #expect(result.unit == .g)
    }

    private struct WrappedCategory: Decodable { let category: PackCategory }
    private struct WrappedUnit: Decodable { let unit: WeightUnit }
}

// MARK: - PackRatError

@Suite("PackRatError")
struct PackRatErrorTests {
    @Test("unauthorized has descriptive message")
    func unauthorizedDescription() {
        let err = PackRatError.unauthorized
        #expect(err.errorDescription?.contains("session") == true || err.errorDescription?.contains("sign") == true)
    }

    @Test("httpError includes message")
    func httpErrorWithMessage() {
        let err = PackRatError.httpError(statusCode: 422, message: "Validation failed")
        #expect(err.errorDescription == "Validation failed")
    }

    @Test("httpError uses fallback when message nil")
    func httpErrorNilMessage() {
        let err = PackRatError.httpError(statusCode: 500, message: nil)
        #expect(err.errorDescription == "An error occurred")
    }
}
