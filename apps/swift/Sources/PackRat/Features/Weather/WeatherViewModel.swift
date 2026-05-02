import Foundation
import Observation

private let savedLocationsKey = "savedWeatherLocations"
private let activeLocationKey = "activeWeatherLocationId"

@Observable
final class WeatherViewModel {
    var searchText = ""
    var searchResults: [WeatherLocation] = []
    var savedLocations: [WeatherLocation] = []
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
        loadSavedLocations()
        if let active = savedLocations.first(where: { $0.id == UserDefaults.standard.integer(forKey: activeLocationKey) })
            ?? savedLocations.first {
            Task { await selectLocation(active) }
        }
    }

    // MARK: - Saved Locations

    func saveLocation(_ location: WeatherLocation) {
        guard !savedLocations.contains(where: { $0.id == location.id }) else { return }
        savedLocations.append(location)
        persistSavedLocations()
    }

    func removeLocation(_ location: WeatherLocation) {
        savedLocations.removeAll { $0.id == location.id }
        persistSavedLocations()
        if selectedLocation?.id == location.id {
            if let next = savedLocations.first {
                Task { await selectLocation(next) }
            } else {
                selectedLocation = nil
                forecast = nil
                searchText = ""
            }
        }
    }

    private func loadSavedLocations() {
        guard let data = UserDefaults.standard.data(forKey: savedLocationsKey),
              let locations = try? JSONDecoder().decode([WeatherLocation].self, from: data)
        else { return }
        savedLocations = locations
    }

    private func persistSavedLocations() {
        if let data = try? JSONEncoder().encode(savedLocations) {
            UserDefaults.standard.set(data, forKey: savedLocationsKey)
        }
    }

    // MARK: - Search

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
        searchText = ""
        UserDefaults.standard.set(location.id, forKey: activeLocationKey)
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
