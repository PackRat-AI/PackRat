#if os(iOS)
import SwiftUI

/// The top of a trip from the day it starts: Start Trip, then — once the
/// contacts have been told — the check-in itself, with its countdown, Check
/// In, Running Late and the I'm Safe button.
struct TripSafetySection: View {
    let trip: Trip
    let viewModel: TripsViewModel

    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext
    private var store = SafetyCheckInStore.shared

    @State private var askingToNotify = false
    @State private var showingSetup = false

    init(trip: Trip, viewModel: TripsViewModel) {
        self.trip = trip
        self.viewModel = viewModel
    }

    private var pack: Pack? {
        trip.packId.flatMap { id in appState.packsVM.packs.first { $0.id == id } }
    }

    /// Start Trip shows from the start date on, or any time for an undated trip.
    private var canStart: Bool {
        guard trip.lifecycle == .planned else { return false }
        guard let start = trip.startDate?.toDate() else { return true }
        return Calendar.current.startOfDay(for: start) <= Date()
    }

    var body: some View {
        Group {
            if let checkIn = store.checkIn(forTrip: trip.id) {
                SafetyCheckInCard(trip: trip, checkIn: checkIn, viewModel: viewModel, onRetry: { showingSetup = true })
            } else if trip.lifecycle == .inProgress {
                inProgressCard
            } else if canStart {
                startCard
            }
        }
        .confirmationDialog(
            "Notify your emergency contacts?",
            isPresented: $askingToNotify,
            titleVisibility: .visible
        ) {
            Button("Notify Contacts") { showingSetup = true }
                .accessibilityIdentifier("trip_start_notify")
            Button("Start Without Notifying") {}
                .accessibilityIdentifier("trip_start_without_notifying")
        } message: {
            Text("They'll get your plan and when you're due back, and an alert if you don't return on time.")
        }
        .sheet(isPresented: $showingSetup) {
            StartSafetyCheckInSheet(trip: trip, pack: pack)
        }
        .task(id: trip.id) {
            guard NetworkMonitor.shared.isConnected else { return }
            await store.refresh(tripId: trip.id, tripName: trip.name)
            await store.flush()
        }
    }

    private var startCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Ready to head out?", systemImage: "figure.hiking")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.tint)
            Button {
                viewModel.setLifecycle(trip.id, status: .inProgress, context: modelContext)
                askingToNotify = true
            } label: {
                Label("Start Trip", systemImage: "play.fill")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .accessibilityIdentifier("trip_start_button")
        }
        .safetyCardStyle(tint: .accentColor)
    }

    private var inProgressCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("On the trail", systemImage: "figure.hiking")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.tint)
                Spacer()
                if let started = trip.startedAt?.toDate() {
                    Text("Since \(started.formatted(date: .omitted, time: .shortened))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Text("No one's been told about this trip. Start a safety check-in so someone at home knows when to expect you.")
                .font(.callout)
                .foregroundStyle(.secondary)
            HStack(spacing: 10) {
                Button {
                    showingSetup = true
                } label: {
                    Label("Notify Contacts", systemImage: "shield.lefthalf.filled")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .accessibilityIdentifier("trip_notify_contacts")
                Button {
                    viewModel.setLifecycle(trip.id, status: .complete, context: modelContext)
                } label: {
                    Text("Finish Trip").frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("trip_finish_button")
            }
            .controlSize(.large)
        }
        .safetyCardStyle(tint: .accentColor)
    }
}

/// An active check-in on its trip.
struct SafetyCheckInCard: View {
    let trip: Trip
    let checkIn: LocalSafetyCheckIn
    let viewModel: TripsViewModel
    let onRetry: () -> Void

    @Environment(\.modelContext) private var modelContext
    private var store: SafetyCheckInStore { .shared }

    @State private var showingCheckIn = false
    @State private var showingExtend = false
    @State private var confirmingSafe = false
    @State private var confirmingCancel = false

    init(trip: Trip, checkIn: LocalSafetyCheckIn, viewModel: TripsViewModel, onRetry: @escaping () -> Void) {
        self.trip = trip
        self.checkIn = checkIn
        self.viewModel = viewModel
        self.onRetry = onRetry
    }

    var body: some View {
        TimelineView(.periodic(from: .now, by: 30)) { context in
            let now = context.date
            let overdue = checkIn.overdueAlertSent || now >= checkIn.overdueAt
            VStack(alignment: .leading, spacing: 14) {
                header(overdue: overdue)
                status(now: now, overdue: overdue)
                actions
                Button {
                    confirmingSafe = true
                } label: {
                    Label("I'm Safe", systemImage: "checkmark.shield.fill")
                        .font(.title3.weight(.bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .tint(.red)
                .controlSize(.large)
                .accessibilityIdentifier("safety_im_safe")
                footer
            }
            .safetyCardStyle(tint: overdue ? .red : .green)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("safety_check_in_card")
        .sheet(isPresented: $showingCheckIn) {
            CheckInSheet(tripId: trip.id)
                .presentationDetents([.height(300)])
        }
        .sheet(isPresented: $showingExtend) {
            ExtendReturnSheet(tripId: trip.id, current: checkIn.expectedReturnAt)
                .presentationDetents([.medium])
        }
        .confirmationDialog("Mark yourself safe?", isPresented: $confirmingSafe, titleVisibility: .visible) {
            Button("I'm Safe") {
                store.end(tripId: trip.id, outcome: .safe)
                viewModel.setLifecycle(trip.id, status: .complete, context: modelContext)
            }
        } message: {
            Text("\(checkIn.contactSummary.capitalizedFirst) will be told you're back. Location sharing stops and this trip's location history is deleted.")
        }
        .confirmationDialog("End the check-in?", isPresented: $confirmingCancel, titleVisibility: .visible) {
            Button("End Check-In", role: .destructive) {
                store.end(tripId: trip.id, outcome: .cancel)
            }
        } message: {
            Text("\(checkIn.contactSummary.capitalizedFirst) will be told it's been called off, and won't get an overdue alert.")
        }
    }

    private func header(overdue: Bool) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Label("Safety check-in", systemImage: "shield.lefthalf.filled")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(overdue ? .red : .green)
            Spacer()
            Menu {
                if let link = checkIn.shareUrl.flatMap(URL.init(string:)) {
                    ShareLink(item: link) { Label("Share Trip Page", systemImage: "square.and.arrow.up") }
                }
                Button(role: .destructive) {
                    confirmingCancel = true
                } label: {
                    Label("End Check-In", systemImage: "xmark.shield")
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }
            .accessibilityIdentifier("safety_menu")
        }
    }

    @ViewBuilder
    private func status(now: Date, overdue: Bool) -> some View {
        if let error = checkIn.startError {
            VStack(alignment: .leading, spacing: 6) {
                Text("Your contacts weren't notified").font(.headline).foregroundStyle(.red)
                Text(error).font(.callout).foregroundStyle(.secondary)
                Button("Set Up Again") {
                    store.end(tripId: trip.id, outcome: .cancel)
                    onRetry()
                }
                .font(.callout.weight(.semibold))
            }
        } else if overdue {
            VStack(alignment: .leading, spacing: 4) {
                Text("Overdue alert sent")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(.red)
                Text("\(checkIn.contactSummary.capitalizedFirst) \(checkIn.contactNames.count == 1 ? "has" : "have") been asked to check on you. Tap I'm Safe as soon as you can.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            .accessibilityIdentifier("safety_overdue")
        } else {
            VStack(alignment: .leading, spacing: 4) {
                Text(Self.countdown(to: checkIn.overdueAt, from: now))
                    .font(.system(.largeTitle, design: .rounded).weight(.bold).monospacedDigit())
                    .contentTransition(.numericText())
                    .accessibilityIdentifier("safety_countdown")
                Text("until \(checkIn.contactSummary) \(checkIn.contactNames.count == 1 ? "is" : "are") alerted · back by \(checkIn.expectedReturnAt.formatted(date: .abbreviated, time: .shortened))")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var actions: some View {
        HStack(spacing: 10) {
            Button {
                showingCheckIn = true
            } label: {
                Label("Check In", systemImage: "location.fill").frame(maxWidth: .infinity)
            }
            .accessibilityIdentifier("safety_check_in_button")
            Button {
                showingExtend = true
            } label: {
                Label("Running Late", systemImage: "clock.arrow.circlepath").frame(maxWidth: .infinity)
            }
            .accessibilityIdentifier("safety_extend_button")
        }
        .buttonStyle(.bordered)
        .controlSize(.large)
    }

    @ViewBuilder
    private var footer: some View {
        let pending = store.pendingCount(forTrip: trip.id)
        let lines: [String] = [
            checkIn.contactsNotified || checkIn.startError != nil
                ? nil
                : "Waiting for signal — \(checkIn.contactSummary) \(checkIn.contactNames.count == 1 ? "hasn't" : "haven't") been told yet. The countdown starts once they are.",
            checkIn.lastCheckInAt.map { "Last check-in \($0.formatted(date: .omitted, time: .shortened))" },
            pending > 0 && checkIn.contactsNotified ? "\(pending) update\(pending == 1 ? "" : "s") waiting for signal" : nil,
            checkIn.trackingEnabled ? "Sharing your progress in the background" : nil,
        ].compactMap { $0 }
        if !lines.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                ForEach(lines, id: \.self) { Text($0) }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
    }

    /// "5h 12m", "48m", "under a minute".
    static func countdown(to target: Date, from now: Date) -> String {
        let minutes = Int(target.timeIntervalSince(now) / 60)
        if minutes < 1 { return "Under a minute" }
        let days = minutes / (60 * 24)
        let hours = (minutes % (60 * 24)) / 60
        let mins = minutes % 60
        if days > 0 { return "\(days)d \(hours)h" }
        if hours > 0 { return "\(hours)h \(mins)m" }
        return "\(mins)m"
    }
}

/// Records a check-in where the user is standing, with an optional note.
private struct CheckInSheet: View {
    let tripId: String
    @Environment(\.dismiss) private var dismiss
    @State private var note = ""
    @State private var isLocating = false
    @State private var errorMessage: String?
    @State private var locator = SafetyCheckInLocator()

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("Sends your location and the time to your contacts. With no signal it's saved and sent as soon as you have some.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                TextField("Add a note (optional)", text: $note, axis: .vertical)
                    .lineLimit(1...3)
                    .textFieldStyle(.roundedBorder)
                    .accessibilityIdentifier("safety_check_in_note")
                if let errorMessage {
                    Text(errorMessage).font(.callout).foregroundStyle(.red)
                }
                Button(action: checkIn) {
                    Group {
                        if isLocating {
                            HStack(spacing: 8) { ProgressView(); Text("Getting your location…") }
                        } else {
                            Label("Check In", systemImage: "location.fill")
                        }
                    }
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(isLocating)
                .accessibilityIdentifier("safety_check_in_send")
                Spacer(minLength: 0)
            }
            .padding()
            .navigationTitle("Check In")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
        }
    }

    private func checkIn() {
        isLocating = true
        errorMessage = nil
        Task {
            defer { isLocating = false }
            do {
                let fix = try await locator.currentFix()
                SafetyCheckInStore.shared.recordCheckIn(tripId: tripId, location: fix, note: note)
                dismiss()
            } catch {
                errorMessage = (error as? LocalizedError)?.errorDescription ?? "Couldn't get your location."
            }
        }
    }
}

/// Pushes the expected return back; the contacts are told the new time.
private struct ExtendReturnSheet: View {
    let tripId: String
    let current: Date
    @Environment(\.dismiss) private var dismiss
    @State private var newReturn: Date

    init(tripId: String, current: Date) {
        self.tripId = tripId
        self.current = current
        _newReturn = State(initialValue: max(current, Date()).addingTimeInterval(2 * 60 * 60))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Back by", selection: $newReturn, in: Date()...)
                        .accessibilityIdentifier("safety_extend_picker")
                    HStack(spacing: 8) {
                        ForEach([1, 2, 4], id: \.self) { hours in
                            Button("+\(hours)h") {
                                newReturn = max(current, Date()).addingTimeInterval(TimeInterval(hours * 3600))
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                } footer: {
                    Text("Your contacts get the new time, and the overdue alert moves with it.")
                }
            }
            .navigationTitle("Running Late")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Update") {
                        SafetyCheckInStore.shared.extend(tripId: tripId, to: newReturn)
                        dismiss()
                    }
                    .fontWeight(.semibold)
                    .accessibilityIdentifier("safety_extend_save")
                }
            }
        }
    }
}

private extension View {
    func safetyCardStyle(tint: Color) -> some View {
        padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(tint.opacity(0.08), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .padding(.horizontal)
    }
}

private extension String {
    var capitalizedFirst: String { prefix(1).uppercased() + dropFirst() }
}
#endif
