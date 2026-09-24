import Foundation

struct WatchedLocation: Codable, Identifiable, Sendable {
    let id: String
    let weatherLocationId: Int
    let locationName: String
    let region: String?
    let country: String?
    let lat: Double
    let lon: Double
    let createdAt: String
}

struct AddWatchedLocationRequest: Encodable, Sendable {
    let weatherLocationId: Int
    let locationName: String
    let region: String?
    let country: String?
    let lat: Double
    let lon: Double
}

struct RegisterDeviceTokenRequest: Encodable, Sendable {
    let platform: String
    let deviceToken: String
}
