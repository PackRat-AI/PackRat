import Foundation

enum VisualSampleData {
    static var isScreenshotCapture: Bool {
        ProcessInfo.processInfo.environment["PACKRAT_VISUAL_SCREENSHOTS"] == "1"
    }

    static var isEnabled: Bool {
        ProcessInfo.processInfo.environment["PACKRAT_VISUAL_SAMPLE_DATA"] == "1"
            || ProcessInfo.processInfo.arguments.contains("--visual-sample-data")
    }

    static var isUITestFixturesEnabled: Bool {
        ProcessInfo.processInfo.environment["PACKRAT_UI_TEST_FIXTURES"] == "1"
            || ProcessInfo.processInfo.arguments.contains("--ui-test-fixtures")
    }

    static var guides: [Guide] {
        [
            Guide(
                id: "visual-guide-backpacking-checklist",
                title: "Three-Season Backpacking Checklist",
                content: """
                ## Start with the big systems

                Build the pack around shelter, sleep, water, food, and weather protection. Keep rain layers and navigation reachable before the trail turns exposed.

                - Shelter and stakes
                - Quilt or sleeping bag
                - Water treatment
                - First aid and repair kit
                """,
                excerpt: "A practical packing order for shoulder-season overnight trips.",
                category: "backpacking",
                imageUrl: nil,
                createdAt: Date.iso8601Now()
            ),
            Guide(
                id: "visual-guide-desert-water",
                title: "Desert Water Planning",
                content: """
                ## Plan water before gear

                Desert routes change quickly with heat, wind, and road access. Confirm water sources, carry a reserve, and leave dry campsites with enough margin for the next exposed section.
                """,
                excerpt: "How to set a reliable water margin for hot, exposed routes.",
                category: "safety",
                imageUrl: nil,
                createdAt: Date.iso8601Now()
            ),
            Guide(
                id: "visual-guide-layering",
                title: "Layering for Wet Alpine Starts",
                content: """
                ## Keep insulation dry

                Pack active insulation separately from camp warmth. A waterproof liner, dry socks, and an accessible shell prevent small weather shifts from becoming trip problems.
                """,
                excerpt: "Simple layer choices for cold starts, wind, and afternoon rain.",
                category: "skills",
                imageUrl: nil,
                createdAt: Date.iso8601Now()
            ),
        ]
    }

    static var guideCategories: [String] {
        Array(Set(guides.compactMap(\.category))).sorted()
    }

    static func seasonSuggestions(location: String) -> SeasonSuggestionsResponse {
        SeasonSuggestionsResponse(
            suggestions: [
                SeasonSuggestion(
                    name: "Shoulder Season Overnight",
                    description: "Balanced kit for \(location) with warmth, rain protection, and reliable camp basics.",
                    category: "backpacking",
                    tags: ["shoulder season", "overnight"],
                    items: [
                        SeasonSuggestionItem(
                            name: "Rain shell",
                            description: "Waterproof layer for shoulder-season weather.",
                            weight: 210,
                            weightUnit: "g",
                            quantity: 1,
                            category: "clothing",
                            consumable: false,
                            worn: false,
                            image: nil,
                            notes: "Keep this accessible for changing weather.",
                            catalogItemId: nil
                        ),
                        SeasonSuggestionItem(
                            name: "Headlamp",
                            description: "Reliable lighting for short autumn daylight.",
                            weight: 85,
                            weightUnit: "g",
                            quantity: 1,
                            category: "lighting",
                            consumable: false,
                            worn: false,
                            image: nil,
                            notes: "Pack fresh batteries before leaving.",
                            catalogItemId: nil
                        ),
                        SeasonSuggestionItem(
                            name: "Warm layer",
                            description: "Insulating layer for cool evenings and exposed breaks.",
                            weight: 320,
                            weightUnit: "g",
                            quantity: 1,
                            category: "clothing",
                            consumable: false,
                            worn: true,
                            image: nil,
                            notes: "Wear or keep near the top of the pack.",
                            catalogItemId: nil
                        ),
                    ]
                ),
            ],
            totalInventoryItems: 3,
            location: location,
            season: "fall"
        )
    }

    static func catalogItems(matching query: String) -> [CatalogItem] {
        let allItems = [
            CatalogItem(
                id: 7001,
                name: "Copper Spur HV UL2 Tent",
                productUrl: "https://example.com/copper-spur",
                sku: "VISUAL-COPPER-SPUR",
                weight: 1420,
                weightUnit: .g,
                description: "Freestanding two-person backpacking tent.",
                categories: ["Shelter", "Backpacking"],
                images: nil,
                brand: "Big Agnes",
                model: "HV UL2",
                ratingValue: 4.7,
                color: "Orange",
                size: "2P",
                price: 549.95,
                availability: "in_stock",
                seller: "PackRat Demo",
                reviewCount: 128
            ),
            CatalogItem(
                id: 7002,
                name: "Duplex Trekking Pole Shelter",
                productUrl: "https://example.com/duplex",
                sku: "VISUAL-DUPLEX",
                weight: 539,
                weightUnit: .g,
                description: "Ultralight two-person shelter for trekking pole setups.",
                categories: ["Shelter", "Ultralight"],
                images: nil,
                brand: "Zpacks",
                model: "Duplex",
                ratingValue: 4.6,
                color: "Olive",
                size: "2P",
                price: 699.00,
                availability: "in_stock",
                seller: "PackRat Demo",
                reviewCount: 89
            ),
            CatalogItem(
                id: 7003,
                name: "Circuit 68L Backpack",
                productUrl: "https://example.com/circuit",
                sku: "VISUAL-CIRCUIT",
                weight: 1162,
                weightUnit: .g,
                description: "Frameless-compatible backpack for lightweight trips.",
                categories: ["Packs", "Backpacking"],
                images: nil,
                brand: "ULA",
                model: "Circuit",
                ratingValue: 4.8,
                color: "Green",
                size: "68L",
                price: 299.99,
                availability: "in_stock",
                seller: "PackRat Demo",
                reviewCount: 214
            ),
        ]
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return allItems }
        return allItems.filter { item in
            item.name.localizedCaseInsensitiveContains(trimmed)
            || item.brand?.localizedCaseInsensitiveContains(trimmed) == true
            || item.model?.localizedCaseInsensitiveContains(trimmed) == true
            || item.categories?.contains(where: { $0.localizedCaseInsensitiveContains(trimmed) }) == true
        }
    }

    static var weatherLocations: [WeatherLocation] {
        [
            WeatherLocation(id: 5419384, name: "Denver", region: "Colorado", country: "United States", lat: 39.74, lon: -104.98),
            WeatherLocation(id: 5809844, name: "Seattle", region: "Washington", country: "United States", lat: 47.61, lon: -122.33),
            WeatherLocation(id: 5780993, name: "Salt Lake City", region: "Utah", country: "United States", lat: 40.76, lon: -111.89),
        ]
    }

    static func weatherLocations(matching query: String) -> [WeatherLocation] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return weatherLocations }
        return weatherLocations.filter {
            $0.name.localizedCaseInsensitiveContains(trimmed)
            || ($0.region?.localizedCaseInsensitiveContains(trimmed) ?? false)
            || ($0.country?.localizedCaseInsensitiveContains(trimmed) ?? false)
        }
    }

    static func weatherForecast(for location: WeatherLocation) -> WeatherForecastResponse {
        let now = Date.iso8601Now()
        return WeatherForecastResponse(
            location: WeatherResponseLocation(
                id: location.id,
                name: location.name,
                region: location.region,
                country: location.country,
                lat: location.lat,
                lon: location.lon,
                localtime: "2026-05-26 09:00",
                localtimeEpoch: nil,
                tzId: "America/Denver"
            ),
            current: WeatherCurrent(
                tempC: 18,
                tempF: 64,
                feelslikeC: 18,
                feelslikeF: 64,
                humidity: 42,
                windMph: 8,
                windKph: 13,
                windDir: "W",
                condition: WeatherCondition(text: "Partly cloudy", icon: nil, code: 1003),
                uv: 6,
                visMiles: 10,
                precipIn: 0,
                cloud: 35,
                isDay: 1
            ),
            forecast: WeatherForecast(forecastday: [
                forecastDay(offset: 0, high: 68, low: 47, condition: "Partly cloudy", code: 1003, rain: 10),
                forecastDay(offset: 1, high: 72, low: 49, condition: "Sunny", code: 1000, rain: 5),
                forecastDay(offset: 2, high: 61, low: 44, condition: "Light rain", code: 1183, rain: 55),
            ]),
            alerts: WeatherAlertsWrapper(alert: [
                WeatherAlert(
                    headline: "Afternoon gusts above treeline",
                    event: "Wind Advisory",
                    severity: "Moderate",
                    urgency: "Expected",
                    areas: "Front Range",
                    effective: now,
                    expires: Calendar.current.date(byAdding: .hour, value: 8, to: Date())?.iso8601String(),
                    desc: "Secure lightweight shelters and keep an extra layer accessible.",
                    instruction: "Review campsite exposure before dark."
                ),
            ])
        )
    }

    @MainActor
    static func apply(to appState: AppState) {
        let now = Date.iso8601Now()
        let userId = ProcessInfo.processInfo.environment["PACKRAT_E2E_USER_ID"]
            ?? "00000000-0000-4000-8000-000000000001"

        let alpinePack = Pack(
            id: "visual-pack-alpine",
            userId: userId,
            name: "Alpine Weekend",
            description: "Two-night shoulder-season kit with warm layers and compact shelter.",
            category: .backpacking,
            isPublic: true,
            image: nil,
            tags: ["weekend", "alpine"],
            templateId: nil,
            deleted: false,
            isAIGenerated: false,
            items: [
                packItem("visual-item-pack", packId: "visual-pack-alpine", name: "Hyperlite 40L Pack", weight: 910, category: "pack"),
                packItem("visual-item-shelter", packId: "visual-pack-alpine", name: "Duplex Tent", weight: 539, category: "shelter"),
                packItem("visual-item-quilt", packId: "visual-pack-alpine", name: "20F Down Quilt", weight: 608, category: "sleep"),
                packItem("visual-item-stove", packId: "visual-pack-alpine", name: "Titanium Stove", weight: 74, category: "kitchen"),
                packItem("visual-item-rain", packId: "visual-pack-alpine", name: "Rain Shell", weight: 196, category: "clothing", worn: true),
                packItem("visual-item-food", packId: "visual-pack-alpine", name: "Trail Meals", weight: 680, quantity: 2, category: "food", consumable: true),
            ],
            totalWeight: 4687,
            baseWeight: 2327,
            wornWeight: 196,
            consumableWeight: 1360,
            createdAt: now,
            updatedAt: now
        )

        let desertPack = Pack(
            id: "visual-pack-desert",
            userId: userId,
            name: "Desert Day Hike",
            description: "Hot-weather route kit focused on water, shade, and navigation.",
            category: .desert,
            isPublic: false,
            image: nil,
            tags: ["desert", "day hike"],
            templateId: nil,
            deleted: false,
            isAIGenerated: false,
            items: [
                packItem("visual-item-hydration", packId: "visual-pack-desert", name: "Hydration Reservoir", weight: 180, category: "water"),
                packItem("visual-item-filter", packId: "visual-pack-desert", name: "Water Filter", weight: 63, category: "water"),
                packItem("visual-item-sun", packId: "visual-pack-desert", name: "Sun Hoodie", weight: 210, category: "clothing", worn: true),
                packItem("visual-item-first-aid", packId: "visual-pack-desert", name: "First Aid Kit", weight: 142, category: "safety"),
            ],
            totalWeight: 595,
            baseWeight: 385,
            wornWeight: 210,
            consumableWeight: 0,
            createdAt: now,
            updatedAt: now
        )

        appState.packsVM.packs = [alpinePack, desertPack]
        appState.packsVM.isCacheLoaded = true
        appState.packsVM.hasMore = false

        appState.tripsVM.trips = [
            Trip(
                id: "visual-trip-enchantments",
                name: "Enchantments Thru-Hike",
                description: "Permit-day traverse with an early start and lake lunch.",
                notes: "Check snow line and shuttle timing before departure.",
                location: TripLocation(latitude: 47.527, longitude: -120.821, name: "Leavenworth, WA"),
                startDate: Calendar.current.date(byAdding: .day, value: 18, to: Date())?.iso8601String(),
                endDate: Calendar.current.date(byAdding: .day, value: 19, to: Date())?.iso8601String(),
                userId: userId,
                packId: alpinePack.id,
                deleted: false,
                createdAt: now,
                updatedAt: now
            ),
            Trip(
                id: "visual-trip-canyonlands",
                name: "Canyonlands Scout",
                description: "Dry run for a spring desert loop.",
                notes: "Carry extra water and verify road conditions.",
                location: TripLocation(latitude: 38.326, longitude: -109.879, name: "Moab, UT"),
                startDate: Calendar.current.date(byAdding: .day, value: -11, to: Date())?.iso8601String(),
                endDate: Calendar.current.date(byAdding: .day, value: -10, to: Date())?.iso8601String(),
                userId: userId,
                packId: desertPack.id,
                deleted: false,
                createdAt: now,
                updatedAt: now
            ),
        ]
        appState.tripsVM.isCacheLoaded = true
        appState.tripsVM.hasMore = false

        appState.templatesVM.templates = [
            PackTemplate(
                id: "visual-template-weekend",
                userId: nil,
                name: "Weekend Backpacking",
                description: "A balanced overnight template for three-season trips.",
                category: "backpacking",
                image: nil,
                tags: ["official", "overnight"],
                isAppTemplate: true,
                contentSource: "PackRat",
                items: [
                    templateItem("visual-template-item-shelter", templateId: "visual-template-weekend", name: "Shelter", weight: 750, category: "shelter"),
                    templateItem("visual-template-item-sleep", templateId: "visual-template-weekend", name: "Sleep System", weight: 1200, category: "sleep"),
                    templateItem("visual-template-item-cook", templateId: "visual-template-weekend", name: "Cook Kit", weight: 320, category: "kitchen"),
                ],
                createdAt: now,
                updatedAt: now
            ),
            PackTemplate(
                id: "visual-template-day",
                userId: userId,
                name: "Fast Day Hike",
                description: "Light, compact kit for a long single-day push.",
                category: "hiking",
                image: nil,
                tags: ["day hike"],
                isAppTemplate: false,
                contentSource: nil,
                items: [
                    templateItem("visual-template-item-filter", templateId: "visual-template-day", name: "Water Filter", weight: 63, category: "water"),
                    templateItem("visual-template-item-shell", templateId: "visual-template-day", name: "Emergency Shell", weight: 196, category: "clothing"),
                ],
                createdAt: now,
                updatedAt: now
            ),
        ]

        appState.trailConditionsVM.reports = [
            TrailConditionReport(
                id: "visual-trail-report-colchuck",
                trailName: "Colchuck Lake Trail",
                trailRegion: "Central Cascades",
                surface: "snow",
                overallCondition: "fair",
                hazards: ["snow bridges", "slick rock"],
                waterCrossings: 2,
                waterCrossingDifficulty: "moderate",
                notes: "Microspikes useful above the lake outlet. Creek crossings are manageable before afternoon melt.",
                photos: [],
                userId: userId,
                tripId: nil,
                deleted: false,
                createdAt: now,
                updatedAt: now
            ),
            TrailConditionReport(
                id: "visual-trail-report-devils",
                trailName: "Devils Garden Loop",
                trailRegion: "Arches National Park",
                surface: "rocky",
                overallCondition: "good",
                hazards: ["exposure", "limited shade"],
                waterCrossings: 0,
                waterCrossingDifficulty: nil,
                notes: "Trail is dry and well marked. Start early for cooler temperatures.",
                photos: [],
                userId: userId,
                tripId: nil,
                deleted: false,
                createdAt: now,
                updatedAt: now
            ),
        ]

        appState.feedVM.posts = [
            Post(
                id: 9001,
                userId: userId,
                caption: "Dialed in the Alpine Weekend pack after swapping the stove and trimming duplicate layers. Base weight finally feels honest.",
                images: [],
                createdAt: now,
                updatedAt: now,
                author: PostAuthor(id: userId, firstName: "E2E", lastName: "User"),
                likeCount: 12,
                commentCount: 3,
                likedByMe: true
            ),
            Post(
                id: 9002,
                userId: "visual-user-friend",
                caption: "Trail report from Canyonlands: water planning mattered more than shoe choice.",
                images: [],
                createdAt: now,
                updatedAt: now,
                author: PostAuthor(id: "visual-user-friend", firstName: "Sam", lastName: "Rivera"),
                likeCount: 7,
                commentCount: 1,
                likedByMe: false
            ),
        ]
        appState.feedVM.hasMore = false

        appState.catalogVM.searchText = "tent"
        appState.catalogVM.hasSearched = true
        appState.catalogVM.items = [
            CatalogItem(
                id: 7001,
                name: "Copper Spur HV UL2 Tent",
                productUrl: "https://example.com/copper-spur",
                sku: "VISUAL-COPPER-SPUR",
                weight: 1420,
                weightUnit: .g,
                description: "Freestanding two-person backpacking tent.",
                categories: ["Shelter", "Backpacking"],
                images: nil,
                brand: "Big Agnes",
                model: "HV UL2",
                ratingValue: 4.7,
                color: "Orange",
                size: "2P",
                price: 549.95,
                availability: "in_stock",
                seller: "PackRat Demo",
                reviewCount: 128
            ),
            CatalogItem(
                id: 7002,
                name: "Duplex Trekking Pole Shelter",
                productUrl: "https://example.com/duplex",
                sku: "VISUAL-DUPLEX",
                weight: 539,
                weightUnit: .g,
                description: "Ultralight two-person shelter for trekking pole setups.",
                categories: ["Shelter", "Ultralight"],
                images: nil,
                brand: "Zpacks",
                model: "Duplex",
                ratingValue: 4.6,
                color: "Olive",
                size: "2P",
                price: 699.00,
                availability: "in_stock",
                seller: "PackRat Demo",
                reviewCount: 89
            ),
        ]

        appState.chatVM.messages = [
            ChatMessage(
                role: .assistant,
                content: "Hi! I'm your PackRat AI assistant. I can help compare gear, plan trips, and turn pack data into practical next steps."
            ),
            ChatMessage(
                role: .user,
                content: "Help me tune my Alpine Weekend pack for a wet shoulder-season overnight."
            ),
            ChatMessage(
                role: .assistant,
                content: "Start with the shelter, sleep system, and rain layers. Your base kit is solid; I would keep the rain shell accessible, add dry socks, and double-check that insulation stays in a waterproof liner."
            ),
        ]

        appState.aiPacksVM.generatedPacks = [
            Pack(
                id: "visual-ai-pack-rainy-weekend",
                userId: userId,
                name: "AI Rainy Weekend Kit",
                description: "Generated shoulder-season backpacking pack focused on warmth, dry storage, and simple camp cooking.",
                category: .backpacking,
                isPublic: true,
                image: nil,
                tags: ["ai-generated", "rain"],
                templateId: nil,
                deleted: false,
                isAIGenerated: true,
                items: [],
                totalWeight: 3950,
                baseWeight: 2950,
                wornWeight: 320,
                consumableWeight: 680,
                createdAt: now,
                updatedAt: now
            )
        ]

        let denver = WeatherLocation(
            id: 5419384,
            name: "Denver",
            region: "Colorado",
            country: "United States",
            lat: 39.74,
            lon: -104.98
        )
        appState.weatherVM.savedLocations = [denver]
        appState.weatherVM.selectedLocation = denver
        appState.weatherVM.forecast = WeatherForecastResponse(
            location: WeatherResponseLocation(
                id: denver.id,
                name: denver.name,
                region: denver.region,
                country: denver.country,
                lat: denver.lat,
                lon: denver.lon,
                localtime: "2026-05-26 09:00",
                localtimeEpoch: nil,
                tzId: "America/Denver"
            ),
            current: WeatherCurrent(
                tempC: 18,
                tempF: 64,
                feelslikeC: 18,
                feelslikeF: 64,
                humidity: 42,
                windMph: 8,
                windKph: 13,
                windDir: "W",
                condition: WeatherCondition(text: "Partly cloudy", icon: nil, code: 1003),
                uv: 6,
                visMiles: 10,
                precipIn: 0,
                cloud: 35,
                isDay: 1
            ),
            forecast: WeatherForecast(forecastday: [
                forecastDay(offset: 0, high: 68, low: 47, condition: "Partly cloudy", code: 1003, rain: 10),
                forecastDay(offset: 1, high: 72, low: 49, condition: "Sunny", code: 1000, rain: 5),
                forecastDay(offset: 2, high: 61, low: 44, condition: "Light rain", code: 1183, rain: 55),
            ]),
            alerts: WeatherAlertsWrapper(alert: [
                WeatherAlert(
                    headline: "Afternoon gusts above treeline",
                    event: "Wind Advisory",
                    severity: "Moderate",
                    urgency: "Expected",
                    areas: "Front Range",
                    effective: now,
                    expires: Calendar.current.date(byAdding: .hour, value: 8, to: Date())?.iso8601String(),
                    desc: "Secure lightweight shelters and keep an extra layer accessible.",
                    instruction: "Review campsite exposure before dark."
                ),
            ])
        )
        appState.weatherVM.forecastError = nil

        appState.selectedPackId = alpinePack.id
        appState.selectedTripId = appState.tripsVM.trips.first?.id
        appState.selectedTemplateId = appState.templatesVM.templates.first?.id
        appState.selectedReportId = appState.trailConditionsVM.reports.first?.id
    }

    private static func packItem(
        _ id: String,
        packId: String,
        name: String,
        weight: Double,
        quantity: Int = 1,
        category: String,
        consumable: Bool = false,
        worn: Bool = false
    ) -> PackItem {
        PackItem(
            id: id,
            packId: packId,
            name: name,
            description: nil,
            weight: weight,
            weightUnit: .g,
            quantity: quantity,
            category: category,
            consumable: consumable,
            worn: worn,
            image: nil,
            notes: nil,
            catalogItemId: nil,
            userId: nil,
            deleted: false,
            isAIGenerated: false,
            templateItemId: nil,
            createdAt: Date.iso8601Now(),
            updatedAt: Date.iso8601Now()
        )
    }

    private static func templateItem(
        _ id: String,
        templateId: String,
        name: String,
        weight: Double,
        category: String
    ) -> PackTemplateItem {
        PackTemplateItem(
            id: id,
            packTemplateId: templateId,
            name: name,
            weight: weight,
            weightUnit: "g",
            quantity: 1,
            category: category,
            consumable: false,
            worn: false,
            notes: nil
        )
    }

    private static func forecastDay(
        offset: Int,
        high: Double,
        low: Double,
        condition: String,
        code: Int,
        rain: Int
    ) -> ForecastDay {
        let date = Calendar.current.date(byAdding: .day, value: offset, to: Date()) ?? Date()
        return ForecastDay(
            date: date.formatted(.iso8601.year().month().day()),
            dateEpoch: nil,
            day: DayForecast(
                maxtempF: high,
                mintempF: low,
                maxtempC: nil,
                mintempC: nil,
                totalprecipIn: rain > 40 ? 0.12 : 0.0,
                avghumidity: 45 + rain / 2,
                condition: WeatherCondition(text: condition, icon: nil, code: code),
                uv: 5,
                dailyChanceOfRain: rain,
                dailyChanceOfSnow: 0
            ),
            astro: AstroForecast(sunrise: "5:38 AM", sunset: "8:18 PM")
        )
    }
}
