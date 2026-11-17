import Foundation

/// A tool the on-device model can call.
///
/// Both runtimes adapt this one definition (Apple's `Tool`, MLX's `ToolSpec`),
/// so the tool set is identical whichever model answers. Names match the cloud
/// chat's tools, so the chat shows the same activity for either mode.
struct OnDeviceTool: Sendable {
    struct Parameter: Sendable {
        enum Kind: Sendable { case string, integer, number, boolean }

        let name: String
        let description: String
        let kind: Kind
        var isRequired = false
    }

    let name: String
    let description: String
    let parameters: [Parameter]
    /// Takes the model's arguments as a JSON object and returns the result as
    /// a JSON object. Never throws: a failure is a result the model reads and
    /// explains, not an end to the reply.
    let run: @Sendable ([String: Any]) async -> [String: Any]

    /// Runs the tool for one model call, reporting it to the chat as it starts
    /// and finishes. Returns the result as JSON text for the model.
    func invoke(argumentsJSON: String, emit: @Sendable (LocalLLMEvent) -> Void) async -> String {
        let callId = UUID().uuidString
        emit(.toolStarted(id: callId, name: name, inputJSON: argumentsJSON))

        let arguments = (try? JSONSerialization.jsonObject(with: Data(argumentsJSON.utf8))) as? [String: Any] ?? [:]
        let output = await run(arguments)
        let outputJSON = (try? JSONSerialization.data(withJSONObject: output))
            .map { String(decoding: $0, as: UTF8.self) } ?? #"{"success":false}"#

        emit(.toolFinished(id: callId, outputJSON: outputJSON))
        return outputJSON
    }
}

/// The on-device chat's tools: the user's own packs, answered from this
/// device, and weather, gear catalog, guides and web search, answered by
/// PackRat's servers when there is a connection.
enum OnDeviceToolbox {
    @MainActor
    static func tools(local: ChatLocalTools) -> [OnDeviceTool] {
        packTools(local: local) + onlineTools
    }

    // MARK: - The user's packs (work offline)

    @MainActor
    private static func packTools(local: ChatLocalTools) -> [OnDeviceTool] {
        let answer: @Sendable (String) -> @Sendable ([String: Any]) async -> [String: Any] = { name in
            { arguments in await local.output(toolName: name, arguments: arguments) }
        }
        return [
            OnDeviceTool(
                name: "listUserPacks",
                description: "List the user's packs, optionally filtered by name. Use it to find a pack's id.",
                parameters: [
                    .init(name: "nameQuery", description: "Part of the pack name", kind: .string),
                ],
                run: answer("listUserPacks")
            ),
            OnDeviceTool(
                name: "getPackDetails",
                description: "Get a pack's items, weights and categories.",
                parameters: [
                    .init(name: "packId", description: "The pack's id", kind: .string, isRequired: true),
                ],
                run: answer("getPackDetails")
            ),
            OnDeviceTool(
                name: "getPackItemDetails",
                description: "Get the details of the gear item this chat is about.",
                parameters: [
                    .init(name: "itemId", description: "The item's id", kind: .string, isRequired: true),
                ],
                run: answer("getPackItemDetails")
            ),
            OnDeviceTool(
                name: "addItemToPack",
                description: "Add a gear item to one of the user's packs. Find the pack id with listUserPacks first.",
                parameters: [
                    .init(name: "packId", description: "The pack's id", kind: .string, isRequired: true),
                    .init(name: "name", description: "Item name", kind: .string, isRequired: true),
                    .init(name: "weight", description: "Weight of one unit", kind: .number),
                    .init(name: "weightUnit", description: "g, kg, oz or lb", kind: .string),
                    .init(name: "quantity", description: "How many, default 1", kind: .integer),
                    .init(name: "category", description: "For example clothing, shelter, cooking", kind: .string),
                    .init(name: "consumable", description: "True for food or fuel", kind: .boolean),
                    .init(name: "worn", description: "True if worn rather than carried", kind: .boolean),
                    .init(name: "notes", description: "Optional notes", kind: .string),
                    .init(name: "catalogItemId", description: "Catalog id, if found in the catalog", kind: .string),
                ],
                run: answer("addItemToPack")
            ),
        ]
    }

    // MARK: - Online tools

    private static let onlineTools: [OnDeviceTool] = [
        OnDeviceTool(
            name: "getWeatherForLocation",
            description: "Get current weather and today's forecast for a place.",
            parameters: [
                .init(name: "location", description: "City, park, trail or coordinates", kind: .string, isRequired: true),
            ],
            run: { arguments in
                await online {
                    let forecast = try await WeatherService.shared.getForecast(query: try required("location", in: arguments))
                    return weatherSummary(forecast)
                }
            }
        ),
        OnDeviceTool(
            name: "getCatalogItems",
            description: "Search the PackRat gear catalog by keyword and category.",
            parameters: [
                .init(name: "query", description: "Keywords", kind: .string),
                .init(name: "category", description: "Catalog category", kind: .string),
                .init(name: "limit", description: "How many results, at most 10", kind: .integer),
            ],
            run: { arguments in
                await online {
                    let items = try await CatalogService.shared.browse(
                        query: arguments["query"] as? String,
                        category: arguments["category"] as? String,
                        page: 1,
                        limit: resultLimit(arguments)
                    )
                    return items.map(catalogSummary)
                }
            }
        ),
        OnDeviceTool(
            name: "catalogVectorSearch",
            description: "Find gear in the PackRat catalog by meaning, for example \"warm quilt for cold nights\".",
            parameters: [
                .init(name: "query", description: "What the user is looking for", kind: .string, isRequired: true),
                .init(name: "limit", description: "How many results, at most 10", kind: .integer),
            ],
            run: { arguments in
                await online {
                    let items = try await CatalogService.shared.semanticSearch(
                        query: try required("query", in: arguments),
                        limit: resultLimit(arguments)
                    )
                    return items.map(catalogSummary)
                }
            }
        ),
        OnDeviceTool(
            name: "searchPackratOutdoorGuidesRAG",
            description: "Search PackRat's outdoor guides for skills, safety and trip advice.",
            parameters: [
                .init(name: "query", description: "What to look up", kind: .string, isRequired: true),
            ],
            run: { arguments in
                await online {
                    let data = try await APIClient.shared.sendData(Endpoint(
                        .get, "/api/ai/rag-search", query: ["q": try required("query", in: arguments), "limit": "3"]
                    ))
                    return guideSummaries(data)
                }
            }
        ),
        OnDeviceTool(
            name: "webSearchTool",
            description: "Search the web for current information: news, prices, trail conditions, recommendations.",
            parameters: [
                .init(name: "query", description: "A specific search query", kind: .string, isRequired: true),
            ],
            run: { arguments in
                await online {
                    let data = try await APIClient.shared.sendData(Endpoint(
                        .get, "/api/ai/web-search", query: ["q": try required("query", in: arguments)]
                    ))
                    return webSummary(data)
                }
            }
        ),
    ]

    /// Runs an online lookup, or tells the model there is no connection so it
    /// can say so and answer from what it knows.
    private static func online(_ lookup: () async throws -> Any) async -> [String: Any] {
        guard await MainActor.run(body: { NetworkMonitor.shared.isConnected }) else {
            return failure("No connection right now. Answer from general knowledge and mention that live data needs a connection.")
        }
        do {
            return ["success": true, "data": try await lookup()]
        } catch {
            return failure(error.localizedDescription)
        }
    }

    private static func required(_ key: String, in arguments: [String: Any]) throws -> String {
        guard let value = (arguments[key] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty
        else { throw ChatPackToolError.invalidArguments }
        return value
    }

    /// Small result sets keep tool output inside Apple's 4,096-token window.
    private static func resultLimit(_ arguments: [String: Any]) -> Int {
        min(max((arguments["limit"] as? Int) ?? 5, 1), 10)
    }

    private static func failure(_ message: String) -> [String: Any] {
        ["success": false, "error": message]
    }

    // MARK: - Compact results

    private static func weatherSummary(_ forecast: WeatherForecastResponse) -> [String: Any] {
        var summary: [String: Any] = [:]
        if let location = forecast.location {
            summary["location"] = [location.name, location.region, location.country]
                .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
        }
        if let current = forecast.current {
            summary["current"] = [
                "temperatureF": current.tempF as Any,
                "temperatureC": current.tempC as Any,
                "feelsLikeF": current.feelslikeF as Any,
                "condition": current.condition?.text as Any,
                "humidity": current.humidity as Any,
                "windMph": current.windMph as Any,
                "windDirection": current.windDir as Any,
            ]
        }
        if let today = forecast.forecast?.forecastday?.first?.day {
            summary["today"] = [
                "highF": today.maxtempF as Any,
                "lowF": today.mintempF as Any,
                "condition": today.condition?.text as Any,
                "precipitationIn": today.totalprecipIn as Any,
            ]
        }
        return jsonSafe(summary)
    }

    private static func catalogSummary(_ item: CatalogItem) -> [String: Any] {
        jsonSafe([
            "id": String(item.id),
            "name": item.name,
            "brand": item.brand as Any,
            "weight": item.weight as Any,
            "weightUnit": item.weightUnit?.rawValue as Any,
            "price": item.price as Any,
            "category": item.categories?.first as Any,
        ])
    }

    /// The top guide passages, trimmed: whole articles would fill the window.
    private static func guideSummaries(_ data: Data) -> [[String: Any]] {
        guard let page = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let results = page["data"] as? [[String: Any]]
        else { return [] }

        return results.prefix(3).map { result in
            let text = (result["content"] as? [[String: Any]])?
                .compactMap { $0["text"] as? String }
                .joined(separator: " ") ?? ""
            return jsonSafe([
                "guide": result["filename"] as Any,
                "url": result["url"] as Any,
                "excerpt": String(text.prefix(600)),
            ])
        }
    }

    private static func webSummary(_ data: Data) -> [String: Any] {
        guard let result = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
        let sources = (result["sources"] as? [Any])?.prefix(3).compactMap { source -> String? in
            if let url = source as? String { return url }
            return (source as? [String: Any])?["url"] as? String
        } ?? []
        return [
            "answer": String((result["answer"] as? String ?? "").prefix(1_500)),
            "sources": sources,
        ]
    }

    /// Drops nil values so `JSONSerialization` accepts the object.
    private static func jsonSafe(_ object: [String: Any]) -> [String: Any] {
        object.compactMapValues { value in
            if case Optional<Any>.none = value as Any? { return nil }
            let mirror = Mirror(reflecting: value)
            if mirror.displayStyle == .optional {
                return mirror.children.first?.value
            }
            if let nested = value as? [String: Any] { return jsonSafe(nested) }
            return value
        }
    }
}
