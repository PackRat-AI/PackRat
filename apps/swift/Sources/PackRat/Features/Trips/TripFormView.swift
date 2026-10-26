import SwiftUI
import MapKit
import SwiftData

struct TripFormView: View {
    let viewModel: TripsViewModel
    let existingTrip: Trip?
    var packsViewModel: PacksViewModel?

    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext
    @Environment(\.weightUnit) private var weightUnit

    @State private var name = ""
    @State private var description = ""
    @State private var notes = ""
    @State private var startDate: Date = Date()
    @State private var endDate: Date = Date().addingTimeInterval(86400 * 3)
    @State private var hasDates = false
    @State private var locationName = ""
    @State private var locationLat: Double = 0
    @State private var locationLon: Double = 0
    @State private var selectedPackId: String? = nil
    @State private var isLoading = false
    @State private var error: String?
    @State private var showingLocationSearch = false
    /// The trail the trip is for. Optional: without one, the trip shows
    /// conditions from trails near its destination.
    @State private var trail: (id: String, name: String)?
    @State private var showingTrailPicker = false
    @State private var trailLocation = TrailReportLocationProvider()
    @FocusState private var isInputFocused: Bool

    private var isEditing: Bool { existingTrip != nil }
    private var isValid: Bool { !name.trimmingCharacters(in: .whitespaces).isEmpty }
    private var availablePacks: [Pack] { (packsViewModel ?? appState.packsVM).packs }

    /// A new trip started from a trail page: named after the trail, headed to it.
    private let startingTrail: TrailSummary?

    init(
        viewModel: TripsViewModel,
        existingTrip: Trip? = nil,
        packsViewModel: PacksViewModel? = nil,
        startingTrail: TrailSummary? = nil
    ) {
        self.viewModel = viewModel
        self.existingTrip = existingTrip
        self.packsViewModel = packsViewModel
        self.startingTrail = startingTrail
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Name", text: $name)
                        .focused($isInputFocused)
                        .submitLabel(.done)
                        .onSubmit { isInputFocused = false }
                        .accessibilityIdentifier("trip_name")
                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(3, reservesSpace: true)
                        .focused($isInputFocused)
                        .accessibilityIdentifier("trip_description")
                }

                Section("Location") {
                    Button {
                        showingLocationSearch = true
                    } label: {
                        HStack {
                            Image(systemName: "mappin.circle.fill")
                                .foregroundStyle(locationName.isEmpty ? Color.secondary : Color.red)
                            Text(locationName.isEmpty ? "Search for a location…" : locationName)
                                .foregroundStyle(locationName.isEmpty ? Color.secondary : Color.primary)
                            Spacer()
                            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("trip_location_search_button")
                    if !locationName.isEmpty {
                        Button("Clear Location", systemImage: "xmark.circle") {
                            locationName = ""; locationLat = 0; locationLon = 0
                        }
                        .foregroundStyle(.red)
                    }
                    if locationLat != 0 || locationLon != 0 {
                        Label(String(format: "%.4f, %.4f", locationLat, locationLon),
                              systemImage: "location.fill")
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                }

                if NavItem.trailConditions.isFeatureEnabled {
                    trailSection
                }

                Section("Dates") {
                    Toggle("Set trip dates", isOn: $hasDates.animation())
                    if hasDates {
                        DatePicker("Start Date", selection: $startDate, displayedComponents: .date)
                        DatePicker("End Date", selection: $endDate, in: startDate..., displayedComponents: .date)
                    }
                }

                Section("Pack") {
                    Picker("Pack", selection: $selectedPackId) {
                        Text("None").tag(String?.none)
                        ForEach(availablePacks) { pack in
                            Label(pack.name, systemImage: "backpack")
                                .tag(Optional(pack.id))
                        }
                    }
                    if availablePacks.isEmpty {
                        Text("Create a pack first if you want to connect gear to this trip.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    if let packId = selectedPackId,
                       let pack = availablePacks.first(where: { $0.id == packId }) {
                        HStack {
                            Label("\(pack.itemCount) items", systemImage: "archivebox")
                                .font(.caption).foregroundStyle(.secondary)
                            Spacer()
                            if let total = pack.totalWeight {
                                Text(pack.formattedWeight(total, in: weightUnit))
                                    .font(.caption.monospacedDigit())
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                Section("Notes") {
                    TextField("Notes", text: $notes, axis: .vertical)
                        .lineLimit(4, reservesSpace: true)
                        .focused($isInputFocused)
                        .accessibilityIdentifier("trip_notes")
                }

                if let error {
                    Section { InlineErrorView(message: error) }
                }
            }
            .packRatFormStyle()
            .dismissesKeyboardOnScroll()
            .keyboardDoneButton(isFocused: $isInputFocused)
            .navigationTitle(isEditing ? "Edit Trip" : "Plan Trip")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "Save" : "Create") { submit() }
                        .disabled(!isValid || isLoading)
                }
            }
            .onAppear { prefill() }
            .navigationDestination(isPresented: $showingTrailPicker) {
                ReportTrailPickerView(
                    selectedTrailId: trail?.id,
                    location: trailLocation,
                    origin: destination,
                    allowsPin: false
                ) { picked in
                    if case .trail(let summary) = picked {
                        trail = (summary.id, summary.name)
                    }
                    showingTrailPicker = false
                }
            }
            .sheet(isPresented: $showingLocationSearch) {
                LocationSearchView { result in
                    locationName = result.name
                    locationLat = result.latitude
                    locationLon = result.longitude
                }
            }
        }
        .formSheetSize(minWidth: 560, minHeight: 620)
    }

    /// The destination, once one is chosen, so the picker lists trails there.
    private var destination: CLLocationCoordinate2D? {
        guard locationLat != 0 || locationLon != 0 else { return nil }
        return CLLocationCoordinate2D(latitude: locationLat, longitude: locationLon)
    }

    private var trailSection: some View {
        Section {
            Button {
                showingTrailPicker = true
            } label: {
                HStack {
                    Image(systemName: "figure.hiking")
                        .foregroundStyle(trail == nil ? Color.secondary : Color.accentColor)
                    Text(trail?.name ?? "Choose a trail…")
                        .foregroundStyle(trail == nil ? Color.secondary : Color.primary)
                    Spacer()
                    Image(systemName: "chevron.right").font(.caption).foregroundStyle(.secondary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("trip_trail_button")
            if trail != nil {
                Button("Remove Trail", systemImage: "xmark.circle") { trail = nil }
                    .foregroundStyle(.red)
            }
        } header: {
            Text("Trail")
        } footer: {
            Text(trail == nil
                 ? "Optional. Without a trail, the trip shows conditions from trails near its destination."
                 : "The trip shows conditions reported on this trail.")
        }
    }

    private func prefill() {
        guard let trip = existingTrip else {
            if let startingTrail {
                trail = (startingTrail.id, startingTrail.name)
                name = startingTrail.name
                if let center = startingTrail.center {
                    locationName = startingTrail.name
                    locationLat = center.latitude
                    locationLon = center.longitude
                }
            }
            return
        }
        if let id = trip.trailId { trail = (id, trip.trailName ?? "Trail") }
        name = trip.name
        description = trip.description ?? ""
        notes = trip.notes ?? ""
        locationName = trip.location?.name ?? ""
        locationLat = trip.location?.latitude ?? 0
        locationLon = trip.location?.longitude ?? 0
        selectedPackId = trip.packId
        if let s = trip.startDate, let d = s.toDate() { startDate = d; hasDates = true }
        if let e = trip.endDate, let d = e.toDate() { endDate = d }
    }

    private func geocode(_ name: String) async -> (Double, Double) {
        let geocoder = CLGeocoder()
        guard let place = try? await geocoder.geocodeAddressString(name).first,
              let loc = place.location else { return (0, 0) }
        return (loc.coordinate.latitude, loc.coordinate.longitude)
    }

    private func submit() {
        guard isValid, !isLoading else { return }
        isLoading = true
        error = nil
        Task {
            defer { isLoading = false }
            do {
                // Geocode location if name provided but no coords yet
                if !locationName.isEmpty && locationLat == 0 && locationLon == 0 {
                    let (lat, lon) = await geocode(locationName)
                    locationLat = lat; locationLon = lon
                }
                let location = locationName.isEmpty ? nil : TripLocationBody(
                    latitude: locationLat, longitude: locationLon, name: locationName
                )
                #if os(iOS)
                if hasDates { await TripReminderScheduler.requestAuthorizationIfNeeded() }
                #endif
                if let trip = existingTrip {
                    try await viewModel.updateTrip(
                        trip.id,
                        name: name, description: description.isEmpty ? nil : description,
                        startDate: hasDates ? startDate : nil,
                        endDate: hasDates ? endDate : nil,
                        location: location,
                        notes: notes.isEmpty ? nil : notes,
                        packId: selectedPackId,
                        trail: trail,
                        context: modelContext
                    )
                } else {
                    // Create never throws — offline writes queue for replay.
                    await viewModel.createTrip(
                        name: name, description: description.isEmpty ? nil : description,
                        startDate: hasDates ? startDate : nil,
                        endDate: hasDates ? endDate : nil,
                        location: location,
                        notes: notes.isEmpty ? nil : notes,
                        packId: selectedPackId,
                        trail: trail,
                        context: modelContext
                    )
                }
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
