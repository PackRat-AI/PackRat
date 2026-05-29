import SwiftUI

@main
struct PackRatWatchApp: App {
    @State private var connectivity = WatchConnectivityStore()

    var body: some Scene {
        WindowGroup {
            WatchRootView()
                .environment(connectivity)
                .task {
                    connectivity.activate()
                }
        }
    }
}

private struct WatchRootView: View {
    @Environment(WatchConnectivityStore.self) private var connectivity

    var body: some View {
        switch ProcessInfo.processInfo.environment["PACKRAT_WATCH_SCREENSHOT_ROUTE"] {
        case "checklist":
            WatchChecklistView(pack: connectivity.snapshot.pack)
        case "weather":
            WatchWeatherView(weather: connectivity.snapshot.weather)
        case "trail-report":
            WatchTrailReportView(trail: connectivity.snapshot.trail)
        default:
            WatchDashboardView()
        }
    }
}

private struct WatchDashboardView: View {
    @Environment(WatchConnectivityStore.self) private var connectivity
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            TrailReadyView(snapshot: connectivity.snapshot, isPhoneReachable: connectivity.isPhoneReachable)
                .tag(0)
            WatchChecklistView(pack: connectivity.snapshot.pack)
                .tag(1)
            WatchWeatherView(weather: connectivity.snapshot.weather)
                .tag(2)
            WatchTrailReportView(trail: connectivity.snapshot.trail)
                .tag(3)
        }
        .tabViewStyle(.verticalPage)
    }
}

private struct TrailReadyView: View {
    let snapshot: PackRatWatchSnapshot
    let isPhoneReachable: Bool
    private var hasSyncedPack: Bool {
        snapshot.pack.totalItemCount > 0 || !snapshot.pack.checklist.isEmpty
    }

    var body: some View {
        NavigationStack {
            List {
                if hasSyncedPack {
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            Label(snapshot.pack.name, systemImage: "checkmark.seal.fill")
                                .font(.headline)
                                .foregroundStyle(.green)

                            Text(snapshot.trip?.name ?? "Quick wrist access for the next pack, weather, and trail notes.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }

                    Section("Today") {
                        WatchMetricRow(title: "Base Weight", value: snapshot.pack.baseWeightText, symbol: "scalemass")
                        WatchMetricRow(
                            title: "Packed",
                            value: "\(snapshot.pack.packedItemCount) of \(snapshot.pack.totalItemCount)",
                            symbol: "backpack"
                        )
                        WatchMetricRow(
                            title: "Weather",
                            value: "\(snapshot.weather.temperatureText) \(snapshot.weather.conditionText)",
                            symbol: snapshot.weather.symbolName
                        )
                    }
                } else {
                    Section {
                        ContentUnavailableView(
                            "Sync from iPhone",
                            systemImage: "iphone",
                            description: Text("Open PackRat on iPhone to send your active pack, weather, and trail context.")
                        )
                    }
                }

                Section {
                    Label(isPhoneReachable ? "iPhone Nearby" : "Last Synced", systemImage: isPhoneReachable ? "iphone" : "clock")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("PackRat")
        }
    }
}

private struct WatchChecklistView: View {
    let pack: WatchPackSnapshot

    var body: some View {
        NavigationStack {
            List {
                Section("Pack") {
                    if pack.checklist.isEmpty {
                        ContentUnavailableView("No Items", systemImage: "checklist", description: Text("Open a pack on iPhone to sync checklist items."))
                    } else {
                        ForEach(pack.checklist) { item in
                            WatchChecklistToggle(item: item)
                        }
                    }
                }
            }
            .navigationTitle("Checklist")
        }
    }
}

private struct WatchWeatherView: View {
    let weather: WatchWeatherSnapshot

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        Label(weather.locationName, systemImage: "location.fill")
                            .font(.headline)
                        Text(weather.temperatureText)
                            .font(.system(size: 38, weight: .semibold, design: .rounded))
                        Text(weather.conditionText)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }

                Section("Trail") {
                    WatchMetricRow(title: "Condition", value: weather.conditionText, symbol: weather.symbolName)
                }
            }
            .navigationTitle("Weather")
        }
    }
}

private struct WatchTrailReportView: View {
    @Environment(WatchConnectivityStore.self) private var connectivity
    @State private var selectedCondition = "Good"
    @State private var note = ""
    private let conditions = ["Good", "Muddy", "Snow", "Closed"]
    let trail: WatchTrailSnapshot

    var body: some View {
        NavigationStack {
            List {
                Section {
                    WatchMetricRow(title: trail.title, value: trail.conditionText, symbol: "figure.hiking")
                    WatchMetricRow(title: "Hazards", value: "\(trail.hazardCount)", symbol: "exclamationmark.triangle")
                }

                Section("Condition") {
                    Picker("Condition", selection: $selectedCondition) {
                        ForEach(conditions, id: \.self) { condition in
                            Text(condition).tag(condition)
                        }
                    }
                }

                Section("Note") {
                    TextField("Optional note", text: $note)
                }

                Section {
                    Button {
                        connectivity.saveTrailDraft(condition: selectedCondition, note: note)
                    } label: {
                        Label("Save Draft", systemImage: "square.and.pencil")
                    }
                    .buttonStyle(.borderedProminent)
                }

                Section {
                    Text(connectivity.lastDraft == nil ? "Drafts sync when the iPhone app connection is available." : "Draft saved for iPhone sync.")
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
    let item: WatchChecklistItemSnapshot
    @State private var isOn: Bool

    init(item: WatchChecklistItemSnapshot) {
        self.item = item
        _isOn = State(initialValue: item.isPacked)
    }

    var body: some View {
        Toggle(isOn: $isOn) {
            Label(item.title, systemImage: item.symbolName)
        }
    }
}
