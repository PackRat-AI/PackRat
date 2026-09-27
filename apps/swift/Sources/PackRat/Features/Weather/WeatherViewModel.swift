import Foundation
import Observation

private let savedLocationsKey = "savedWeatherLocations"
private let activeLocationKey = "activeWeatherLocationId"
private let seenAlertIdsKey = "seenWeatherAlertIds"

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

    /// The server-backed weather-alert watch list — distinct from
    /// `savedLocations` above, which is a local-only list of places the user
    /// has looked up. Watching is always explicit (see
    /// docs/features/weather-alerts.md ADR-002); this array is empty until
    /// `loadWatchedLocations()` succeeds.
    var watchedLocations: [WatchedLocation] = []
    var isLoadingWatchedLocations = false
    /// True while a watch/unwatch round-trip is in flight for the selected
    /// location, so the toolbar control can disable itself rather than let a
    /// double-tap queue two conflicting writes.
    var isUpdatingWatchForSelectedLocation = false

    /// Set by a weather-alert push notification's tap handler via
    /// `DeepLink.weatherAlert` — `WeatherView` consumes this to select the
    /// location and open its alert detail, then clears it.
    var pendingAlertDeepLinkLocationId: Int?

    /// Per-location summaries backing the list cards, keyed by location id.
    /// The list shows every saved location's conditions at once, which the
    /// single `forecast` property cannot represent — it only ever holds the
    /// location currently being viewed in detail.
    var locationSummaries: [Int: WeatherLocationSummary] = [:]
    /// Locations with a summary load in flight, so a card can show progress
    /// without the whole list blocking on the slowest request.
    var loadingSummaryLocationIds: Set<Int> = []

    /// Alert ids the user has already been shown, keyed by location. An alert
    /// is "new" until its location's forecast has been opened — that is the
    /// moment the user has actually had a chance to read it. Keyed by the same
    /// `event|effective|…` identity the server notifies on, so a re-issued
    /// alert for the same hazard does not re-light the badge.
    var seenAlertIds: [Int: Set<String>] = [:]

    /// A short-lived message shown over the forecast after a watch action, so
    /// a successful subscription says so rather than only flipping an icon.
    var watchStatusMessage: String?

    private let service: any WeatherServicing
    private let monitoringService: any WeatherMonitoringServicing
    private var searchTask: Task<Void, Never>?

    init(
        service: any WeatherServicing = WeatherService.shared,
        monitoringService: any WeatherMonitoringServicing = WeatherMonitoringService.shared,
        loadPersistedState: Bool = true
    ) {
        self.service = service
        self.monitoringService = monitoringService
        if VisualSampleData.isUITestFixturesEnabled {
            UserDefaults.standard.removeObject(forKey: savedLocationsKey)
            UserDefaults.standard.removeObject(forKey: activeLocationKey)
        }
        guard loadPersistedState else { return }
        guard !VisualSampleData.isScreenshotCapture else { return }
        loadSavedLocations()
        loadSeenAlertIds()
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
        locationSummaries[location.id] = nil
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

    /// Reorders the saved list, backing Edit List's drag handles. The order is
    /// the user's own arrangement, so it persists like any other saved state.
    func moveLocations(fromOffsets source: IndexSet, toOffset destination: Int) {
        savedLocations.move(fromOffsets: source, toOffset: destination)
        persistSavedLocations()
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
        searchTask = Task { [weak self, searchText] in
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            await self?.search(query: searchText)
        }
    }

    func search(query: String) async {
        if VisualSampleData.isEnabled || VisualSampleData.isUITestFixturesEnabled {
            isSearching = false
            searchError = nil
            searchResults = VisualSampleData.weatherLocations(matching: query)
            return
        }

        isSearching = true
        searchError = nil
        defer { isSearching = false }
        do {
            searchResults = try await service.searchLocations(query: query)
        } catch {
            // A superseded keystroke cancels the in-flight request, and
            // URLSession reports that as a normal error. Surfacing it put
            // "cancelled" under the search field on nearly every word typed,
            // describing the app's own debounce as a failure the user could
            // do something about. Only a genuine failure is worth reporting.
            guard !Self.isCancellation(error) else { return }
            searchError = error.localizedDescription
        }
    }

    /// True for the cancellation a replaced search task causes, in either of
    /// the two shapes it arrives in: Swift's own `CancellationError` when the
    /// task is torn down before the request starts, and `NSURLErrorCancelled`
    /// when URLSession drops a request already in flight.
    static func isCancellation(_ error: any Error) -> Bool {
        if error is CancellationError { return true }
        let nsError = error as NSError
        return nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled
    }

    /// Opens a location's forecast.
    ///
    /// `clearingSearch` exists because the two entry points want opposite
    /// things. Tapping a saved card is done with the search field, so it
    /// should close. Tapping a *search result* only previews that location —
    /// the results are what Back returns to, so clearing them there left the
    /// user staring at an empty list with their query gone.
    func selectLocation(_ location: WeatherLocation, clearingSearch: Bool = true) async {
        selectedLocation = location
        if clearingSearch {
            searchResults = []
            searchText = ""
        }
        UserDefaults.standard.set(location.id, forKey: activeLocationKey)
        await loadForecast(for: location)
    }

    func loadForecast(for location: WeatherLocation) async {
        if (VisualSampleData.isEnabled || VisualSampleData.isUITestFixturesEnabled),
           let selected = selectedLocation ?? VisualSampleData.weatherLocations.first(where: { $0.id == location.id }) {
            isLoadingForecast = false
            forecastError = nil
            forecast = VisualSampleData.weatherForecast(for: selected)
            return
        }

        guard !VisualSampleData.isScreenshotCapture || VisualSampleData.isEnabled else {
            forecastError = nil
            forecast = nil
            return
        }

        isLoadingForecast = true
        forecastError = nil
        defer { isLoadingForecast = false }
        do {
            forecast = try await service.getForecast(locationId: location.id)
        } catch {
            do {
                forecast = try await service.getForecast(query: location.displayName)
            } catch {
                forecastError = error.localizedDescription
            }
        }
        // The detail screen just paid for a full forecast; fold it into the
        // list's summary so the card behind it is never staler than the screen
        // the user just came from.
        if let forecast {
            locationSummaries[location.id] = WeatherLocationSummary(forecast: forecast)
        }
    }

    func refresh() async {
        guard let location = selectedLocation else { return }
        await loadForecast(for: location)
    }

    // MARK: - List summaries

    /// Loads a card summary for every saved location that doesn't have one.
    /// Requests run concurrently — the list is as slow as its slowest card
    /// otherwise, and a user with eight saved places would watch them appear
    /// one at a time.
    func loadMissingLocationSummaries() async {
        let missing = savedLocations.filter {
            locationSummaries[$0.id] == nil && !loadingSummaryLocationIds.contains($0.id)
        }
        guard !missing.isEmpty else { return }
        await withTaskGroup(of: Void.self) { group in
            for location in missing {
                group.addTask { [weak self] in
                    await self?.loadSummary(for: location)
                }
            }
        }
    }

    /// Refreshes every saved location's summary, discarding what's cached.
    /// Backs pull-to-refresh on the list.
    func refreshAllLocationSummaries() async {
        locationSummaries.removeAll()
        await loadMissingLocationSummaries()
    }

    func loadSummary(for location: WeatherLocation) async {
        if VisualSampleData.isEnabled || VisualSampleData.isUITestFixturesEnabled {
            locationSummaries[location.id] = WeatherLocationSummary(
                forecast: VisualSampleData.weatherForecast(for: location)
            )
            return
        }
        guard !VisualSampleData.isScreenshotCapture else { return }

        loadingSummaryLocationIds.insert(location.id)
        defer { loadingSummaryLocationIds.remove(location.id) }
        do {
            let forecast = try await service.getForecast(locationId: location.id)
            locationSummaries[location.id] = WeatherLocationSummary(forecast: forecast)
        } catch {
            // Silent by design: a card that can't load shows its name and a
            // placeholder rather than an error, so one unreachable location
            // never turns the whole list into a failure state.
        }
    }

    // MARK: - Watch list

    func loadWatchedLocations() async {
        if VisualSampleData.isEnabled || VisualSampleData.isUITestFixturesEnabled {
            watchedLocations = VisualSampleData.watchedLocations
            return
        }
        guard await FeatureFlagStore.shared.isEnabled("enableWeatherMonitoring") else { return }
        isLoadingWatchedLocations = true
        defer { isLoadingWatchedLocations = false }
        do {
            watchedLocations = try await monitoringService.listWatchedLocations()
        } catch {
            // Silent: the watch-list screen and badge simply show nothing
            // until the next successful load. Not a blocking error for the
            // user — they can still see the current forecast either way.
        }
    }

    var isSelectedLocationWatched: Bool {
        guard let selectedLocation else { return false }
        return watchedLocations.contains { $0.weatherLocationId == selectedLocation.id }
    }

    /// The watch-list row for the current lookup, when there is one. Lets the
    /// forecast screen unwatch without going through the watch-list screen.
    var watchedEntryForSelectedLocation: WatchedLocation? {
        guard let selectedLocation else { return nil }
        return watchedLocations.first { $0.weatherLocationId == selectedLocation.id }
    }

    /// True when the inline alert section should carry a watch call to action:
    /// there is something active to watch for, and the user isn't already
    /// watching this place (see ADR-006). The ambient toolbar control stays
    /// available either way — this only decides whether the high-intent
    /// in-section CTA is actionable.
    var shouldOfferToWatchSelectedLocation: Bool {
        guard selectedLocation != nil else { return false }
        guard !isSelectedLocationWatched else { return false }
        return !(forecast?.alerts?.alert ?? []).isEmpty
    }

    @discardableResult
    func watchSelectedLocation() async -> Bool {
        guard let selectedLocation else { return false }
        return await watchLocation(selectedLocation)
    }

    /// Watches or unwatches the current lookup, whichever the current state
    /// implies. Backs the always-present forecast toolbar control, which is
    /// available on any location regardless of alert state (ADR-006).
    func toggleWatchForSelectedLocation() async {
        guard let selectedLocation else { return }
        guard !isUpdatingWatchForSelectedLocation else { return }
        isUpdatingWatchForSelectedLocation = true
        defer { isUpdatingWatchForSelectedLocation = false }
        // The icon alone doesn't say what subscribing actually bought the
        // user, and a bell that fills is easy to read as a display toggle.
        // Confirm the outcome in words, naming the location and the promise.
        if let watched = watchedEntryForSelectedLocation {
            if await unwatchLocation(watched) {
                watchStatusMessage = "You'll no longer get alerts for \(selectedLocation.name)"
            } else {
                watchStatusMessage = "Couldn't stop watching \(selectedLocation.name). Try again."
            }
        } else {
            if await watchSelectedLocation() {
                watchStatusMessage = "You'll get alerts for \(selectedLocation.name)"
            } else {
                watchStatusMessage = "Couldn't watch \(selectedLocation.name). Try again."
            }
        }
    }

    /// Adds an arbitrary location to the watch list without disturbing
    /// `selectedLocation`/`forecast` — used by the watch-list screen's own
    /// "add a location" search, which must not silently change what
    /// `WeatherView` shows underneath once its sheet dismisses.
    @discardableResult
    func watchLocation(_ location: WeatherLocation) async -> Bool {
        if VisualSampleData.isEnabled || VisualSampleData.isUITestFixturesEnabled {
            guard !watchedLocations.contains(where: { $0.weatherLocationId == location.id }) else { return true }
            watchedLocations.append(WatchedLocation(
                id: "visual-watch-\(location.id)",
                weatherLocationId: location.id,
                locationName: location.name,
                region: location.region,
                country: location.country,
                lat: location.lat ?? 0,
                lon: location.lon ?? 0,
                createdAt: Date.iso8601Now()
            ))
            return true
        }
        let request = AddWatchedLocationRequest(
            weatherLocationId: location.id,
            locationName: location.name,
            region: location.region,
            country: location.country,
            lat: location.lat ?? 0,
            lon: location.lon ?? 0
        )
        do {
            let watched = try await monitoringService.addWatchedLocation(request)
            watchedLocations.append(watched)
            await PushRegistrationService.registerForPushIfNeeded()
            return true
        } catch {
            return false
        }
    }

    // MARK: - New-alert badging

    /// True when this location has an active alert the user has not yet seen.
    /// Drives the red accents on the list card and the forecast's bell, which
    /// exist to pull attention to a hazard that arrived since the user last
    /// looked — not merely to restate that an alert exists.
    func hasUnseenAlert(locationId: Int) -> Bool {
        guard let headlineId = locationSummaries[locationId]?.alertId else { return false }
        return !(seenAlertIds[locationId] ?? []).contains(headlineId)
    }

    /// True when any saved location is carrying an unseen alert. Backs the
    /// dashboard's weather tile, which has no per-location surface of its own
    /// and only needs to know whether there is anything to come and look at.
    var hasAnyUnseenAlert: Bool {
        savedLocations.contains { hasUnseenAlert(locationId: $0.id) }
    }

    /// Marks every alert currently active for a location as seen. Called when
    /// its forecast opens, which is the only point at which the alert has
    /// actually been put in front of the user.
    func markAlertsSeen(for locationId: Int) {
        let ids = Set((forecast?.alerts?.alert ?? []).map(\.id))
        let summaryId = locationSummaries[locationId]?.alertId
        let all = summaryId.map { ids.union([$0]) } ?? ids
        guard !all.isEmpty else { return }
        guard seenAlertIds[locationId] != all else { return }
        seenAlertIds[locationId] = all
        persistSeenAlertIds()
    }

    private func loadSeenAlertIds() {
        guard let data = UserDefaults.standard.data(forKey: seenAlertIdsKey),
              let stored = try? JSONDecoder().decode([Int: Set<String>].self, from: data)
        else { return }
        seenAlertIds = stored
    }

    private func persistSeenAlertIds() {
        if let data = try? JSONEncoder().encode(seenAlertIds) {
            UserDefaults.standard.set(data, forKey: seenAlertIdsKey)
        }
    }

    @discardableResult
    func unwatchLocation(_ location: WatchedLocation) async -> Bool {
        if VisualSampleData.isEnabled || VisualSampleData.isUITestFixturesEnabled {
            watchedLocations.removeAll { $0.id == location.id }
            return true
        }
        do {
            try await monitoringService.removeWatchedLocation(id: location.id)
            watchedLocations.removeAll { $0.id == location.id }
            return true
        } catch {
            return false
        }
    }
}
