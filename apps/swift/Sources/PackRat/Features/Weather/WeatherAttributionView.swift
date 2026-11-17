import SwiftUI

/// The Apple Weather mark and its legal link, shown under any forecast that
/// includes Apple Weather days — Apple's terms require both wherever that
/// data appears. `onDarkBackground` picks the white mark for the sky
/// gradient; otherwise the mark follows the color scheme.
struct WeatherAttributionView: View {
    let attribution: WeatherAttribution
    var onDarkBackground = false

    @Environment(\.colorScheme) private var colorScheme

    private var usesDarkMark: Bool { onDarkBackground || colorScheme == .dark }

    var body: some View {
        HStack(spacing: 8) {
            AsyncImage(url: usesDarkMark ? attribution.logoDarkUrl : attribution.logoLightUrl) { image in
                image.resizable().scaledToFit()
            } placeholder: {
                Text(attribution.serviceName)
                    .font(.caption2.weight(.semibold))
            }
            .frame(height: 12)
            .accessibilityLabel(attribution.serviceName)

            Link("Legal", destination: attribution.legalPageUrl)
                .font(.caption2)
                .underline()
        }
        .foregroundStyle(onDarkBackground ? AnyShapeStyle(.white.opacity(0.7)) : AnyShapeStyle(.secondary))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("weather_attribution")
    }
}
