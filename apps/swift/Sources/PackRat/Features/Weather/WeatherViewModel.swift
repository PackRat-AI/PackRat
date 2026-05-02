import Foundation
import Observation

@Observable
final class WeatherViewModel {
    var searchText = ""
    var searchResults: [WeatherLocation] = []
    var selectedLocation: WeatherLocation?
    var forecast: WeatherForecastResponse?
    var isSearching = false
    var isLoadingForecast = false
    var searchError: String?
    var forecastError: String?

    private let service: WeatherService
    private var searchTask: Task<Void, Never>?

    init(service: WeatherService = .shared) {
        self.service = service
    }

    func onSearchTextChanged() {
        searchTask?.cancel()
        guard searchText.count >= 2 else {
            searchResults = []
            return
        }
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            await search(query: searchText)
        }
    }

    func search(query: String) async {
        isSearching = true
        searchError = nil
        defer { isSearching = false }
        do {
            searchResults = try await service.searchLocations(query: query)
        } catch {
            searchError = error.localizedDescription
        }
    }

    func selectLocation(_ location: WeatherLocation) async {
        selectedLocation = location
        searchResults = []
        searchText = location.displayName
        await loadForecast(for: location.id)
    }

    func loadForecast(for locationId: Int) async {
        isLoadingForecast = true
        forecastError = nil
        defer { isLoadingForecast = false }
        do {
            forecast = try await service.getForecast(locationId: locationId)
        } catch {
            forecastError = error.localizedDescription
        }
    }

    func refresh() async {
        guard let id = selectedLocation?.id else { return }
        await loadForecast(for: id)
    }
}
