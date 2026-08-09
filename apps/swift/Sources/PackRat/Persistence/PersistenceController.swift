import SwiftData
import Foundation

@MainActor
final class PersistenceController {
    static let shared = PersistenceController()

    let container: ModelContainer

    private init() {
        let schema = Schema([CachedPack.self, CachedTrip.self, ShoppingItem.self])
        let config = ModelConfiguration("PackRat", schema: schema)
        do {
            try FileManager.default.createDirectory(
                at: FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0],
                withIntermediateDirectories: true
            )
            container = try ModelContainer(for: schema, configurations: config)
        } catch {
            fatalError("SwiftData container failed: \(error)")
        }
    }
}
