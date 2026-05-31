import Foundation

enum AppFeatureFlags {
    // Keep these values aligned with `packages/config/src/config.ts`.
    static let enableOAuth = true
    static let enableTrips = true
    static let enablePackInsights = false
    static let enableShoppingList = false
    static let enableSharedPacks = false
    static let enablePackTemplates = true
    static let enableTrailConditions = true
    static let enableFeed = false
    static let enableWildlifeIdentification = false
    static let enableLocalAI = true
    static let enableTrails = false
}
