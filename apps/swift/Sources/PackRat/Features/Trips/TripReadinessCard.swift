import SwiftUI

/// The top of a trip in the week before it starts: what's left to pack and
/// what needs a charge — the same picture the pre-trip reminders carry, so a
/// reminder tap lands on what's left. Collapses to one line once it's all packed.
struct TripReadinessCard: View {
    let trip: Trip
    let onLinkPack: () -> Void
    /// Opens the given pack in packing mode on top of the trip.
    let onStartPacking: (String) -> Void

    @Environment(AppState.self) private var appState
    private var packing = PackingModeStore.shared

    init(trip: Trip, onLinkPack: @escaping () -> Void, onStartPacking: @escaping (String) -> Void) {
        self.trip = trip
        self.onLinkPack = onLinkPack
        self.onStartPacking = onStartPacking
    }

    private var pack: Pack? {
        trip.packId.flatMap { id in appState.packsVM.packs.first { $0.id == id } }
    }

    private var state: TripReminderPlanner.PackState {
        let packed = pack.map { Set(packing.packedItems(in: $0.id).filter(\.value).keys) } ?? []
        return TripReminderPlanner.PackState(pack: pack, packedItemIds: packed)
    }

    private var leavesLabel: String {
        switch TripReminderPlanner.daysUntilStart(trip, now: Date()) ?? 0 {
        case ...0: "Leaves today"
        case 1: "Leaves tomorrow"
        case let days: "Leaves in \(days) days"
        }
    }

    var body: some View {
        let state = state
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Label(leavesLabel, systemImage: "figure.hiking")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.tint)
                Spacer()
                if state.progress == .done {
                    Label("All packed", systemImage: "checkmark.circle.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.green)
                }
            }

            packingRow(state)

            if !state.chargeable.isEmpty {
                row(symbol: "bolt.fill", tint: .orange, title: "Charge before you go") {
                    Text(TripReminderPlanner.list(state.chargeable).capitalizedFirst)
                }
            }

            let todo = TripReminderPlanner.openChecklistTitles(trip)
            if !todo.isEmpty {
                row(symbol: "checklist", tint: .purple, title: "Before you go") {
                    Text(TripReminderPlanner.list(todo).capitalizedFirst)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.tint.opacity(0.08), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .padding(.horizontal)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("trip_readiness_card")
    }

    @ViewBuilder
    private func packingRow(_ state: TripReminderPlanner.PackState) -> some View {
        switch state.progress {
        case .noPack:
            row(symbol: "backpack", tint: .blue, title: "No pack linked") {
                Button("Link a Pack", action: onLinkPack)
                    .font(.callout.weight(.semibold))
            }
        case .empty:
            openPackButton {
                row(symbol: "backpack", tint: .blue, title: "Your pack is empty") {
                    Text("Add what you're bringing.")
                }
            }
        case .done:
            EmptyView()
        case .partial(let packed, let total):
            openPackButton {
                row(symbol: "backpack.fill", tint: .blue, title: "\(packed) of \(total) packed") {
                    VStack(alignment: .leading, spacing: 6) {
                        ProgressView(value: Double(packed), total: Double(total))
                        Text("Still to pack: \(TripReminderPlanner.list(state.unpacked))")
                    }
                }
            }
        }
    }

    /// Opens the trip's pack in packing mode on top of the trip.
    @ViewBuilder
    private func openPackButton(@ViewBuilder label: () -> some View) -> some View {
        if let pack {
            Button {
                onStartPacking(pack.id)
            } label: {
            HStack {
                label()
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }

    private func row(
        symbol: String, tint: Color, title: String, @ViewBuilder detail: () -> some View
    ) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: symbol)
                .font(.body.weight(.semibold))
                .foregroundStyle(tint)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.callout.bold())
                detail()
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

#if os(iOS)
/// Per-trip off switch for pre-trip reminders, with when the next one lands.
struct TripRemindersRow: View {
    let trip: Trip

    @Environment(AppState.self) private var appState
    private var settings = TripReminderSettings.shared

    init(trip: Trip) {
        self.trip = trip
    }

    private var nextReminder: TripReminder? {
        TripReminderPlanner.reminders(for: trip, pack: nil, packedItemIds: [], now: Date()).first
    }

    private var isOn: Binding<Bool> {
        Binding(
            get: { !settings.isMuted(trip.id) },
            set: { on in
                settings.setMuted(!on, tripId: trip.id)
                if on { Task { await TripReminderScheduler.requestAuthorizationIfNeeded() } }
            }
        )
    }

    private var caption: String? {
        guard settings.isEnabled else { return "Trip Reminders are off in Settings." }
        guard !settings.isMuted(trip.id), let next = nextReminder else { return nil }
        let when = next.fireDate.formatted(.dateTime.weekday(.wide).month().day().hour().minute())
        return "Next reminder \(when)."
    }

    var body: some View {
        if nextReminder != nil {
            VStack(alignment: .leading, spacing: 6) {
                Toggle(isOn: isOn) {
                    Label("Trip Reminders", systemImage: "bell.badge")
                        .font(.callout.weight(.semibold))
                }
                .disabled(!settings.isEnabled)
                .accessibilityIdentifier("trip_reminders_toggle")
                if let caption {
                    Text(caption)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(14)
            .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .padding(.horizontal)
        }
    }
}
#endif

private extension String {
    var capitalizedFirst: String { prefix(1).uppercased() + dropFirst() }
}
