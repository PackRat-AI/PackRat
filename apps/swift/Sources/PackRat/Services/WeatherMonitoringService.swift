import Foundation

protocol WeatherMonitoringServicing: Sendable {
    func listWatchedLocations() async throws -> [WatchedLocation]
    func addWatchedLocation(_ request: AddWatchedLocationRequest) async throws -> WatchedLocation
    func removeWatchedLocation(id: String) async throws
    func registerDeviceToken(_ request: RegisterDeviceTokenRequest) async throws
}

final class WeatherMonitoringService: WeatherMonitoringServicing {
    static let shared = WeatherMonitoringService()
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    func listWatchedLocations() async throws -> [WatchedLocation] {
        let endpoint = Endpoint(.get, "/api/weather/watch-list")
        return try await api.send(endpoint)
    }

    func addWatchedLocation(_ request: AddWatchedLocationRequest) async throws -> WatchedLocation {
        let endpoint = Endpoint(.post, "/api/weather/watch-list", body: request)
        return try await api.send(endpoint)
    }

    func removeWatchedLocation(id: String) async throws {
        let endpoint = Endpoint(.delete, "/api/weather/watch-list/\(id)")
        try await api.sendDiscarding(endpoint)
    }

    func registerDeviceToken(_ request: RegisterDeviceTokenRequest) async throws {
        let endpoint = Endpoint(.post, "/api/weather/device-token", body: request)
        try await api.sendDiscarding(endpoint)
    }
}
