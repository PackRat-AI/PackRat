#if os(iOS)
import SwiftUI

/// "Notify your emergency contacts?" — the setup that follows Start Trip.
/// Everything is pre-filled; the user confirms who, when, and what they'll
/// look like, then sends.
struct StartSafetyCheckInSheet: View {
    let trip: Trip
    let pack: Pack?

    @Environment(\.dismiss) private var dismiss
    @Environment(AuthManager.self) private var authManager
    private var store = SafetyCheckInStore.shared

    @State private var selectedIds: Set<String> = []
    @State private var expectedReturn: Date
    @State private var graceMinutes = SafetyGracePeriod.defaultMinutes
    @State private var gear: [IdentifyingGearItem]
    @State private var trackingEnabled = true
    @State private var addingContact: ContactDraft?

    init(trip: Trip, pack: Pack?) {
        self.trip = trip
        self.pack = pack
        _expectedReturn = State(initialValue: SafetyCheckInDefaults.expectedReturn(for: trip))
        _gear = State(initialValue: SafetyCheckInDefaults.identifyingGear(from: pack?.items ?? []))
    }

    private var chosen: [EmergencyContact] { store.contacts.filter { selectedIds.contains($0.id) } }

    private var userName: String {
        let user = authManager.currentUser
        return user?.firstName?.nilIfBlank ?? user?.name?.nilIfBlank ?? "You"
    }

    var body: some View {
        NavigationStack {
            Form {
                contactsSection
                returnSection
                gearSection
                trackingSection
                previewSection
            }
            .navigationTitle("Notify Contacts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Not Now") { dismiss() }
                        .accessibilityIdentifier("safety_start_not_now")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Send", action: send)
                        .fontWeight(.semibold)
                        .disabled(chosen.isEmpty)
                        .accessibilityIdentifier("safety_start_send")
                }
            }
            .sheet(item: $addingContact) { draft in
                EmergencyContactForm(draft: draft)
            }
            .task {
                if !store.contactsLoaded { await store.loadContacts() }
                if selectedIds.isEmpty, let fallback = store.defaultContact ?? store.contacts.first {
                    selectedIds = [fallback.id]
                }
            }
            .onChange(of: store.contacts.map(\.id)) { old, new in
                // A contact added from this sheet is meant for this trip.
                for id in new where !old.contains(id) { selectedIds.insert(id) }
            }
        }
    }

    private var contactsSection: some View {
        Section {
            ForEach(store.contacts) { contact in
                Button {
                    if selectedIds.contains(contact.id) {
                        selectedIds.remove(contact.id)
                    } else {
                        selectedIds.insert(contact.id)
                    }
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(contact.name).foregroundStyle(.primary)
                            Text(contact.reachableAt).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: selectedIds.contains(contact.id) ? "checkmark.circle.fill" : "circle")
                            .font(.title3)
                            .foregroundStyle(selectedIds.contains(contact.id) ? AnyShapeStyle(.tint) : AnyShapeStyle(.tertiary))
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("safety_start_contact_\(contact.name)")
            }
            Button {
                addingContact = ContactDraft()
            } label: {
                Label(store.contacts.isEmpty ? "Add an Emergency Contact" : "Add Contact", systemImage: "plus.circle.fill")
            }
            .accessibilityIdentifier("safety_start_add_contact")
        } header: {
            Text("Who to tell")
        } footer: {
            if store.contacts.isEmpty {
                Text("Someone who should know where you've gone and when you'll be back. They don't need PackRat.")
            }
        }
    }

    private var returnSection: some View {
        Section {
            DatePicker("Expected back", selection: $expectedReturn, in: Date()...)
                .accessibilityIdentifier("safety_start_expected_return")
            Picker("Alert after", selection: $graceMinutes) {
                ForEach(SafetyGracePeriod.options, id: \.self) { minutes in
                    Text(SafetyGracePeriod.label(minutes)).tag(minutes)
                }
            }
        } header: {
            Text("When you'll be back")
        } footer: {
            let alertAt = expectedReturn.addingTimeInterval(TimeInterval(graceMinutes * 60))
            Text("If you haven't tapped I'm Safe by \(alertAt.formatted(date: .abbreviated, time: .shortened)), your contacts get an overdue alert with your last known location and gear list.")
        }
    }

    private var gearSection: some View {
        Section {
            ForEach($gear) { $item in
                HStack(spacing: 10) {
                    TextField("Colour", text: Binding(
                        get: { item.note ?? "" },
                        set: { item.note = $0.isEmpty ? nil : $0 }
                    ))
                    .frame(width: 90)
                    .foregroundStyle(.tint)
                    TextField("Item", text: $item.name)
                }
            }
            .onDelete { gear.remove(atOffsets: $0) }
            Button {
                gear.append(IdentifyingGearItem(name: "", note: nil))
            } label: {
                Label("Add Item", systemImage: "plus.circle.fill")
            }
        } header: {
            Text("What you'll look like")
        } footer: {
            Text("Shelter, outer layer, pack — what would help someone spot you. Add a colour to each.")
        }
    }

    private var trackingSection: some View {
        Section {
            Toggle("Follow my progress", isOn: $trackingEnabled)
                .accessibilityIdentifier("safety_start_tracking")
        } footer: {
            Text(trip.plannedRoute?.isEmpty == false
                ? "Shares your location in the background until you're home, using little battery. Your contacts are told if you go well off your planned route."
                : "Shares your location in the background until you're home, using little battery. Only while this trip is in progress.")
        }
    }

    private var previewSection: some View {
        Section("They'll receive") {
            Text(SafetyCheckInDefaults.previewMessage(
                userName: userName, tripName: trip.name, expectedReturn: expectedReturn, gear: gear
            ))
            .font(.callout)
            .foregroundStyle(.secondary)
        }
    }

    private func send() {
        store.start(
            tripId: trip.id,
            tripName: trip.name,
            contacts: chosen,
            expectedReturnAt: expectedReturn,
            graceMinutes: graceMinutes,
            gear: gear,
            trackingEnabled: trackingEnabled
        )
        Task { await TripReminderScheduler.requestAuthorizationIfNeeded() }
        dismiss()
    }
}

private extension String {
    var nilIfBlank: String? { trimmingCharacters(in: .whitespaces).isEmpty ? nil : self }
}
#endif
