import SwiftUI

// MARK: - Tool Invocation List

struct ToolInvocationsView: View {
    let invocations: [ToolInvocation]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(invocations) { invocation in
                ToolInvocationRow(invocation: invocation)
            }
        }
    }
}

// MARK: - Single Tool Invocation

struct ToolInvocationRow: View {
    let invocation: ToolInvocation
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            toolHeader
            if expanded, invocation.state == .complete {
                toolResultBody
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(10)
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
    }

    private var toolHeader: some View {
        HStack(spacing: 6) {
            toolIcon
            Text(toolDisplayName)
                .font(.caption.bold())
                .foregroundStyle(.primary)
            Spacer()
            if invocation.state == .running {
                ProgressView().scaleEffect(0.7)
            } else {
                Button {
                    withAnimation(.spring(duration: 0.2)) { expanded.toggle() }
                } label: {
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private var toolResultBody: some View {
        if let data = invocation.outputData {
            switch invocation.toolName {
            case "getWeatherForLocation":
                WeatherToolView(data: data)
            case "getCatalogItems", "catalogVectorSearch":
                CatalogToolView(data: data)
            case "getPackDetails":
                PackDetailsToolView(data: data)
            case "webSearchTool":
                WebSearchToolView(data: data)
            default:
                GenericToolView(data: data)
            }
        }
    }

    private var toolIcon: some View {
        Image(systemName: toolSymbol)
            .font(.caption)
            .foregroundStyle(toolColor)
            .frame(width: 18, height: 18)
            .background(toolColor.opacity(0.12), in: Circle())
    }

    private var toolDisplayName: String {
        switch invocation.toolName {
        case "getWeatherForLocation":   return "Checked weather"
        case "getCatalogItems":         return "Searched gear catalog"
        case "catalogVectorSearch":     return "Searched gear database"
        case "getPackDetails":          return "Looked up pack details"
        case "getPackItemDetails":      return "Looked up item details"
        case "searchPackratOutdoorGuidesRAG": return "Searched guides"
        case "webSearchTool":           return "Searched the web"
        case "executeSql":              return "Queried database"
        default:                        return invocation.toolName
        }
    }

    private var toolSymbol: String {
        switch invocation.toolName {
        case "getWeatherForLocation":   return "cloud.sun"
        case "getCatalogItems", "catalogVectorSearch": return "magnifyingglass"
        case "getPackDetails", "getPackItemDetails":   return "backpack"
        case "searchPackratOutdoorGuidesRAG": return "book"
        case "webSearchTool":           return "globe"
        case "executeSql":              return "cylinder"
        default:                        return "wrench.and.screwdriver"
        }
    }

    private var toolColor: Color {
        switch invocation.toolName {
        case "getWeatherForLocation":   return .cyan
        case "getCatalogItems", "catalogVectorSearch": return .blue
        case "getPackDetails", "getPackItemDetails":   return .green
        case "searchPackratOutdoorGuidesRAG": return .brown
        case "webSearchTool":           return .purple
        case "executeSql":              return .orange
        default:                        return .secondary
        }
    }
}

// MARK: - Weather Tool Result

private struct WeatherToolView: View {
    let data: Data

    private struct WeatherOutput: Decodable {
        let success: Bool?
        let data: WeatherData?

        struct WeatherData: Decodable {
            let location: Location?
            let current: Current?

            struct Location: Decodable { let name: String?; let country: String?; let region: String? }
            struct Current: Decodable {
                let tempC: Double?
                let tempF: Double?
                let feelslikeC: Double?
                let humidity: Int?
                let windKph: Double?
                let condition: Condition?

                struct Condition: Decodable { let text: String?; let icon: String? }

                enum CodingKeys: String, CodingKey {
                    case tempC = "temp_c"; case tempF = "temp_f"
                    case feelslikeC = "feelslike_c"; case humidity
                    case windKph = "wind_kph"; case condition
                }
            }
        }
    }

    var body: some View {
        if let result = try? JSONDecoder().decode(WeatherOutput.self, from: data),
           result.success == true, let weather = result.data {
            VStack(alignment: .leading, spacing: 8) {
                if let loc = weather.location?.name {
                    Text(loc)
                        .font(.subheadline.bold())
                }
                if let current = weather.current {
                    HStack(spacing: 16) {
                        if let temp = current.tempC {
                            VStack(spacing: 2) {
                                Text(String(format: "%.0f°C", temp))
                                    .font(.title2.bold())
                                if let feels = current.feelslikeC {
                                    Text("Feels \(String(format: "%.0f", feels))°")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        VStack(alignment: .leading, spacing: 4) {
                            if let cond = current.condition?.text {
                                Text(cond).font(.subheadline)
                            }
                            if let humidity = current.humidity {
                                Label("\(humidity)%", systemImage: "humidity")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            if let wind = current.windKph {
                                Label(String(format: "%.0f km/h", wind), systemImage: "wind")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .padding(.top, 4)
        } else {
            GenericToolView(data: data)
        }
    }
}

// MARK: - Catalog Tool Result

private struct CatalogToolView: View {
    let data: Data

    private struct CatalogOutput: Decodable {
        let success: Bool?
        let data: DataWrapper?

        struct DataWrapper: Decodable {
            let items: [Item]?
            var asList: [Item] { items ?? [] }

            init(from decoder: Decoder) throws {
                if let c = try? decoder.container(keyedBy: CodingKeys.self) {
                    items = try? c.decodeIfPresent([Item].self, forKey: .items)
                } else if let arr = try? [Item](from: decoder) {
                    items = arr
                } else {
                    items = nil
                }
            }

            enum CodingKeys: String, CodingKey { case items }
        }

        struct Item: Decodable, Identifiable {
            var id: String { name ?? UUID().uuidString }
            let name: String?
            let brand: String?
            let weight: Double?
            let weightUnit: String?
            let price: Double?
        }
    }

    var body: some View {
        if let result = try? JSONDecoder().decode(CatalogOutput.self, from: data),
           let items = result.data?.asList, !items.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                ForEach(items.prefix(5)) { item in
                    HStack {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(item.name ?? "Unknown").font(.caption.bold())
                            if let brand = item.brand {
                                Text(brand).font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        if let weight = item.weight, let unit = item.weightUnit {
                            Text("\(String(format: "%.0f", weight)) \(unit)")
                                .font(.caption2.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 2)
                    if items.prefix(5).last?.id != item.id { Divider() }
                }
            }
            .padding(.top, 4)
        } else {
            GenericToolView(data: data)
        }
    }
}

// MARK: - Pack Details Tool Result

private struct PackDetailsToolView: View {
    let data: Data

    private struct PackOutput: Decodable {
        let success: Bool?
        let data: PackData?
        struct PackData: Decodable {
            let name: String?
            let totalWeight: Double?
            let baseWeight: Double?
            let items: [Item]?
            struct Item: Decodable { let name: String?; let weight: Double? }
        }
    }

    var body: some View {
        if let result = try? JSONDecoder().decode(PackOutput.self, from: data),
           result.success == true, let pack = result.data {
            VStack(alignment: .leading, spacing: 6) {
                if let name = pack.name {
                    Text(name).font(.subheadline.bold())
                }
                HStack(spacing: 16) {
                    if let total = pack.totalWeight {
                        labeledValue("Total", value: formatWeight(total))
                    }
                    if let base = pack.baseWeight {
                        labeledValue("Base", value: formatWeight(base))
                    }
                    if let count = pack.items?.count {
                        labeledValue("Items", value: "\(count)")
                    }
                }
            }
            .padding(.top, 4)
        } else {
            GenericToolView(data: data)
        }
    }

    private func labeledValue(_ label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.callout.bold().monospacedDigit())
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
    }

    private func formatWeight(_ g: Double) -> String {
        g >= 1000 ? String(format: "%.1fkg", g / 1000) : String(format: "%.0fg", g)
    }
}

// MARK: - Web Search Tool Result

private struct WebSearchToolView: View {
    let data: Data

    private struct SearchOutput: Decodable {
        let success: Bool?
        let data: SearchData?
        struct SearchData: Decodable {
            let answer: String?
            let summary: String?
            let content: String?
        }
    }

    var body: some View {
        if let result = try? JSONDecoder().decode(SearchOutput.self, from: data),
           let text = result.data?.answer ?? result.data?.summary ?? result.data?.content {
            Text(text)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(4)
                .padding(.top, 4)
        } else {
            EmptyView()
        }
    }
}

// MARK: - Generic Tool Result

private struct GenericToolView: View {
    let data: Data

    var body: some View {
        if let str = String(data: data, encoding: .utf8) {
            Text(str)
                .font(.caption2.monospaced())
                .foregroundStyle(.secondary)
                .lineLimit(3)
                .padding(.top, 4)
        }
    }
}
