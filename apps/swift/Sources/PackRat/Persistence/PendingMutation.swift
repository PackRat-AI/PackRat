import Foundation
import SwiftData

/// The kind of entity a queued write applies to.
enum OutboxEntityType: String, Codable, Sendable {
    case pack
    case packItem
    case trip
    /// User-authored pack templates. Only ever enqueued by `ExpoLocalDataMigration`
    /// today — the Swift UI creates templates online through `PackTemplateService` —
    /// but the outbox is the only path that can upload content rescued from the Expo
    /// install, including a guest's templates that never reached the server.
    case packTemplate
    case packTemplateItem
    /// Trail condition reports authored on device. Same rationale as `packTemplate`.
    case trailConditionReport
}

/// The write being replayed. `create` and `update` carry a payload; `delete` does not.
enum OutboxOperation: String, Codable, Sendable {
    case create
    case update
    case delete
}

/// A durable record of a write that has not yet reached the server.
///
/// Every offline (or transport-failed) write enqueues one of these. `OutboxService`
/// drains the queue in `createdAt` order on reconnect and on app foreground, so a
/// create-then-update on the same entity replays in the order the user made it.
@Model
final class PendingMutation {
    @Attribute(.unique) var id: String
    /// Raw value of `OutboxEntityType` — SwiftData predicates can't filter on enums.
    var entityTypeRaw: String
    /// Client-generated UUID of the target entity. Stable across sync, so child
    /// items keep valid foreign keys once the parent reaches the server.
    var entityId: String
    /// Raw value of `OutboxOperation`.
    var operationRaw: String
    /// For pack items, the owning pack's id. Nil for packs and trips.
    var parentId: String?
    /// JSON-encoded operation payload. Nil for deletes.
    var payload: Data?
    var createdAt: Date
    var attemptCount: Int
    var lastError: String?
    /// Set once the mutation exhausts its retries or hits a non-retryable server
    /// response. Failed mutations stay in the store for the UI to surface rather
    /// than being dropped silently.
    var failed: Bool
    /// Earliest time this mutation may be replayed again.
    ///
    /// `flush` runs on launch, on every connectivity change, and on every foreground —
    /// events a user can trigger several times a second. Without a persisted floor, a
    /// brief server outage would burn the whole retry budget in seconds and mark the
    /// write permanently failed. Defaults to `.distantPast` so a freshly queued
    /// mutation is eligible immediately, and so rows written by earlier builds
    /// (which lack the column) migrate in as ready rather than never-eligible.
    var nextAttemptAt: Date = Date.distantPast

    init(
        id: String = UUID().uuidString,
        entityType: OutboxEntityType,
        entityId: String,
        operation: OutboxOperation,
        parentId: String? = nil,
        payload: Data? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.entityTypeRaw = entityType.rawValue
        self.entityId = entityId
        self.operationRaw = operation.rawValue
        self.parentId = parentId
        self.payload = payload
        self.createdAt = createdAt
        self.attemptCount = 0
        self.lastError = nil
        self.failed = false
        self.nextAttemptAt = .distantPast
    }

    var entityType: OutboxEntityType? { OutboxEntityType(rawValue: entityTypeRaw) }
    var operation: OutboxOperation? { OutboxOperation(rawValue: operationRaw) }
}

// MARK: - Payloads

/// Field set for a queued pack create/update. Optionals are absent-means-unchanged
/// on update, and carry the full record on create.
struct PackMutationPayload: Codable, Sendable {
    var name: String
    var description: String?
    var category: String?
    var isPublic: Bool
}

/// Field set for a queued pack-item create/update.
struct PackItemMutationPayload: Codable, Sendable {
    var name: String
    var weight: Double?
    var weightUnit: String?
    var quantity: Int?
    var category: String?
    var consumable: Bool
    var worn: Bool
    var notes: String?
    /// Kept on the payload so an item added from the catalog while offline still
    /// reaches the server with its catalog link and image once the outbox
    /// replays. Nil for hand-entered items.
    ///
    /// Optional with a default so payloads queued by an earlier build, which had
    /// neither field, still decode instead of stranding in the outbox.
    var catalogItemId: Int?
    var image: String?

    init(
        name: String,
        weight: Double? = nil,
        weightUnit: String? = nil,
        quantity: Int? = nil,
        category: String? = nil,
        consumable: Bool,
        worn: Bool,
        notes: String? = nil,
        catalogItemId: Int? = nil,
        image: String? = nil
    ) {
        self.name = name
        self.weight = weight
        self.weightUnit = weightUnit
        self.quantity = quantity
        self.category = category
        self.consumable = consumable
        self.worn = worn
        self.notes = notes
        self.catalogItemId = catalogItemId
        self.image = image
    }
}

/// Field set for a queued pack-template create/update.
///
/// `isAppTemplate` is carried but defaults to false: templates rescued from an Expo
/// install are the user's own, and marking one as an app template would publish it.
struct PackTemplateMutationPayload: Codable, Sendable {
    var name: String
    var description: String?
    var category: String
    var image: String?
    var tags: [String]?
    var isAppTemplate: Bool

    init(
        name: String,
        description: String? = nil,
        category: String,
        image: String? = nil,
        tags: [String]? = nil,
        isAppTemplate: Bool = false
    ) {
        self.name = name
        self.description = description
        self.category = category
        self.image = image
        self.tags = tags
        self.isAppTemplate = isAppTemplate
    }
}

/// Field set for a queued pack-template-item create/update.
struct PackTemplateItemMutationPayload: Codable, Sendable {
    var name: String
    var description: String?
    var weight: Double?
    var weightUnit: String?
    var quantity: Int
    var category: String?
    var consumable: Bool
    var worn: Bool
    var notes: String?
    var image: String?

    init(
        name: String,
        description: String? = nil,
        weight: Double? = nil,
        weightUnit: String? = nil,
        quantity: Int = 1,
        category: String? = nil,
        consumable: Bool = false,
        worn: Bool = false,
        notes: String? = nil,
        image: String? = nil
    ) {
        self.name = name
        self.description = description
        self.weight = weight
        self.weightUnit = weightUnit
        self.quantity = quantity
        self.category = category
        self.consumable = consumable
        self.worn = worn
        self.notes = notes
        self.image = image
    }
}

/// Field set for a queued trail-condition-report create/update.
struct TrailConditionReportMutationPayload: Codable, Sendable {
    var trailName: String
    var trailRegion: String?
    var surface: String?
    var overallCondition: String
    var hazards: [String]?
    var waterCrossings: Bool?
    var waterCrossingDifficulty: String?
    var notes: String?
    var photos: [String]?
    var tripId: String?

    init(
        trailName: String,
        trailRegion: String? = nil,
        surface: String? = nil,
        overallCondition: String,
        hazards: [String]? = nil,
        waterCrossings: Bool? = nil,
        waterCrossingDifficulty: String? = nil,
        notes: String? = nil,
        photos: [String]? = nil,
        tripId: String? = nil
    ) {
        self.trailName = trailName
        self.trailRegion = trailRegion
        self.surface = surface
        self.overallCondition = overallCondition
        self.hazards = hazards
        self.waterCrossings = waterCrossings
        self.waterCrossingDifficulty = waterCrossingDifficulty
        self.notes = notes
        self.photos = photos
        self.tripId = tripId
    }
}

/// Field set for a queued trip create/update. Dates are ISO-8601 strings so the
/// payload round-trips through JSON without timezone drift.
struct TripMutationPayload: Codable, Sendable {
    var name: String
    var description: String?
    var startDate: String?
    var endDate: String?
    var latitude: Double?
    var longitude: Double?
    var locationName: String?
    var notes: String?
    var packId: String?

    var location: TripLocationBody? {
        guard let latitude, let longitude else { return nil }
        return TripLocationBody(latitude: latitude, longitude: longitude, name: locationName)
    }
}
