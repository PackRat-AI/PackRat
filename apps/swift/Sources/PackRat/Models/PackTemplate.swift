import Foundation

struct PackTemplate: Codable, Identifiable, Sendable {
    let id: String
    let userId: String?
    let name: String
    let description: String?
    let category: String?
    let image: String?
    let tags: [String]?
    let isAppTemplate: Bool?
    let contentSource: String?
    let items: [PackTemplateItem]?
    let createdAt: String?
    let updatedAt: String?

    var itemCount: Int { items?.count ?? 0 }
    var isOfficial: Bool { isAppTemplate ?? false }
}

struct PackTemplateItem: Codable, Identifiable, Sendable {
    let id: String
    let packTemplateId: String?
    let name: String
    let weight: Double?
    let weightUnit: String?
    let quantity: Int?
    let category: String?
    let consumable: Bool?
    let worn: Bool?
    let notes: String?
}

struct CreateTemplateRequest: Encodable {
    let id: String
    let name: String
    let description: String?
    let category: String?
    let localCreatedAt: String
    let localUpdatedAt: String
}
