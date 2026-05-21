import Foundation

struct WeatherLocation: Codable, Identifiable, Sendable {
    let id: Int
    let name: String
    let region: String?
    let country: String?
    let lat: Double?
    let lon: Double?

    var displayName: String {
        [name, region, country].compactMap { $0?.nilIfEmpty }.prefix(2).joined(separator: ", ")
    }
}

struct WeatherForecastResponse: Codable, Sendable {
    let location: WeatherResponseLocation?
    let current: WeatherCurrent?
    let forecast: WeatherForecast?
    let alerts: WeatherAlertsWrapper?
}

struct WeatherAlertsWrapper: Codable, Sendable {
    let alert: [WeatherAlert]?
}

struct WeatherAlert: Codable, Identifiable, Sendable {
    var id: String { headline ?? UUID().uuidString }
    let headline: String?
    let event: String?
    let severity: String?
    let urgency: String?
    let areas: String?
    let effective: String?
    let expires: String?
    let desc: String?
    let instruction: String?

    var severityColor: String {
        switch severity?.lowercased() {
        case "extreme":  return "red"
        case "severe":   return "orange"
        case "moderate": return "yellow"
        default:         return "blue"
        }
    }
}

struct WeatherResponseLocation: Codable, Sendable {
    let id: Int?
    let name: String?
    let region: String?
    let country: String?
    let lat: Double?
    let lon: Double?
    let localtime: String?
    let localtimeEpoch: Int?
    let tzId: String?
}

struct WeatherCurrent: Codable, Sendable {
    let tempC: Double?
    let tempF: Double?
    let feelslikeC: Double?
    let feelslikeF: Double?
    let humidity: Int?
    let windMph: Double?
    let windKph: Double?
    let windDir: String?
    let condition: WeatherCondition?
    let uv: Double?
    let visMiles: Double?
    let precipIn: Double?
    let cloud: Int?
    let isDay: Int?
}

struct WeatherCondition: Codable, Sendable {
    let text: String?
    let icon: String?
    let code: Int?

    var sfSymbol: String {
        guard let code else { return "cloud" }
        switch code {
        case 1000: return "sun.max"
        case 1003: return "cloud.sun"
        case 1006, 1009: return "cloud"
        case 1030, 1135, 1147: return "cloud.fog"
        case 1063, 1180...1201: return "cloud.rain"
        case 1066, 1210...1225: return "cloud.snow"
        case 1087, 1273...1282: return "cloud.bolt.rain"
        default: return "cloud"
        }
    }
}

struct WeatherForecast: Codable, Sendable {
    let forecastday: [ForecastDay]?
}

struct ForecastDay: Codable, Identifiable, Sendable {
    var id: String { date ?? UUID().uuidString }
    let date: String?
    let dateEpoch: Int?
    let day: DayForecast?
    let astro: AstroForecast?

    var displayDate: String {
        guard let str = date,
              let d = try? Date(str, strategy: .iso8601.year().month().day())
        else { return date ?? "" }
        let cal = Calendar.current
        if cal.isDateInToday(d) { return "Today" }
        if cal.isDateInTomorrow(d) { return "Tomorrow" }
        return d.formatted(.dateTime.weekday(.wide))
    }
}

struct DayForecast: Codable, Sendable {
    let maxtempF: Double?
    let mintempF: Double?
    let maxtempC: Double?
    let mintempC: Double?
    let totalprecipIn: Double?
    let avghumidity: Int?
    let condition: WeatherCondition?
    let uv: Double?
    let dailyChanceOfRain: Int?
    let dailyChanceOfSnow: Int?
}

struct AstroForecast: Codable, Sendable {
    let sunrise: String?
    let sunset: String?
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
