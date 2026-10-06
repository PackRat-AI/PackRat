import Testing
import Foundation
@testable import PackRat

// MARK: - Helpers

private func mockPack(id: String = "p1", name: String = "Test Pack", items: [PackItem] = []) -> Pack {
    Pack(id: id, userId: "u1", name: name, description: nil, category: .hiking,
         isPublic: false, image: nil, tags: nil, templateId: nil, deleted: false,
         isAIGenerated: nil, items: items, totalWeight: nil, baseWeight: nil,
         wornWeight: nil, consumableWeight: nil, createdAt: nil, updatedAt: nil)
}

private func mockItem(id: String = "i1", packId: String = "p1") -> PackItem {
    PackItem(id: id, packId: packId, name: "Test Item", description: nil,
             weight: 200, weightUnit: .g, quantity: 1, category: "shelter",
             consumable: false, worn: false, image: nil, notes: nil,
             catalogItemId: nil, userId: nil, deleted: false,
             isAIGenerated: nil, templateItemId: nil, createdAt: nil, updatedAt: nil)
}

private func mockTrip(id: String = "t1", name: String = "Test Trip", startDate: String? = nil) -> Trip {
    Trip(id: id, name: name, description: nil, notes: nil, location: nil,
         startDate: startDate, endDate: nil, userId: "u1", packId: nil,
         checklist: nil,
         deleted: false, createdAt: nil, updatedAt: nil)
}

@Suite("WeatherTemperatureDisplay")
struct WeatherTemperatureDisplayTests {
    @Test("uses Celsius value when Celsius is preferred")
    func usesPreferredCelsiusValue() {
        #expect(WeatherTemperatureDisplay.format(celsius: 20, fahrenheit: 99, unit: .celsius) == "20°C")
    }

    @Test("uses Fahrenheit value when Fahrenheit is preferred")
    func usesPreferredFahrenheitValue() {
        #expect(WeatherTemperatureDisplay.format(celsius: 99, fahrenheit: 68, unit: .fahrenheit) == "68°F")
    }

    @Test("converts Fahrenheit fallback to Celsius")
    func convertsFahrenheitFallback() {
        #expect(WeatherTemperatureDisplay.format(celsius: nil, fahrenheit: 68, unit: .celsius) == "20°C")
    }

    @Test("converts Celsius fallback to Fahrenheit")
    func convertsCelsiusFallback() {
        #expect(WeatherTemperatureDisplay.format(celsius: 20, fahrenheit: nil, unit: .fahrenheit) == "68°F")
    }

    @Test("shows placeholder only when both values are unavailable")
    func showsMissingPlaceholder() {
        #expect(WeatherTemperatureDisplay.format(celsius: nil, fahrenheit: nil, unit: .celsius) == "—")
    }
}

// MARK: - PacksViewModel

@Suite("PacksViewModel")
struct PacksViewModelTests {
    @Test("filteredPacks returns all when search is empty")
    @MainActor func filteredAllWhenEmpty() {
        let vm = PacksViewModel()
        vm.packs = [mockPack(id: "1", name: "Alpha"), mockPack(id: "2", name: "Beta")]
        vm.searchText = ""
        #expect(vm.filteredPacks.count == 2)
    }

    @Test("filteredPacks filters by name case-insensitively")
    @MainActor func filtersByName() {
        let vm = PacksViewModel()
        vm.packs = [mockPack(id: "1", name: "Winter Hike"), mockPack(id: "2", name: "Summer Beach")]
        vm.searchText = "winter"
        #expect(vm.filteredPacks.count == 1)
        #expect(vm.filteredPacks.first?.name == "Winter Hike")
    }

    @Test("filteredPacks matches description")
    @MainActor func filtersByDescription() {
        let vm = PacksViewModel()
        vm.packs = [
            Pack(id: "1", userId: nil, name: "Pack A", description: "For alpine routes",
                 category: nil, isPublic: false, image: nil, tags: nil, templateId: nil,
                 deleted: false, isAIGenerated: nil, items: nil, totalWeight: nil,
                 baseWeight: nil, wornWeight: nil, consumableWeight: nil,
                 createdAt: nil, updatedAt: nil),
            mockPack(id: "2"),
        ]
        vm.searchText = "alpine"
        #expect(vm.filteredPacks.count == 1)
    }

    @Test("deletePack removes from local array")
    @MainActor func deletePackRemovesLocally() async throws {
        let vm = PacksViewModel()
        vm.packs = [mockPack(id: "1"), mockPack(id: "2")]
        vm.packs.removeAll { $0.id == "1" }
        #expect(vm.packs.count == 1)
        #expect(vm.packs.first?.id == "2")
    }
}

// MARK: - TripsViewModel

@Suite("TripsViewModel")
struct TripsViewModelTests {
    @Test("upcomingTrips only returns future trips")
    @MainActor func upcomingTripsFiltered() {
        let vm = TripsViewModel()
        let future = ISO8601DateFormatter().string(from: Date().addingTimeInterval(86400 * 7))
        let past = ISO8601DateFormatter().string(from: Date().addingTimeInterval(-86400 * 7))
        vm.trips = [
            mockTrip(id: "1", startDate: future),
            mockTrip(id: "2", startDate: past),
        ]
        #expect(vm.upcomingTrips.count == 1)
        #expect(vm.upcomingTrips.first?.id == "1")
    }

    @Test("pastTrips returns trips with past dates")
    @MainActor func pastTripsFiltered() {
        let vm = TripsViewModel()
        let past = ISO8601DateFormatter().string(from: Date().addingTimeInterval(-86400 * 3))
        vm.trips = [mockTrip(id: "1", startDate: past)]
        #expect(vm.pastTrips.count == 1)
    }

    @Test("trips without dates fall into past")
    @MainActor func tripsWithoutDatesAreInPast() {
        let vm = TripsViewModel()
        vm.trips = [mockTrip(id: "1", startDate: nil)]
        #expect(vm.pastTrips.count == 1)
        #expect(vm.upcomingTrips.isEmpty)
    }

    @Test("filteredTrips searches by location name")
    @MainActor func filtersByLocation() {
        let vm = TripsViewModel()
        let tripWithLoc = Trip(id: "1", name: "PCT", description: nil, notes: nil,
                               location: TripLocation(latitude: 37.0, longitude: -119.0, name: "Yosemite"),
                               startDate: nil, endDate: nil, userId: nil, packId: nil,
                               checklist: nil,
                               deleted: false, createdAt: nil, updatedAt: nil)
        vm.trips = [tripWithLoc, mockTrip(id: "2")]
        vm.searchText = "yosemite"
        #expect(vm.filteredTrips.count == 1)
        #expect(vm.filteredTrips.first?.id == "1")
    }
}

// MARK: - WeatherViewModel

@Suite("WeatherViewModel")
struct WeatherViewModelTests {
    @Test("onSearchTextChanged clears results when empty")
    @MainActor func clearsResultsWhenEmpty() {
        let vm = WeatherViewModel(loadPersistedState: false)
        vm.searchResults = [WeatherLocation(id: 1, name: "Denver", region: nil, country: nil, lat: nil, lon: nil)]
        vm.searchText = ""
        vm.onSearchTextChanged()
        #expect(vm.searchResults.isEmpty)
    }

    @Test("searchText below 2 chars does not search")
    @MainActor func shortQuerySkipsSearch() {
        let vm = WeatherViewModel(loadPersistedState: false)
        vm.searchText = "D"
        vm.onSearchTextChanged()
        #expect(vm.searchResults.isEmpty)
    }

    @Test("selectLocation falls back to by-name forecast when id lookup fails")
    @MainActor func forecastFallsBackToByName() async {
        let service = FallbackWeatherService()
        let vm = WeatherViewModel(service: service, loadPersistedState: false)
        let denver = WeatherLocation(
            id: 5419384,
            name: "Denver",
            region: "Colorado",
            country: "United States",
            lat: 39.74,
            lon: -104.98
        )

        await vm.selectLocation(denver)

        #expect(vm.forecast?.location?.name == "Denver")
        #expect(vm.forecastError == nil)
        #expect(await service.idForecastRequests == 1)
        #expect(await service.nameForecastQueries == ["Denver, Colorado"])
    }

    @Test("loading a forecast also refreshes that location's list summary")
    @MainActor func forecastPopulatesListSummary() async {
        let service = FallbackWeatherService()
        let vm = WeatherViewModel(service: service, loadPersistedState: false)
        let denver = WeatherLocation(
            id: 5419384,
            name: "Denver",
            region: "Colorado",
            country: "United States",
            lat: 39.74,
            lon: -104.98
        )

        await vm.selectLocation(denver)

        // The list card reads from `locationSummaries`, so a detail load that
        // didn't fold into it would leave the card behind showing stale or
        // missing conditions.
        #expect(vm.locationSummaries[denver.id]?.tempF == 72)
        #expect(vm.locationSummaries[denver.id]?.conditionText == "Partly cloudy")
    }

    @Test("removing a location drops its cached summary")
    @MainActor func removingLocationClearsSummary() async {
        let service = FallbackWeatherService()
        let vm = WeatherViewModel(service: service, loadPersistedState: false)
        let denver = WeatherLocation(
            id: 5419384,
            name: "Denver",
            region: "Colorado",
            country: "United States",
            lat: 39.74,
            lon: -104.98
        )
        vm.saveLocation(denver)
        await vm.selectLocation(denver)
        #expect(vm.locationSummaries[denver.id] != nil)

        vm.removeLocation(denver)

        // A stale summary would resurface as real conditions if the same
        // location were added back later.
        #expect(vm.locationSummaries[denver.id] == nil)
    }

    @Test("reordering saved locations keeps the user's arrangement")
    @MainActor func moveLocationsReorders() {
        let vm = WeatherViewModel(loadPersistedState: false)
        let denver = WeatherLocation(id: 1, name: "Denver", region: nil, country: nil, lat: nil, lon: nil)
        let seattle = WeatherLocation(id: 2, name: "Seattle", region: nil, country: nil, lat: nil, lon: nil)
        vm.saveLocation(denver)
        vm.saveLocation(seattle)

        vm.moveLocations(fromOffsets: IndexSet(integer: 1), toOffset: 0)

        #expect(vm.savedLocations.map(\.id) == [2, 1])
    }
}

// MARK: - Weather display formatting

@Suite("WeatherTemperatureDisplay.degrees")
struct WeatherDegreesTests {
    @Test("drops the unit suffix where context already establishes it")
    func dropsUnitSuffix() {
        #expect(WeatherTemperatureDisplay.degrees(celsius: 20, fahrenheit: 99, unit: .celsius) == "20°")
        #expect(WeatherTemperatureDisplay.degrees(celsius: 99, fahrenheit: 68, unit: .fahrenheit) == "68°")
    }

    @Test("converts before stripping, like format does")
    func convertsBeforeStripping() {
        #expect(WeatherTemperatureDisplay.degrees(celsius: nil, fahrenheit: 68, unit: .celsius) == "20°")
    }

    @Test("keeps the em dash when there is no reading")
    func preservesMissingValue() {
        #expect(WeatherTemperatureDisplay.degrees(celsius: nil, fahrenheit: nil, unit: .celsius) == "—")
    }

    @Test("handles negative temperatures without mangling the sign")
    func handlesNegatives() {
        #expect(WeatherTemperatureDisplay.degrees(celsius: -12, fahrenheit: nil, unit: .celsius) == "-12°")
    }
}

@Suite("ForecastHour")
struct ForecastHourTests {
    private func hour(epoch: Int) -> ForecastHour {
        ForecastHour(
            timeEpoch: epoch,
            time: nil,
            tempC: 10,
            tempF: 50,
            condition: nil,
            chanceOfRain: 0,
            isDay: 1
        )
    }

    @Test("labels hours in the location's own time zone, not the viewer's")
    func labelsInLocationTimeZone() {
        // 2026-09-29 15:00 UTC.
        let sample = hour(epoch: 1790694000)
        let utc = TimeZone(identifier: "UTC")!
        let denver = TimeZone(identifier: "America/Denver")!

        // Same instant, different local hour — a viewer in London must still
        // see Denver's clock when looking at Denver.
        #expect(sample.displayHour(timeZone: utc) == "3PM")
        #expect(sample.displayHour(timeZone: denver) == "9AM")
    }

    @Test("renders midnight and noon as 12, not 0")
    func rendersTwelveHourBoundaries() {
        let utc = TimeZone(identifier: "UTC")!
        // 2026-09-29 00:00 UTC and 12:00 UTC.
        #expect(hour(epoch: 1790640000).displayHour(timeZone: utc) == "12AM")
        #expect(hour(epoch: 1790683200).displayHour(timeZone: utc) == "12PM")
    }
}

private actor FallbackWeatherService: WeatherServicing {
    private(set) var idForecastRequests = 0
    private(set) var nameForecastQueries: [String] = []

    func searchLocations(query: String) async throws -> [WeatherLocation] {
        [
            WeatherLocation(
                id: 5419384,
                name: "Denver",
                region: "Colorado",
                country: "United States",
                lat: 39.74,
                lon: -104.98
            ),
        ]
    }

    func getForecast(locationId: Int) async throws -> WeatherForecastResponse {
        idForecastRequests += 1
        throw PackRatError.httpError(statusCode: 500, message: "WeatherAPI HTTP 500")
    }

    func getForecast(query: String) async throws -> WeatherForecastResponse {
        nameForecastQueries.append(query)
        return WeatherForecastResponse(
            location: WeatherResponseLocation(
                id: 5419384,
                name: "Denver",
                region: "Colorado",
                country: "United States",
                lat: 39.74,
                lon: -104.98,
                localtime: nil,
                localtimeEpoch: nil,
                tzId: nil
            ),
            current: WeatherCurrent(
                tempC: 22,
                tempF: 72,
                feelslikeC: 22,
                feelslikeF: 72,
                humidity: 32,
                windMph: 7,
                windKph: 11,
                windDir: "WSW",
                condition: WeatherCondition(text: "Partly cloudy", icon: nil, code: 1003),
                uv: 5,
                visMiles: 10,
                precipIn: 0,
                cloud: 25,
                isDay: 1
            ),
            forecast: WeatherForecast(forecastday: []),
            alerts: WeatherAlertsWrapper(alert: [])
        )
    }
}

// MARK: - CatalogViewModel

@Suite("CatalogViewModel")
struct CatalogViewModelTests {
    @Test("onSearchTextChanged clears items when text empty")
    @MainActor func clearsOnEmpty() {
        let vm = CatalogViewModel()
        vm.items = [CatalogItem(id: 1, name: "Tent", productUrl: "https://example.com",
                                sku: "TEST-001", weight: 1200, weightUnit: .g,
                                description: nil, categories: nil, images: nil,
                                brand: nil, model: nil, ratingValue: nil,
                                color: nil, size: nil, price: nil,
                                availability: "in_stock", seller: nil, reviewCount: nil)]
        vm.searchText = ""
        vm.onSearchTextChanged()
        #expect(vm.items.isEmpty)
        #expect(vm.hasSearched == false)
    }

    // MARK: - Paging (issue #2726)
    //
    // The loading indicator only appeared on the first page because a page
    // fetch shared `isLoading` with the initial search, and nothing tracked
    // whether more pages existed.

    @Test("a page fetch reports isLoadingMore, not isLoading")
    @MainActor func pageFetchUsesSeparateFlag() async {
        let service = PagingStubCatalogService(pages: [
            PagingStubCatalogService.page(count: 20, startingAt: 1),
            PagingStubCatalogService.page(count: 20, startingAt: 21),
        ])
        let vm = CatalogViewModel(service: service)
        vm.searchText = "tent"
        await vm.search(reset: true)

        service.onRequest = { [weak vm] _ in
            // Observed mid-flight: the footer spinner is what should be up, and
            // the full-screen "Searching gear…" state must stay down so the
            // already-loaded rows are not replaced.
            #expect(vm?.isLoadingMore == true)
            #expect(vm?.isLoading == false)
        }
        await vm.loadMore()

        #expect(vm.items.count == 40)
        #expect(vm.isLoadingMore == false)
    }

    @Test("a short page ends paging")
    @MainActor func shortPageStopsPaging() async {
        let service = PagingStubCatalogService(pages: [
            PagingStubCatalogService.page(count: 20, startingAt: 1),
            PagingStubCatalogService.page(count: 4, startingAt: 21),
        ])
        let vm = CatalogViewModel(service: service)
        vm.searchText = "tent"

        await vm.search(reset: true)
        #expect(vm.hasMore == true)

        await vm.loadMore()
        #expect(vm.hasMore == false)
        #expect(vm.items.count == 24)

        // Scrolling at the bottom again must not ask for a page that isn't there.
        await vm.loadMore()
        #expect(service.requestedPages == [1, 2])
    }

    @Test("a new search restores paging")
    @MainActor func newSearchResetsPaging() async {
        let service = PagingStubCatalogService(pages: [
            PagingStubCatalogService.page(count: 2, startingAt: 1),
        ])
        let vm = CatalogViewModel(service: service)
        vm.searchText = "tent"
        await vm.search(reset: true)
        #expect(vm.hasMore == false)

        service.pages = [PagingStubCatalogService.page(count: 20, startingAt: 1)]
        await vm.search(reset: true)
        #expect(vm.hasMore == true)
        #expect(vm.currentPage == 1)
    }

    @Test("a failed page gives its page number back")
    @MainActor func failedPageRewinds() async {
        let service = PagingStubCatalogService(pages: [
            PagingStubCatalogService.page(count: 20, startingAt: 1),
            PagingStubCatalogService.page(count: 20, startingAt: 21),
        ])
        let vm = CatalogViewModel(service: service)
        vm.searchText = "tent"
        await vm.search(reset: true)

        service.shouldFail = true
        await vm.loadMore()
        // Without the rewind the next scroll asks for page 3 and page 2 is
        // never fetched.
        #expect(vm.currentPage == 1)

        service.shouldFail = false
        await vm.loadMore()
        #expect(service.requestedPages == [1, 2, 2])
        #expect(vm.items.count == 40)
    }
}

/// Serves fixed pages to `CatalogViewModel` so paging can be tested without
/// the network.
@MainActor
private final class PagingStubCatalogService: CatalogBrowsing, @unchecked Sendable {
    var pages: [[CatalogItem]]
    var shouldFail = false
    var requestedPages: [Int] = []
    /// Called before a page is served, so a test can assert on the view model's
    /// in-flight state.
    var onRequest: ((Int) -> Void)?

    init(pages: [[CatalogItem]]) {
        self.pages = pages
    }

    static func page(count: Int, startingAt first: Int) -> [CatalogItem] {
        (first..<(first + count)).map { id in
            CatalogItem(
                id: id, name: "Item \(id)", productUrl: "https://example.com/\(id)",
                sku: "sku-\(id)", weight: 100, weightUnit: .g, description: nil,
                categories: nil, images: nil, brand: nil, model: nil,
                ratingValue: nil, color: nil, size: nil, price: nil,
                availability: nil, seller: nil, reviewCount: nil
            )
        }
    }

    func categories(limit _: Int) async throws -> [String] { [] }

    func browse(query _: String?, category _: String?, page: Int, limit _: Int) async throws -> [CatalogItem] {
        try serve(page: page)
    }

    func search(query _: String, page: Int, limit _: Int) async throws -> [CatalogItem] {
        try serve(page: page)
    }

    private func serve(page: Int) throws -> [CatalogItem] {
        onRequest?(page)
        requestedPages.append(page)
        if shouldFail { throw StubError.failed }
        let index = page - 1
        return index < pages.count ? pages[index] : []
    }

    enum StubError: Error { case failed }
}

// MARK: - ChatViewModel

@Suite("ChatViewModel")
@MainActor
struct ChatViewModelTests {
    @Test("starts with one assistant greeting message")
    func initialMessages() {
        let vm = ChatViewModel()
        #expect(vm.messages.count == 1)
        #expect(vm.messages.first?.role == .assistant)
        #expect(!vm.messages.first!.content.isEmpty)
    }

    @Test("canSend false when input is empty")
    func canSendRequiresInput() {
        let vm = ChatViewModel()
        vm.inputText = ""
        #expect(vm.canSend == false)
    }

    @Test("canSend false when streaming")
    func canSendFalseWhenStreaming() {
        let vm = ChatViewModel()
        vm.inputText = "hello"
        vm.isStreaming = true
        #expect(vm.canSend == false)
    }

    @Test("canSend true with non-empty input and not streaming")
    func canSendTrue() {
        let vm = ChatViewModel()
        vm.inputText = "What pack should I bring?"
        vm.isStreaming = false
        #expect(vm.canSend == true)
    }

    @Test("clearHistory resets to single greeting")
    func clearHistory() {
        let vm = ChatViewModel()
        vm.messages.append(ChatMessage(role: .user, content: "test"))
        vm.messages.append(ChatMessage(role: .assistant, content: "response"))
        vm.clearHistory()
        #expect(vm.messages.count == 1)
        #expect(vm.messages.first?.role == .assistant)
    }
}

// MARK: - FeedViewModel

@Suite("FeedViewModel")
struct FeedViewModelTests {
    @Test("deletePost removes from local array")
    @MainActor func deleteRemovesLocally() async {
        let vm = FeedViewModel()
        vm.posts.removeAll { $0.id == 1 }  // no-op on empty
        #expect(vm.posts.isEmpty)
    }
}

// MARK: - PackTemplatesViewModel

@Suite("PackTemplatesViewModel")
struct PackTemplatesViewModelTests {
    @Test("officialTemplates filters isOfficial")
    @MainActor func officialFilter() {
        let vm = PackTemplatesViewModel()
        vm.templates = [
            PackTemplate(id: "1", userId: nil, name: "Official", description: nil,
                         category: nil, image: nil, tags: nil, isAppTemplate: true,
                         contentSource: nil, items: nil, createdAt: nil, updatedAt: nil),
            PackTemplate(id: "2", userId: "u2", name: "Mine", description: nil,
                         category: nil, image: nil, tags: nil, isAppTemplate: false,
                         contentSource: nil, items: nil, createdAt: nil, updatedAt: nil),
        ]
        #expect(vm.officialTemplates.count == 1)
        #expect(vm.myTemplates.count == 1)
    }

    @Test("filteredTemplates searches by category")
    @MainActor func filtersByCategory() {
        let vm = PackTemplatesViewModel()
        vm.templates = [
            PackTemplate(id: "1", userId: nil, name: "Hiking Setup", description: nil,
                         category: "backpacking", image: nil, tags: nil, isAppTemplate: false,
                         contentSource: nil, items: nil, createdAt: nil, updatedAt: nil),
            PackTemplate(id: "2", userId: nil, name: "Beach Trip", description: nil,
                         category: "summer", image: nil, tags: nil, isAppTemplate: false,
                         contentSource: nil, items: nil, createdAt: nil, updatedAt: nil),
        ]
        vm.searchText = "backpacking"
        #expect(vm.filteredTemplates.count == 1)
        #expect(vm.filteredTemplates.first?.id == "1")
    }

    @Test("filteredTemplates searches by description")
    @MainActor func filtersByDescription() {
        let vm = PackTemplatesViewModel()
        vm.templates = [
            PackTemplate(id: "1", userId: nil, name: "Template A", description: "Lightweight alpine kit",
                         category: nil, image: nil, tags: nil, isAppTemplate: false,
                         contentSource: nil, items: nil, createdAt: nil, updatedAt: nil),
            PackTemplate(id: "2", userId: nil, name: "Template B", description: nil,
                         category: nil, image: nil, tags: nil, isAppTemplate: false,
                         contentSource: nil, items: nil, createdAt: nil, updatedAt: nil),
        ]
        vm.searchText = "alpine"
        #expect(vm.filteredTemplates.count == 1)
        #expect(vm.filteredTemplates.first?.id == "1")
    }

    @Test("filteredTemplates returns all when search is empty")
    @MainActor func returnsAllWhenEmpty() {
        let vm = PackTemplatesViewModel()
        vm.templates = [
            PackTemplate(id: "1", userId: nil, name: "A", description: nil, category: nil,
                         image: nil, tags: nil, isAppTemplate: false, contentSource: nil,
                         items: nil, createdAt: nil, updatedAt: nil),
            PackTemplate(id: "2", userId: nil, name: "B", description: nil, category: nil,
                         image: nil, tags: nil, isAppTemplate: false, contentSource: nil,
                         items: nil, createdAt: nil, updatedAt: nil),
        ]
        vm.searchText = ""
        #expect(vm.filteredTemplates.count == 2)
    }
}

// MARK: - TrailConditionsViewModel

@Suite("TrailConditionsViewModel")
struct TrailConditionsViewModelTests {
    @Test("filteredReports searches by trailName")
    @MainActor func filtersByTrailName() {
        let vm = TrailConditionsViewModel()
        vm.reports = [
            TrailConditionReport(id: "1", trailName: "Half Dome Trail",
                                 trailRegion: "Yosemite", surface: "rocky",
                                 overallCondition: "good", hazards: [], waterCrossings: 0,
                                 waterCrossingDifficulty: nil, notes: nil, photos: [],
                                 userId: nil, tripId: nil, deleted: false,
                                 createdAt: nil, updatedAt: nil),
            TrailConditionReport(id: "2", trailName: "John Muir Trail",
                                 trailRegion: nil, surface: "dirt",
                                 overallCondition: "excellent", hazards: [], waterCrossings: 0,
                                 waterCrossingDifficulty: nil, notes: nil, photos: [],
                                 userId: nil, tripId: nil, deleted: false,
                                 createdAt: nil, updatedAt: nil),
        ]
        vm.searchText = "dome"
        #expect(vm.filteredReports.count == 1)
        #expect(vm.filteredReports.first?.id == "1")
    }
}
