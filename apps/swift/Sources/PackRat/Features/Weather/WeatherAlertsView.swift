import SwiftUI

struct WeatherAlertsView: View {
    let alerts: [WeatherAlert]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if alerts.isEmpty {
                    UnavailableStateView(
                        title: "No Active Alerts",
                        subtitle: "No weather alerts for this location",
                        systemImage: "checkmark.shield"
                    )
                } else {
                    List(alerts) { alert in
                        AlertRow(alert: alert)
                    }
                    #if os(iOS)
                    .listStyle(.insetGrouped)
                    #endif
                }
            }
            .navigationTitle("Weather Alerts")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .formSheetSize(minWidth: 520, minHeight: 420)
    }
}

private struct AlertRow: View {
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
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(severityColor)
                    .font(.callout)

                VStack(alignment: .leading, spacing: 2) {
                    Text(alert.event ?? alert.headline ?? "Weather Alert")
                        .font(.body.bold())
                        .lineLimit(2)
                    if let severity = alert.severity {
                        Text(severity.capitalized)
                            .font(.caption.bold())
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(severityColor.opacity(0.15), in: Capsule())
                            .foregroundStyle(severityColor)
                    }
                }

                Spacer()
                Button {
                    withAnimation(.spring(duration: 0.25)) { expanded.toggle() }
                } label: {
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }

            if let areas = alert.areas, !areas.isEmpty {
                Label(areas, systemImage: "mappin.and.ellipse")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            if expanded {
                VStack(alignment: .leading, spacing: 10) {
                    if let effective = alert.effective, let expires = alert.expires {
                        HStack(spacing: 16) {
                            alertTime("From", value: formatAlertDate(effective))
                            alertTime("Until", value: formatAlertDate(expires))
                        }
                    }

                    if let desc = alert.desc, !desc.isEmpty {
                        Text(desc)
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }

                    if let instruction = alert.instruction, !instruction.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Label("Instructions", systemImage: "info.circle")
                                .font(.caption.bold())
                                .foregroundStyle(.secondary)
                            Text(instruction)
                                .font(.callout)
                        }
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(.vertical, 4)
    }

    private func alertTime(_ label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2).foregroundStyle(.secondary)
            Text(value).font(.caption.bold())
        }
    }

    private func formatAlertDate(_ str: String) -> String {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = iso.date(from: str) {
            return date.formatted(.dateTime.month(.abbreviated).day().hour().minute())
        }
        iso.formatOptions = [.withInternetDateTime]
        if let date = iso.date(from: str) {
            return date.formatted(.dateTime.month(.abbreviated).day().hour().minute())
        }
        return str
    }
}
