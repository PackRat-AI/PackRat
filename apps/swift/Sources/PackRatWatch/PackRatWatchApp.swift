import SwiftUI

@main
struct PackRatWatchApp: App {
    @State private var connectivity = WatchConnectivityStore()

    var body: some Scene {
        WindowGroup {
            WatchRootView()
                .environment(connectivity)
                .task {
                    guard ProcessInfo.processInfo.environment["PACKRAT_WATCH_DISABLE_CONNECTIVITY"] != "1" else {
                        return
                    }
                    connectivity.activate()
                }
        }
    }
}

private struct WatchRootView: View {
    @Environment(WatchConnectivityStore.self) private var connectivity

    var body: some View {
        switch ProcessInfo.processInfo.environment["PACKRAT_WATCH_SCREENSHOT_ROUTE"] {
        case "dashboard":
            TrailReadyView(snapshot: connectivity.snapshot, isPhoneReachable: connectivity.isPhoneReachable)
        case "checklist":
            WatchChecklistView(pack: connectivity.snapshot.pack)
        case "weather":
            WatchWeatherView(weather: connectivity.snapshot.weather)
        case "trail-report":
            WatchTrailReportView(trail: connectivity.snapshot.trail)
        case "trail-report-draft":
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
                        VStack(alignment: .leading, spacing: 10) {
                            Label(snapshot.pack.name, systemImage: "checkmark.seal.fill")
                                .font(.headline)
                                .foregroundStyle(.green)
                                .lineLimit(2)

                            Text(tripSubtitle)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                                .fixedSize(horizontal: false, vertical: true)

                            Divider()

                            WatchMetricRow(title: "Base", value: snapshot.pack.baseWeightText, symbol: "scalemass")
                            WatchMetricRow(
                                title: "Packed",
                                value: "\(snapshot.pack.packedItemCount)/\(snapshot.pack.totalItemCount)",
                                symbol: "backpack"
                            )
                            WatchMetricRow(title: "Weather", value: snapshot.weather.temperatureText, symbol: snapshot.weather.symbolName)
                        }
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

    private var tripSubtitle: String {
        guard let trip = snapshot.trip else {
            return "Quick wrist access for the next pack, weather, and trail notes."
        }
        return [trip.locationName, trip.dateText]
            .compactMap { $0 }
            .joined(separator: " - ")
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
                        Text("\(pack.packedItemCount) of \(pack.totalItemCount) packed")
                            .font(.caption)
                            .foregroundStyle(.secondary)
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
                            .lineLimit(2)
                        Text(weather.temperatureText)
                            .font(.system(size: 38, weight: .semibold, design: .rounded))
                        Text(weather.conditionText)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
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
                    VStack(alignment: .leading, spacing: 10) {
                        Label(trail.title, systemImage: "figure.hiking")
                            .font(.headline)
                            .lineLimit(2)
                        if connectivity.lastDraft != nil {
                            Label("Draft queued", systemImage: "checkmark.circle.fill")
                                .font(.caption)
                                .foregroundStyle(.green)
                        }
                        WatchMetricRow(title: "Condition", value: trail.conditionText, symbol: "leaf")
                        WatchMetricRow(title: "Hazards", value: "\(trail.hazardCount)", symbol: "exclamationmark.triangle")
                    }
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
                    Label(
                        connectivity.lastDraft == nil ? "Drafts sync when iPhone is available." : "Draft queued for iPhone sync.",
                        systemImage: connectivity.lastDraft == nil ? "arrow.triangle.2.circlepath" : "checkmark.circle.fill"
                    )
                        .font(.footnote)
                        .foregroundStyle(connectivity.lastDraft == nil ? Color.secondary : Color.green)
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
