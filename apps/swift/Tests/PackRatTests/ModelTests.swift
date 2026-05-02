import Testing
import Foundation
@testable import PackRat

// MARK: - User

@Suite("User model")
struct UserModelTests {
    @Test("displayName joins first and last name")
    func displayNameJoinsNames() {
        let user = User(id: "1", email: "a@b.com", firstName: "Jane", lastName: "Doe",
                        avatarUrl: nil, role: "USER", emailVerified: true, createdAt: nil)
        #expect(user.displayName == "Jane Doe")
    }

    @Test("displayName falls back to email when names are empty")
    func displayNameFallback() {
        let user = User(id: "1", email: "a@b.com", firstName: nil, lastName: nil,
                        avatarUrl: nil, role: "USER", emailVerified: true, createdAt: nil)
        #expect(user.displayName == "a@b.com")
    }

    @Test("displayName ignores blank first name")
    func displayNameIgnoresBlank() {
        let user = User(id: "1", email: "a@b.com", firstName: "", lastName: "Doe",
                        avatarUrl: nil, role: "USER", emailVerified: true, createdAt: nil)
        #expect(user.displayName == "Doe")
    }

    @Test("initials are uppercased first letters")
    func initials() {
        let user = User(id: "1", email: "a@b.com", firstName: "Jane", lastName: "Doe",
                        avatarUrl: nil, role: "USER", emailVerified: true, createdAt: nil)
        #expect(user.initials == "JD")
    }

    @Test("isAdmin true for ADMIN role")
    func isAdmin() {
        let admin = User(id: "1", email: "a@b.com", firstName: nil, lastName: nil,
                         avatarUrl: nil, role: "ADMIN", emailVerified: true, createdAt: nil)
        let user = User(id: "2", email: "b@b.com", firstName: nil, lastName: nil,
                        avatarUrl: nil, role: "USER", emailVerified: true, createdAt: nil)
        #expect(admin.isAdmin == true)
        #expect(user.isAdmin == false)
    }
}

// MARK: - Pack

@Suite("Pack model")
struct PackModelTests {
    private func makePack(items: [PackItem] = []) -> Pack {
        Pack(id: "p1", userId: "u1", name: "Test Pack", description: nil, category: "hiking",
             isPublic: false, image: nil, tags: nil, items: items, deleted: false,
             baseWeight: 1500, totalWeight: 2000, wornWeight: 300, consumableWeight: 200,
             createdAt: nil, updatedAt: nil)
    }

    private func makeItem(id: String, deleted: Bool = false) -> PackItem {
        PackItem(id: id, packId: "p1", name: "Item \(id)", weight: 100, weightUnit: "g",
                 quantity: 1, category: "shelter", consumable: false, worn: false,
                 image: nil, notes: nil, catalogItemId: nil, deleted: deleted)
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
        let item = PackItem(id: "1", packId: "p1", name: "Tent", weight: 1200, weightUnit: "g",
                            quantity: 1, category: nil, consumable: nil, worn: nil,
                            image: nil, notes: nil, catalogItemId: nil, deleted: nil)
        #expect(item.displayWeight == "1200 g")
    }

    @Test("displayWeight is empty when no weight")
    func displayWeightEmpty() {
        let item = PackItem(id: "1", packId: "p1", name: "Tent", weight: nil, weightUnit: nil,
                            quantity: 1, category: nil, consumable: nil, worn: nil,
                            image: nil, notes: nil, catalogItemId: nil, deleted: nil)
        #expect(item.displayWeight == "")
    }

    @Test("effectiveQuantity defaults to 1 when nil")
    func effectiveQuantity() {
        let item = PackItem(id: "1", packId: "p1", name: "Tent", weight: nil, weightUnit: nil,
                            quantity: nil, category: nil, consumable: nil, worn: nil,
                            image: nil, notes: nil, catalogItemId: nil, deleted: nil)
        #expect(item.effectiveQuantity == 1)
    }
}

// MARK: - Trip

@Suite("Trip model")
struct TripModelTests {
    @Test("dateRange produces readable string")
    func dateRange() {
        let trip = Trip(id: "1", userId: "u1", name: "PCT", description: nil,
                        startDate: "2025-06-01T00:00:00Z", endDate: "2025-06-07T00:00:00Z",
                        location: nil, notes: nil, packId: nil, pack: nil,
                        deleted: false, createdAt: nil, updatedAt: nil)
        #expect(!trip.dateRange.isEmpty)
        #expect(trip.dateRange.contains("–"))
    }

    @Test("dateRange is empty when no dates")
    func dateRangeEmpty() {
        let trip = Trip(id: "1", userId: "u1", name: "PCT", description: nil,
                        startDate: nil, endDate: nil, location: nil, notes: nil,
                        packId: nil, pack: nil, deleted: false, createdAt: nil, updatedAt: nil)
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
        let item = CatalogItem(id: 1, name: "Tent", brand: "MSR", model: nil,
                               weight: 1200, weightUnit: "g", description: nil,
                               price: 499.99, currency: "USD", productUrl: nil,
                               images: nil, categories: nil, availability: "in_stock",
                               ratingValue: nil, reviewCount: nil, sku: nil)
        #expect(item.displayPrice == "$499.99")
    }

    @Test("displayPrice is nil when price is zero")
    func displayPriceZero() {
        let item = CatalogItem(id: 1, name: "Tent", brand: nil, model: nil,
                               weight: nil, weightUnit: nil, description: nil,
                               price: 0, currency: "USD", productUrl: nil,
                               images: nil, categories: nil, availability: "in_stock",
                               ratingValue: nil, reviewCount: nil, sku: nil)
        #expect(item.displayPrice == nil)
    }

    @Test("isInStock false for out_of_stock")
    func isInStock() {
        let inStock = CatalogItem(id: 1, name: "T", brand: nil, model: nil,
                                  weight: nil, weightUnit: nil, description: nil,
                                  price: nil, currency: nil, productUrl: nil,
                                  images: nil, categories: nil, availability: "in_stock",
                                  ratingValue: nil, reviewCount: nil, sku: nil)
        let outOfStock = CatalogItem(id: 2, name: "T", brand: nil, model: nil,
                                     weight: nil, weightUnit: nil, description: nil,
                                     price: nil, currency: nil, productUrl: nil,
                                     images: nil, categories: nil, availability: "out_of_stock",
                                     ratingValue: nil, reviewCount: nil, sku: nil)
        #expect(inStock.isInStock == true)
        #expect(outOfStock.isInStock == false)
    }
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
