import SwiftUI

/// The year and activity filters at the top of Trip Stats: two pull-down
/// buttons that read as what's showing ("2025", "Hiking"), plus a clear
/// button once either narrows the record.
struct TripStatsScopeBar: View {
    @Binding var scope: TripStats.Scope
    let years: [Int]
    let activities: [TripActivity]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Menu {
                    #if os(macOS)
                    // Plain buttons on the Mac: a Picker in a Menu there applied
                    // a filter as the pointer passed over it.
                    choice("All Time", selected: scope.year == nil) { scope.year = nil }
                    ForEach(years, id: \.self) { year in
                        choice(String(year), selected: scope.year == year) { scope.year = year }
                    }
                    #else
                    Picker("Year", selection: $scope.year) {
                        Text("All Time").tag(Int?.none)
                        ForEach(years, id: \.self) { year in
                            Text(String(year)).tag(Int?.some(year))
                        }
                    }
                    #endif
                } label: {
                    chip(scope.year.map(String.init) ?? "All Time", active: scope.year != nil)
                }
                .accessibilityLabel("Year, \(scope.year.map(String.init) ?? "All Time")")
                .accessibilityIdentifier("trip_stats_scope_year")

                if !activities.isEmpty {
                    Menu {
                        #if os(macOS)
                        choice("All Activities", selected: scope.activity == nil) { scope.activity = nil }
                        ForEach(activities) { activity in
                            choice(activity.label, selected: scope.activity == activity) { scope.activity = activity }
                        }
                        #else
                        Picker("Activity", selection: $scope.activity) {
                            Text("All Activities").tag(TripActivity?.none)
                            ForEach(activities) { activity in
                                Label(activity.label, systemImage: activity.symbol).tag(TripActivity?.some(activity))
                            }
                        }
                        #endif
                    } label: {
                        chip(scope.activity?.label ?? "All Activities", symbol: scope.activity?.symbol, active: scope.activity != nil)
                    }
                    .accessibilityLabel("Activity, \(scope.activity?.label ?? "All Activities")")
                    .accessibilityIdentifier("trip_stats_scope_activity")
                }

                if !scope.isAll {
                    Button("Clear", systemImage: "xmark.circle.fill") { scope = .all }
                        .labelStyle(.iconOnly)
                        .font(.title3)
                        .foregroundStyle(.secondary)
                        .accessibilityLabel("Show all trips")
                        .accessibilityIdentifier("trip_stats_scope_clear")
                }
            }
        }
        .animation(.default, value: scope)
    }

    #if os(macOS)
    /// A menu row that applies only when clicked, ticked when it's showing.
    private func choice(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            if selected { Label(title, systemImage: "checkmark") } else { Text(title) }
        }
    }
    #endif

    private func chip(_ title: String, symbol: String? = nil, active: Bool) -> some View {
        HStack(spacing: 6) {
            if let symbol { Image(systemName: symbol) }
            Text(title)
            Image(systemName: "chevron.down").font(.caption2.weight(.semibold))
        }
        .font(.subheadline.weight(.medium))
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(active ? Color.accentColor : Color.secondary.opacity(0.14), in: Capsule())
        .foregroundStyle(active ? Color.white : Color.primary)
    }

    /// What the record is showing, for the totals header: "All Time",
    /// "2025", "Hiking" or "Hiking in 2025".
    static func title(_ scope: TripStats.Scope) -> String {
        switch (scope.year, scope.activity) {
        case (nil, nil): return "All Time"
        case (let year?, nil): return String(year)
        case (nil, let activity?): return activity.label
        case (let year?, let activity?): return "\(activity.label) in \(year)"
        }
    }
}
