import SwiftData
import Foundation

@Model
final class CachedPack {
    @Attribute(.unique) var id: String
    var name: String
    var packDescription: String?
    var category: String?
    var isPublic: Bool
    var baseWeight: Double?
    var totalWeight: Double?
    var wornWeight: Double?
    var consumableWeight: Double?
    var imageURL: String?
    // Full model serialized for offline detail access
    var jsonData: Data?
    var cachedAt: Date

    init(from pack: Pack) {
        self.id = pack.id
        self.name = pack.name
        self.packDescription = pack.description
        self.category = pack.category?.rawValue
        self.isPublic = pack.isPublic
        self.baseWeight = pack.baseWeight
        self.totalWeight = pack.totalWeight
        self.wornWeight = pack.wornWeight
        self.consumableWeight = pack.consumableWeight
        self.imageURL = pack.image
        self.jsonData = try? JSONEncoder().encode(pack)
        self.cachedAt = Date()
    }

    func toPack() -> Pack? {
        guard let data = jsonData else { return nil }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try? decoder.decode(Pack.self, from: data)
    }
}
