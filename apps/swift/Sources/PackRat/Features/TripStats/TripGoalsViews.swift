import SwiftUI

// MARK: - Opt-in

/// The first visit to Trip Stats, and any visit while it's off: what the
/// screen shows, who sees it, and one action to turn it on.
struct TripStatsOptInView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        let goalsVM = appState.tripGoalsVM
        ScrollView {
            VStack(spacing: 28) {
                VStack(spacing: 12) {
                    Image(systemName: "chart.bar.xaxis")
                        .font(.system(size: 44, weight: .semibold))
                        .foregroundStyle(Color.accentColor)
                        .frame(width: 88, height: 88)
                        .background(Color.accentColor.opacity(0.12), in: Circle())
                        .accessibilityHidden(true)
                    Text("Your Trip Stats")
                        .font(.largeTitle.weight(.bold))
                    Text("See what your trips add up to, and set goals for the year ahead.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                VStack(alignment: .leading, spacing: 18) {
                    feature("square.grid.2x2.fill", "Your record", "Trips, nights out, days outdoors, distance and climbing, with this year beside last.")
                    feature("target", "Goals", "Set a target for the year or any stretch of dates, and see if you're ahead of pace.")
                    feature("map.fill", "Where you've been", "Every finished trip and logged route on one map.")
                    feature("backpack.fill", "Your gear", "What you pack most, from the packs linked to your trips.")
                }
                .frame(maxWidth: 440, alignment: .leading)

                Label {
                    Text(goalsVM.isTurnedOff
                        ? "Your trip logs were kept while stats were off. Only you see your stats."
                        : "Only you see your stats. Nothing is shared unless you share it.")
                } icon: {
                    Image(systemName: "lock.fill")
                }
                .font(.footnote)
                .foregroundStyle(.secondary)
                .frame(maxWidth: 440, alignment: .leading)

                Button {
                    Task { await goalsVM.setEnabled(true, context: modelContext) }
                } label: {
                    Text("Turn On Trip Stats")
                        .font(.headline)
                        .frame(maxWidth: 440, minHeight: 50)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.roundedRectangle(radius: 14))
                .accessibilityIdentifier("trip_stats_turn_on")
            }
            .padding(24)
            .padding(.top, 24)
            .frame(maxWidth: .infinity)
        }
        .accessibilityIdentifier("trip_stats_opt_in")
    }

    private func feature(_ symbol: String, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol)
                .font(.title3)
                .foregroundStyle(Color.accentColor)
                .frame(width: 32)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline)
                Text(detail).font(.subheadline).foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Goals

/// Current goals as cards, with a quiet invitation when there are none.
/// Goals whose window has closed move to "Past Goals" below.
struct GoalsCard: View {
    let progress: [TripGoalProgress]
    let unit: TripDistanceUnit
    let onAdd: () -> Void
    let onEdit: (TripGoal) -> Void

    private var current: [TripGoalProgress] { progress.filter { $0.phase != .ended } }
    private var past: [TripGoalProgress] { progress.filter { $0.phase == .ended } }

    var body: some View {
        StatsCard(title: "Goals") {
            if current.isEmpty {
                Button(action: onAdd) {
                    HStack(spacing: 12) {
                        Image(systemName: "target")
                            .font(.title2)
                            .foregroundStyle(Color.accentColor)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Set a Goal").font(.subheadline.weight(.semibold))
                            Text("Nights out, distance, climbing or trips — for the year or any dates.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.leading)
                        }
                        Spacer(minLength: 8)
                        Image(systemName: "plus.circle.fill").font(.title2).foregroundStyle(Color.accentColor)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("trip_stats_add_goal_empty")
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(current.enumerated()), id: \.element.goal.id) { index, item in
                        if index > 0 { Divider() }
                        Button { onEdit(item.goal) } label: {
                            GoalRow(progress: item, unit: unit)
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("trip_stats_goal_\(item.goal.id)")
                    }
                }
                Button(action: onAdd) {
                    Label("Add Goal", systemImage: "plus")
                        .font(.subheadline.weight(.semibold))
                }
                .buttonStyle(.borderless)
                .accessibilityIdentifier("trip_stats_add_goal")
            }

            if !past.isEmpty {
                DisclosureGroup("Past Goals") {
                    VStack(spacing: 8) {
                        ForEach(past, id: \.goal.id) { item in
                            Button { onEdit(item.goal) } label: {
                                PastGoalRow(progress: item, unit: unit)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.top, 8)
                }
                .font(.subheadline)
            }
        }
    }
}

private struct GoalRow: View {
    let progress: TripGoalProgress
    let unit: TripDistanceUnit

    var body: some View {
        HStack(spacing: 14) {
            GoalRing(progress: progress)
                .frame(width: 56, height: 56)

            VStack(alignment: .leading, spacing: 3) {
                Text(progress.goal.title)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Text("\(progress.goal.metric.format(progress.value, unit: unit).valueOnly) of \(progress.goal.metric.format(progress.goal.target, unit: unit))")
                    .font(.subheadline)
                    .monospacedDigit()
                status
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary)
        }
        .padding(.vertical, 10)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint("Edit goal")
    }

    @ViewBuilder
    private var status: some View {
        let metric = progress.goal.metric
        if progress.isComplete {
            Label("Complete", systemImage: "checkmark.circle.fill")
                .foregroundStyle(Color.accentColor)
        } else {
            switch progress.phase {
            case .upcoming:
                Text("Starts \(progress.start.formatted(.dateTime.month(.abbreviated).day()))")
            case .ended:
                Text("Ended")
            case .active:
                HStack(spacing: 4) {
                    switch progress.pace {
                    case .ahead(let by): Text("\(metric.format(by, unit: unit)) ahead of pace")
                    case .behind(let by): Text("\(metric.format(by, unit: unit)) behind pace")
                    case .onPace, nil: Text("On pace")
                    }
                    Text("·")
                    Text(daysLeft)
                }
            }
        }
    }

    private var daysLeft: String {
        let calendar = Calendar.current
        let days = (calendar.dateComponents([.day], from: calendar.startOfDay(for: .now), to: progress.end).day ?? 0) + 1
        return days == 1 ? "last day" : "\(days) days left"
    }
}

private struct PastGoalRow: View {
    let progress: TripGoalProgress
    let unit: TripDistanceUnit

    var body: some View {
        HStack {
            Image(systemName: progress.isComplete ? "checkmark.circle.fill" : "circle.dashed")
                .foregroundStyle(progress.isComplete ? Color.accentColor : Color.secondary)
            VStack(alignment: .leading, spacing: 1) {
                Text(progress.goal.title).lineLimit(1)
                Text(window).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Text("\(progress.goal.metric.format(progress.value, unit: unit).valueOnly) of \(progress.goal.metric.format(progress.goal.target, unit: unit))")
                .font(.caption)
                .monospacedDigit()
                .foregroundStyle(.secondary)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private var window: String {
        if progress.goal.kind == .annual, let year = progress.goal.year { return String(year) }
        return "\(progress.start.formatted(date: .abbreviated, time: .omitted)) – \(progress.end.formatted(date: .abbreviated, time: .omitted))"
    }
}

/// Progress as a ring, with a tick where an even pace would be today.
private struct GoalRing: View {
    let progress: TripGoalProgress

    var body: some View {
        ZStack {
            Circle().stroke(Color.accentColor.opacity(0.15), lineWidth: 7)
            Circle()
                .trim(from: 0, to: min(progress.fraction, 1))
                .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 7, lineCap: .round))
                .rotationEffect(.degrees(-90))
            if progress.phase == .active, !progress.isComplete, progress.elapsed > 0 {
                Capsule()
                    .fill(Color.primary.opacity(0.55))
                    .frame(width: 2.5, height: 11)
                    .offset(y: -28)
                    .rotationEffect(.degrees(progress.elapsed * 360))
            }
            Image(systemName: progress.isComplete ? "checkmark" : progress.goal.metric.symbol)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Color.accentColor)
        }
        .animation(.snappy, value: progress.fraction)
        .accessibilityElement()
        .accessibilityLabel("\(Int((min(progress.fraction, 1) * 100).rounded())) percent")
    }
}

private extension String {
    /// "120 mi" → "120": the "of 500 mi" that follows carries the unit.
    var valueOnly: String {
        guard let space = lastIndex(of: " ") else { return self }
        return String(self[..<space])
    }
}

// MARK: - Goal editor

struct GoalEditorView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    /// Nil to create.
    let goal: TripGoal?
    let finished: [TripStats.FinishedTrip]
    let unit: TripDistanceUnit

    @State private var kind: TripGoal.Kind = .annual
    @State private var metric: TripGoal.Metric = .nights
    @State private var targetText = ""
    @State private var name = ""
    @State private var startDate = Calendar.current.startOfDay(for: .now)
    @State private var endDate = Calendar.current.date(byAdding: .month, value: 3, to: Calendar.current.startOfDay(for: .now)) ?? .now
    @State private var confirmingDelete = false
    @FocusState private var targetFocused: Bool

    private var year: Int { goal?.year ?? Calendar.current.component(.year, from: .now) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Goal Type", selection: $kind) {
                        Text("This Year").tag(TripGoal.Kind.annual)
                        Text("Custom Dates").tag(TripGoal.Kind.custom)
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                    .accessibilityIdentifier("goal_editor_kind")
                }

                if kind == .custom {
                    Section {
                        TextField("Name (optional)", text: $name, prompt: Text("Ten nights out before the baby arrives"))
                            .accessibilityIdentifier("goal_editor_name")
                        DatePicker("Starts", selection: $startDate, displayedComponents: .date)
                        DatePicker("Ends", selection: $endDate, in: startDate..., displayedComponents: .date)
                    }
                }

                Section {
                    Picker("Measure", selection: $metric) {
                        ForEach(TripGoal.Metric.allCases) { metric in
                            Label(metric.label, systemImage: metric.symbol).tag(metric)
                        }
                    }
                    .accessibilityIdentifier("goal_editor_metric")
                    HStack {
                        Text("Target")
                        Spacer()
                        TextField("0", text: $targetText)
                            .multilineTextAlignment(.trailing)
                            .monospacedDigit()
                            .focused($targetFocused)
                            #if os(iOS)
                            .keyboardType(metric.isMeasured ? .decimalPad : .numberPad)
                            #endif
                            .frame(maxWidth: 120)
                            .accessibilityIdentifier("goal_editor_target")
                        Text(targetSymbol).foregroundStyle(.secondary)
                    }
                } footer: {
                    if let hint { Text(hint) }
                }

                if goal != nil {
                    Section {
                        Button("Delete Goal", role: .destructive) { confirmingDelete = true }
                            .accessibilityIdentifier("goal_editor_delete")
                    }
                }
            }
            .navigationTitle(goal == nil ? "New Goal" : "Edit Goal")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(parsedTarget == nil)
                        .accessibilityIdentifier("goal_editor_save")
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") { targetFocused = false }
                }
            }
            .confirmationDialog("Delete this goal?", isPresented: $confirmingDelete, titleVisibility: .visible) {
                Button("Delete Goal", role: .destructive) {
                    guard let goal else { return }
                    Task {
                        await appState.tripGoalsVM.delete(goal, context: modelContext)
                        dismiss()
                    }
                }
            } message: {
                Text("Your trips and stats stay as they are.")
            }
            .onAppear(perform: prefill)
        }
        .formSheetSize(minWidth: 480, minHeight: 520)
    }

    private var targetSymbol: String {
        switch metric {
        case .distance: return unit.distanceSymbol
        case .elevation: return unit.elevationSymbol
        case .trips: return "trips"
        case .nights: return "nights"
        case .days: return "days"
        }
    }

    /// The same stretch last year, so the target starts from something real.
    private var hint: String? {
        let calendar = Calendar.current
        let window: (Date, Date)
        if kind == .annual {
            guard let start = calendar.date(from: DateComponents(year: year - 1, month: 1, day: 1)),
                  let end = calendar.date(from: DateComponents(year: year - 1, month: 12, day: 31))
            else { return nil }
            window = (start, end)
        } else {
            guard let start = calendar.date(byAdding: .year, value: -1, to: startDate),
                  let end = calendar.date(byAdding: .year, value: -1, to: endDate)
            else { return nil }
            window = (start, end)
        }
        let totals = TripStats.totals(TripStats.clip(finished, from: window.0, to: window.1, calendar: calendar), calendar: calendar)
        guard totals.trips > 0 else { return nil }
        let value: Double?
        switch metric {
        case .trips: value = Double(totals.trips)
        case .nights: value = Double(totals.nights)
        case .days: value = Double(totals.days)
        case .distance: value = totals.distance
        case .elevation: value = totals.elevationGain
        }
        guard let value else { return nil }
        let label = kind == .annual ? "In \(year - 1)" : "Same dates last year"
        return "\(label): \(metric.format(value, unit: unit))."
    }

    /// In the metric's base unit, or nil while the field can't be saved.
    private var parsedTarget: Double? {
        let trimmed = targetText.trimmingCharacters(in: .whitespaces)
        let value = (try? Double(trimmed, format: .number)) ?? Double(trimmed.replacingOccurrences(of: ",", with: "."))
        guard let value, value > 0 else { return nil }
        switch metric {
        case .distance: return unit.metres(fromDistance: value)
        case .elevation: return unit.metres(fromElevation: value)
        case .trips, .nights, .days: return value.rounded() >= 1 ? value.rounded() : nil
        }
    }

    private func prefill() {
        guard let goal else { return }
        kind = goal.kind
        metric = goal.metric
        name = goal.name ?? ""
        if let start = TripGoal.day(from: goal.startDate) { startDate = start }
        if let end = TripGoal.day(from: goal.endDate) { endDate = end }
        let shown: Double
        switch goal.metric {
        case .distance: shown = unit.distanceValue(goal.target)
        case .elevation: shown = unit.elevationValue(goal.target)
        case .trips, .nights, .days: shown = goal.target
        }
        targetText = shown.formatted(.number.precision(.fractionLength(0...1)).grouping(.never))
    }

    private func save() {
        guard let target = parsedTarget else { return }
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let next = TripGoal(
            id: goal?.id ?? UUID().uuidString.lowercased(),
            kind: kind,
            metric: metric,
            target: target,
            year: kind == .annual ? year : nil,
            name: kind == .custom && !trimmedName.isEmpty ? trimmedName : nil,
            startDate: kind == .custom ? TripGoal.dayString(from: startDate) : nil,
            endDate: kind == .custom ? TripGoal.dayString(from: max(endDate, startDate)) : nil,
            localCreatedAt: goal?.localCreatedAt
        )
        Task { await appState.tripGoalsVM.save(next, context: modelContext) }
        dismiss()
    }
}

// MARK: - Comeback

/// "Back after 5 months": the return measured against the user's own pace
/// before the break. The reason for the break is optional and shown only here.
struct ComebackCard: View {
    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext
    let comeback: TripStats.Comeback
    let unit: TripDistanceUnit

    private var reason: TripBreakReason? {
        appState.tripGoalsVM.settings.breakReason(forComebackTrip: comeback.trip.id)
    }

    var body: some View {
        StatsCard(
            title: "Back after \(comeback.monthsAway) month\(comeback.monthsAway == 1 ? "" : "s")",
            subtitle: reason?.cardLine ?? "Since \(comeback.trip.trip.name), \(comeback.trip.start.formatted(.dateTime.month(.abbreviated).day()))"
        ) {
            Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 8) {
                GridRow {
                    Text("Per month").font(.caption).foregroundStyle(.secondary)
                    Text("Now").font(.caption.weight(.semibold)).gridColumnAlignment(.trailing)
                    Text("Before").font(.caption).foregroundStyle(.secondary).gridColumnAlignment(.trailing)
                }
                row("Trips", comeback.now.trips, comeback.before.trips) { rate($0) }
                row("Nights out", comeback.now.nights, comeback.before.nights) { rate($0) }
                if let now = comeback.now.distance, let before = comeback.before.distance {
                    row("Distance", now, before) { unit.formatDistance($0) }
                }
            }

            Text(comeback.daysBack < TripStats.Comeback.daysBeforePaceCounts
                ? "Your first month back is still underway."
                : "Against the year before your break. This card leaves once you're back to that pace.")
                .font(.caption)
                .foregroundStyle(.secondary)

            Menu {
                Picker("Why were you away?", selection: Binding(
                    get: { reason },
                    set: { newValue in
                        Task {
                            await appState.tripGoalsVM.setBreakReason(newValue, comebackTripId: comeback.trip.id, context: modelContext)
                        }
                    }
                )) {
                    ForEach(TripBreakReason.allCases) { Text($0.label).tag(Optional($0)) }
                    Text("Rather Not Say").tag(TripBreakReason?.none)
                }
            } label: {
                Label(reason == nil ? "Why were you away?" : "Away for: \(reason?.label ?? "")", systemImage: "text.bubble")
                    .font(.subheadline.weight(.medium))
            }
            .accessibilityIdentifier("trip_stats_comeback_reason")
        }
        .accessibilityIdentifier("trip_stats_comeback")
    }

    private func row(_ label: String, _ now: Double, _ before: Double, format: (Double) -> String) -> some View {
        GridRow {
            Text(label)
            Text(format(now)).fontWeight(.semibold).monospacedDigit()
            Text(format(before)).foregroundStyle(.secondary).monospacedDigit()
        }
        .font(.subheadline)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label) per month, \(format(now)) now, \(format(before)) before the break")
    }

    private func rate(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...1)))
    }
}

// MARK: - Settings

/// The on/off switch in Settings, for turning stats back on after turning
/// them off from the stats screen. Off keeps every trip log.
struct TripStatsSettingsSection: View {
    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        if NavItem.tripStats.isFeatureEnabled {
            Section {
                Toggle("Trip Stats", isOn: Binding(
                    get: { appState.tripGoalsVM.isEnabled },
                    set: { enabled in Task { await appState.tripGoalsVM.setEnabled(enabled, context: modelContext) } }
                ))
                .accessibilityIdentifier("settings_trip_stats_toggle")
            } footer: {
                Text("Totals, goals and the map of your finished trips. Turning this off hides them and keeps your trip logs.")
            }
        }
    }
}
