import SwiftUI

/// The active-alert section of the forecast, rendered inline among the other
/// forecast sections rather than as a banner over them
/// (see docs/features/weather-alerts.md ADR-006). It cannot be dismissed: a
/// hazard is part of what the forecast for this location says, so it stays
/// as long as it is active.
///
/// Severity is carried by the leading edge of each card rather than by
/// flooding the whole card, which keeps a stack of alerts legible when more
/// than one is active without reading as an alarm.
struct ForecastAlertSection: View {
    let alerts: [WeatherAlert]
    /// Whether to show the watch call to action. False once the location is
    /// already watched — the section then shows a quiet confirmation, so the
    /// in-section CTA and the toolbar control are never both actionable.
    let showsWatchCallToAction: Bool
    let isWatched: Bool
    let isUpdatingWatch: Bool
    let onWatch: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(alerts.count == 1 ? "ACTIVE ALERT" : "ACTIVE ALERTS")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white.opacity(0.7))
                .padding(.horizontal, 4)

            VStack(spacing: 8) {
                // Keyed by offset as well as identity: two genuinely
                // identical alerts would otherwise collide onto one row and
                // share its expand/collapse state.
                ForEach(Array(alerts.enumerated()), id: \.offset) { _, alert in
                    ForecastAlertCard(alert: alert)
                }
            }

            if showsWatchCallToAction {
                watchCallToAction
            } else if isWatched {
                watchedConfirmation
            }
        }
        .accessibilityIdentifier("forecast_alert_section")
    }

    private var watchCallToAction: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Get notified about new alerts here, even when the app is closed.")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.8))
            Button(action: onWatch) {
                if isUpdatingWatch {
                    ProgressView().controlSize(.small)
                } else {
                    Text("Watch This Location")
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
            .disabled(isUpdatingWatch)
            .accessibilityIdentifier("forecast_alert_watch_button")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 4)
        .padding(.top, 2)
    }

    private var watchedConfirmation: some View {
        Label("You are watching this location", systemImage: "checkmark.circle.fill")
            .font(.caption)
            .foregroundStyle(.white.opacity(0.8))
            .padding(.horizontal, 4)
            .accessibilityIdentifier("forecast_alert_watched_confirmation")
    }
}

/// A single alert, collapsed to its headline until tapped. Mirrors the
/// Alerts screen's row so the same hazard reads the same way in both places.
private struct ForecastAlertCard: View {
    let alert: WeatherAlert
    @State private var expanded = false

    private var severityColor: Color {
        switch alert.severity?.lowercased() {
        case "extreme":  return .red
        case "severe":   return .orange
        case "moderate": return .yellow
        default:         return .blue
        }
    }

    var body: some View {
        Button {
            withAnimation(.snappy) { expanded.toggle() }
        } label: {
            HStack(alignment: .top, spacing: 0) {
                Rectangle()
                    .fill(severityColor)
                    .frame(width: 4)

                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(severityColor)
                            .font(.callout)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(alert.event ?? alert.headline ?? "Weather Alert")
                                .font(.subheadline.bold())
                                .foregroundStyle(.white)
                                .multilineTextAlignment(.leading)
                            if let severity = alert.severity, !severity.isEmpty {
                                Text(severity.capitalized)
                                    .font(.caption)
                                    .foregroundStyle(.white.opacity(0.75))
                            }
                        }

                        Spacer(minLength: 0)

                        Image(systemName: expanded ? "chevron.up" : "chevron.down")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.75))
                    }

                    if expanded {
                        if let areas = alert.areas, !areas.isEmpty {
                            Text(areas)
                                .font(.caption)
                                .foregroundStyle(.white.opacity(0.75))
                        }
                        if let desc = alert.desc, !desc.isEmpty {
                            Text(desc)
                                .font(.caption)
                                .foregroundStyle(.white.opacity(0.9))
                                .multilineTextAlignment(.leading)
                        }
                        if let instruction = alert.instruction, !instruction.isEmpty {
                            Text(instruction)
                                .font(.caption.bold())
                                .foregroundStyle(.white)
                                .multilineTextAlignment(.leading)
                        }
                    }
                }
                .padding(12)
            }
        }
        .buttonStyle(.plain)
        .background(WeatherGlassCard.fill, in: RoundedRectangle(cornerRadius: 12))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .accessibilityIdentifier("forecast_alert_card")
    }
}
