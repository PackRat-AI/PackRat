import SwiftUI

@main
struct PackRatWatchApp: App {
    var body: some Scene {
        WindowGroup {
            WatchDashboardView()
        }
    }
}

private struct WatchDashboardView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            TrailReadyView()
                .tag(0)
            WatchChecklistView()
                .tag(1)
            WatchWeatherView()
                .tag(2)
            WatchTrailReportView()
                .tag(3)
        }
        .tabViewStyle(.verticalPage)
    }
}

private struct TrailReadyView: View {
    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Trail Ready", systemImage: "checkmark.seal.fill")
                            .font(.headline)
                            .foregroundStyle(.green)

                        Text("Quick wrist access for the next pack, weather, and trail notes.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                Section("Today") {
                    WatchMetricRow(title: "Base Weight", value: "18.4 lb", symbol: "scalemass")
                    WatchMetricRow(title: "Packed", value: "12 of 15", symbol: "backpack")
                    WatchMetricRow(title: "Weather", value: "64° Clear", symbol: "sun.max")
                }
            }
            .navigationTitle("PackRat")
        }
    }
}

private struct WatchChecklistView: View {
    @AppStorage("watch.checklist.shelter") private var shelterPacked = true
    @AppStorage("watch.checklist.water") private var waterPacked = false
    @AppStorage("watch.checklist.firstAid") private var firstAidPacked = true
    @AppStorage("watch.checklist.layers") private var layersPacked = false

    var body: some View {
        NavigationStack {
            List {
                Section("Pack") {
                    WatchChecklistToggle(title: "Shelter", symbol: "tent", isOn: $shelterPacked)
                    WatchChecklistToggle(title: "Water", symbol: "drop", isOn: $waterPacked)
                    WatchChecklistToggle(title: "First Aid", symbol: "cross.case", isOn: $firstAidPacked)
                    WatchChecklistToggle(title: "Layers", symbol: "jacket", isOn: $layersPacked)
                }
            }
            .navigationTitle("Checklist")
        }
    }
}

private struct WatchWeatherView: View {
    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        Label("Denver", systemImage: "location.fill")
                            .font(.headline)
                        Text("64°")
                            .font(.system(size: 38, weight: .semibold, design: .rounded))
                        Text("Clear. Wind 5 mph.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }

                Section("Next 3 hours") {
                    WatchMetricRow(title: "Now", value: "64°", symbol: "sun.max")
                    WatchMetricRow(title: "1 PM", value: "67°", symbol: "sun.max")
                    WatchMetricRow(title: "2 PM", value: "68°", symbol: "cloud.sun")
                }
            }
            .navigationTitle("Weather")
        }
    }
}

private struct WatchTrailReportView: View {
    @State private var selectedCondition = "Good"
    private let conditions = ["Good", "Muddy", "Snow", "Closed"]

    var body: some View {
        NavigationStack {
            List {
                Section("Condition") {
                    Picker("Condition", selection: $selectedCondition) {
                        ForEach(conditions, id: \.self) { condition in
                            Text(condition).tag(condition)
                        }
                    }
                }

                Section {
                    Button {
                    } label: {
                        Label("Save Draft", systemImage: "square.and.pencil")
                    }
                    .buttonStyle(.borderedProminent)
                }

                Section {
                    Text("Drafts sync when the iPhone app connection is available.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Trail Report")
        }
    }
}

private struct WatchMetricRow: View {
    let title: String
    let value: String
    let symbol: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: symbol)
                .foregroundStyle(.tint)
                .frame(width: 18)
            Text(title)
            Spacer()
            Text(value)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .font(.caption)
    }
}

private struct WatchChecklistToggle: View {
    let title: String
    let symbol: String
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: $isOn) {
            Label(title, systemImage: symbol)
        }
    }
}
