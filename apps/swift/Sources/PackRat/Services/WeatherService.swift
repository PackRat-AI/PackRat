import Foundation

protocol WeatherServicing: Sendable {
    func searchLocations(query: String) async throws -> [WeatherLocation]
    func getForecast(locationId: Int) async throws -> WeatherForecastResponse
    func getForecast(query: String) async throws -> WeatherForecastResponse
}

final class WeatherService: WeatherServicing {
    static let shared = WeatherService()
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    func searchLocations(query: String) async throws -> [WeatherLocation] {
        let endpoint = Endpoint(.get, "/api/weather/search", query: ["q": query])
        return try await api.send(endpoint)
    }

    func getForecast(locationId: Int) async throws -> WeatherForecastResponse {
        let endpoint = Endpoint(.get, "/api/weather/forecast", query: ["id": "\(locationId)"])
        return try await api.send(endpoint)
    }

    func getForecast(query: String) async throws -> WeatherForecastResponse {
        let endpoint = Endpoint(.get, "/api/weather/by-name", query: ["q": query])
        return try await api.send(endpoint)
    }
}
