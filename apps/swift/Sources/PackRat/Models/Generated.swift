// @generated — DO NOT EDIT
// Run `bun swift:models` to regenerate from openapi.yaml
// Request body types and computed extensions live in the per-feature model files.

import Foundation

enum WeightUnit: String, Codable, CaseIterable, Sendable {
    case g
    case oz
    case kg
    case lb
}

enum PackCategory: String, Codable, CaseIterable, Sendable {
    case hiking
    case backpacking
    case camping
    case climbing
    case winter
    case desert
    case custom
    case waterSports = "water sports"
    case skiing
}

struct PackItem: Codable, Identifiable, Sendable {
    let id: String
    let packId: String?
    let name: String
    let description: String?
    let weight: Double
    let weightUnit: WeightUnit
    let quantity: Int
    let category: String?
    let consumable: Bool
    let worn: Bool
    let image: String?
    let notes: String?
    let catalogItemId: Int?
    // Better Auth migrated users.id to text/UUID — every user-FK column on the
    // DB side is `text` now. See packages/db/src/schema.ts.
    let userId: String?
    let deleted: Bool
    let isAIGenerated: Bool?
    let templateItemId: String?
    let createdAt: String?
    let updatedAt: String?
}

struct Pack: Codable, Identifiable, Sendable {
    let id: String
    let userId: String?
    let name: String
    let description: String?
    let category: PackCategory?
    let isPublic: Bool
    let image: String?
    let tags: [String]?
    let templateId: String?
    let deleted: Bool
    let isAIGenerated: Bool?
    let items: [PackItem]?
    let totalWeight: Double?
    let baseWeight: Double?
    let wornWeight: Double?
    let consumableWeight: Double?
    let createdAt: String?
    let updatedAt: String?
}

struct TripLocation: Codable, Sendable {
    let latitude: Double
    let longitude: Double
    let name: String?
}

struct Trip: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let description: String?
    let notes: String?
    let location: TripLocation?
    let startDate: String?
    let endDate: String?
    let userId: String?
    let packId: String?
    let deleted: Bool
    let createdAt: String?
    let updatedAt: String?
}

struct User: Codable, Identifiable, Sendable {
    // Better Auth issues UUID-formatted text ids.
    let id: String
    let email: String
    // Better Auth requires a `name` column; firstName/lastName are exposed via
    // the auth config's `additionalFields` and stay optional for legacy users.
    let name: String?
    let firstName: String?
    let lastName: String?
    let role: String?
    let emailVerified: Bool?
    let avatarUrl: String?
    let createdAt: String?
    let updatedAt: String?
}

struct PostAuthor: Codable, Identifiable, Sendable {
    // Authors are users — string UUID id post-better-auth migration.
    let id: String
    let firstName: String?
    let lastName: String?
}

struct Post: Codable, Identifiable, Sendable {
    // posts table still uses a serial integer id.
    let id: Int
    // posts.userId is a text FK → users.id after the better-auth migration.
    let userId: String
    let caption: String?
    let images: [String]
    let createdAt: String
    let updatedAt: String
    let author: PostAuthor?
    let likeCount: Int
    let commentCount: Int
    let likedByMe: Bool
}

struct FeedResponse: Codable, Sendable {
    let items: [Post]
    let page: Int
    let limit: Int
    let total: Int
    let totalPages: Int
}

struct Comment: Codable, Identifiable, Sendable {
    // post_comments still uses serial Int for id, postId, and parentCommentId.
    let id: Int
    let postId: Int
    // post_comments.userId is text post-better-auth migration.
    let userId: String
    let content: String
    let parentCommentId: Int?
    let createdAt: String
    let updatedAt: String
    let author: PostAuthor?
    let likeCount: Int
    let likedByMe: Bool
}

struct CommentsResponse: Codable, Sendable {
    let items: [Comment]
    let page: Int
    let limit: Int
    let total: Int
    let totalPages: Int
}

struct LikeToggleResponse: Codable, Sendable {
    let liked: Bool
    let likeCount: Int
}

struct CatalogItem: Codable, Identifiable, Sendable {
    let id: Int
    let name: String
    let productUrl: String
    let sku: String
    let weight: Double
    let weightUnit: WeightUnit
    let description: String?
    let categories: [String]?
    let images: [String]?
    let brand: String?
    let model: String?
    let ratingValue: Double?
    let color: String?
    let size: String?
    let price: Double?
    let availability: String?
    let seller: String?
    let reviewCount: Int?
}

struct TrailConditionReport: Codable, Identifiable, Sendable {
    let id: String
    let trailName: String
    let trailRegion: String?
    let surface: String
    let overallCondition: String
    let hazards: [String]
    let waterCrossings: Int
    let waterCrossingDifficulty: String?
    let notes: String?
    let photos: [String]
    let userId: String?
    let tripId: String?
    let deleted: Bool
    let createdAt: String?
    let updatedAt: String?
}

struct SeasonSuggestionItem: Codable, Sendable {
    let name: String
    let description: String?
    let weight: Double?
    let weightUnit: String?
    let quantity: Int?
    let category: String?
    let consumable: Bool?
    let worn: Bool?
    let image: String?
    let notes: String?
    let catalogItemId: Int?
}

struct SeasonSuggestion: Codable, Sendable {
    let name: String
    let description: String?
    let category: String?
    let tags: [String]?
    let items: [SeasonSuggestionItem]?
}

struct SeasonSuggestionsResponse: Codable, Sendable {
    let suggestions: [SeasonSuggestion]
    let totalInventoryItems: Int
    let location: String
    let season: String
}
