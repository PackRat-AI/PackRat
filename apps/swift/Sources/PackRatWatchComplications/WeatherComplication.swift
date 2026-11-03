import SwiftUI
import WidgetKit

@main
struct PackRatComplications: WidgetBundle {
    var body: some Widget {
        WeatherComplication()
    }
}

/// Weather on the watch face. While any saved location has an alert the user
/// has not opened, the alert takes the slot in every family — it outranks the
/// temperature, which is the reason someone outdoors raised their wrist. The
/// alert is carried by a warning glyph as well as colour, so it survives the
/// tinted watch faces that desaturate everything to one hue.
struct WeatherComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "PackRatWeather", provider: WeatherComplicationProvider()) { entry in
            WeatherComplicationView(entry: entry)
        }
        .configurationDisplayName("Weather")
        .description("Current conditions, and alerts for your saved places.")
        .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryInline, .accessoryRectangular])
    }
}

struct WeatherComplicationEntry: TimelineEntry {
    let date: Date
    let weather: WatchWeatherSnapshot

    /// Lifts the rectangular widget to the top of the Smart Stack while an
    /// alert is waiting, and leaves it in the ordinary rotation otherwise.
    var relevance: TimelineEntryRelevance? {
        TimelineEntryRelevance(score: weather.alert == nil ? 1 : 100)
    }
}

struct WeatherComplicationProvider: TimelineProvider {
    func placeholder(in context: Context) -> WeatherComplicationEntry {
        WeatherComplicationEntry(date: .now, weather: PackRatWatchSnapshot.visualSyncedSample.weather)
    }

    func getSnapshot(in context: Context, completion: @escaping (WeatherComplicationEntry) -> Void) {
        let weather = context.isPreview
            ? PackRatWatchSnapshot.visualSyncedSample.weather
            : WatchComplicationStore.loadWeather() ?? PackRatWatchSnapshot.fallback.weather
        completion(WeatherComplicationEntry(date: .now, weather: weather))
    }

    /// One entry, never self-refreshing: the state only changes when the phone
    /// sends the watch a new snapshot, and the watch app reloads the timeline
    /// then.
    func getTimeline(in context: Context, completion: @escaping (Timeline<WeatherComplicationEntry>) -> Void) {
        let weather = WatchComplicationStore.loadWeather() ?? PackRatWatchSnapshot.fallback.weather
        completion(Timeline(entries: [WeatherComplicationEntry(date: .now, weather: weather)], policy: .never))
    }
}

struct WeatherComplicationView: View {
    @Environment(\.widgetFamily) private var family
    let entry: WeatherComplicationEntry

    private var weather: WatchWeatherSnapshot { entry.weather }

    var body: some View {
        content
            .widgetURL(WatchDeepLink.weather)
            .containerBackground(for: .widget) {
                if let alert = weather.alert {
                    alert.severityColor.opacity(0.3)
                }
            }
    }

    @ViewBuilder private var content: some View {
        switch family {
        case .accessoryCircular: circular
        case .accessoryCorner: corner
        case .accessoryInline: inline
        default: rectangular
        }
    }

    // MARK: Circular

    @ViewBuilder private var circular: some View {
        ZStack {
            AccessoryWidgetBackground()
            if let alert = weather.alert {
                VStack(spacing: 0) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.title3)
                        .foregroundStyle(alert.severityColor)
                        .widgetAccentable()
                    Text("Alert")
                        .font(.system(.caption2, design: .rounded).weight(.semibold))
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Weather alert: \(alert.headline)")
            } else {
                VStack(spacing: 0) {
                    Image(systemName: weather.symbolName)
                        .font(.body)
                        .widgetAccentable()
                    Text(weather.temperatureText)
                        .font(.system(.body, design: .rounded).weight(.medium))
                        .minimumScaleFactor(0.6)
                }
            }
        }
    }

    // MARK: Corner

    @ViewBuilder private var corner: some View {
        if let alert = weather.alert {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.title2)
                .foregroundStyle(alert.severityColor)
                .widgetAccentable()
                .widgetLabel { Text(alert.headline) }
                .accessibilityLabel("Weather alert: \(alert.headline)")
        } else {
            Image(systemName: weather.symbolName)
                .font(.title2)
                .widgetAccentable()
                .widgetLabel { Text(weather.temperatureText) }
        }
    }

    // MARK: Inline

    @ViewBuilder private var inline: some View {
        if let alert = weather.alert {
            Label(alert.headline, systemImage: "exclamationmark.triangle.fill")
        } else {
            Label(weather.temperatureText, systemImage: weather.symbolName)
        }
    }

    // MARK: Rectangular

    @ViewBuilder private var rectangular: some View {
        if let alert = weather.alert {
            VStack(alignment: .leading, spacing: 1) {
                Label(alert.headline, systemImage: "exclamationmark.triangle.fill")
                    .font(.headline)
                    .foregroundStyle(alert.severityColor)
                    .lineLimit(1)
                    .widgetAccentable()
                Text(alert.locationName)
                    .lineLimit(1)
                Text(alert.othersText ?? weather.temperatureText)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
        } else {
            VStack(alignment: .leading, spacing: 1) {
                Label(weather.locationName, systemImage: weather.symbolName)
                    .font(.headline)
                    .lineLimit(1)
                    .widgetAccentable()
                Text(weather.temperatureText)
                    .font(.system(.title3, design: .rounded).weight(.semibold))
                Text(weather.conditionText)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
