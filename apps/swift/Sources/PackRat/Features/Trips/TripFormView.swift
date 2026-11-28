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
    @State private var didPrefill = false
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
                Section {
                    TextField("Trip name", text: $name)
                        .font(.title3.weight(.semibold))
                        .focused($isInputFocused)
                        .submitLabel(.done)
                        .onSubmit { isInputFocused = false }
                        .accessibilityIdentifier("trip_name")
                    TextField("Description", text: $description, prompt: Text("Description"), axis: .vertical)
                        .lineLimit(1...4)
                        .formMultilineField()
                        .focused($isInputFocused)
                        .accessibilityIdentifier("trip_description")
                }

                whereSection
                whenSection
                packSection

                Section("Notes") {
                    TextField("Notes", text: $notes, prompt: Text("Add notes"), axis: .vertical)
                        .lineLimit(3...8)
                        .formMultilineField()
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
            .onAppear {
                // onAppear fires again when a pushed picker pops; fill only once so choices stick.
                guard !didPrefill else { return }
                didPrefill = true
                prefill()
            }
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
                LocationSearchView(initial: pickedLocation) { result in
                    locationName = result.name
                    locationLat = result.latitude
                    locationLon = result.longitude
                }
            }
        }
        .formSheetSize(minWidth: 560, minHeight: 620)
    }

    /// The place already chosen, so the location picker opens on it.
    private var pickedLocation: LocationSearchResult? {
        guard locationLat != 0 || locationLon != 0 else { return nil }
        let parts = locationName.split(separator: ",", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
        return LocationSearchResult(
            name: parts.first ?? locationName, subtitle: parts.count > 1 ? parts[1] : "",
            latitude: locationLat, longitude: locationLon
        )
    }

    /// The destination, once one is chosen, so the picker lists trails there.
    private var destination: CLLocationCoordinate2D? {
        guard locationLat != 0 || locationLon != 0 else { return nil }
        return CLLocationCoordinate2D(latitude: locationLat, longitude: locationLon)
    }

    private var whereSection: some View {
        Section {
            HStack(spacing: 12) {
                Button {
                    showingLocationSearch = true
                } label: {
                    pickerRow(
                        symbol: "mappin.circle.fill",
                        tint: .red,
                        title: locationName.isEmpty ? "Add location" : locationName,
                        isSet: !locationName.isEmpty
                    )
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("trip_location_search_button")
                if !locationName.isEmpty {
                    clearButton("Clear Location") { locationName = ""; locationLat = 0; locationLon = 0 }
                }
            }

            if NavItem.trailConditions.isFeatureEnabled {
                HStack(spacing: 12) {
                    Button {
                        showingTrailPicker = true
                    } label: {
                        pickerRow(
                            symbol: "figure.hiking",
                            tint: .green,
                            title: trail?.name ?? "Add trail",
                            isSet: trail != nil
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("trip_trail_button")
                    if trail != nil {
                        clearButton("Remove Trail") { trail = nil }
                    }
                }
            }
        } header: {
            Text("Where")
        } footer: {
            if NavItem.trailConditions.isFeatureEnabled {
                Text(trail == nil
                     ? "Add a trail to see conditions reported on it. Without one, the trip shows conditions from trails nearby."
                     : "The trip shows conditions reported on this trail.")
            }
        }
    }

    private var whenSection: some View {
        Section("When") {
            Toggle("Dates", isOn: $hasDates.animation())
                .accessibilityIdentifier("trip_dates_toggle")
            if hasDates {
                DatePicker("Starts", selection: $startDate, displayedComponents: .date)
                    .accessibilityIdentifier("trip_start_date")
                DatePicker("Ends", selection: $endDate, in: startDate..., displayedComponents: .date)
                    .accessibilityIdentifier("trip_end_date")
            }
        }
        .onChange(of: startDate) { old, new in
            // Moving the start keeps the trip's length, like Calendar does.
            let length = endDate.timeIntervalSince(old)
            endDate = new.addingTimeInterval(max(length, 0))
        }
    }

    private var packSection: some View {
        Section("Pack") {
            NavigationLink {
                TripPackChooserView(selectedPackId: $selectedPackId, packsViewModel: packsViewModel ?? appState.packsVM)
            } label: {
                if let pack = selectedPack {
                    HStack(spacing: 12) {
                        Image(systemName: pack.category?.symbol ?? "backpack")
                            .foregroundStyle(Color.accentColor)
                            .frame(width: 28)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(pack.name).foregroundStyle(.primary).lineLimit(1)
                            Text(packDetail(pack))
                                .font(.subheadline.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                    }
                } else {
                    pickerRow(symbol: "backpack", tint: .accentColor, title: "Add pack", isSet: false)
                }
            }
            .accessibilityIdentifier("trip_pack_button")
        }
    }

    private var selectedPack: Pack? {
        guard let selectedPackId else { return nil }
        return availablePacks.first { $0.id == selectedPackId }
    }

    private func packDetail(_ pack: Pack) -> String {
        let items = pack.itemCount == 1 ? "1 item" : "\(pack.itemCount) items"
        guard let total = pack.totalWeight, total > 0 else { return items }
        return "\(items) · \(pack.formattedWeight(total, in: weightUnit))"
    }

    /// A full-width tappable row for a Where field: icon, value or prompt.
    private func pickerRow(symbol: String, tint: Color, title: String, isSet: Bool) -> some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .foregroundStyle(isSet ? tint : Color.secondary)
                .frame(width: 28)
            Text(title)
                .foregroundStyle(isSet ? Color.primary : Color.accentColor)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        // Plain buttons only hit-test their glyphs; make the whole row tappable.
        .contentShape(Rectangle())
    }

    private func clearButton(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: "xmark.circle.fill")
                .font(.title3)
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(.secondary)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
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
                #if os(iOS) || os(macOS)
                if hasDates { await TripReminderScheduler.requestAuthorizationIfNeeded() }
                // Trips with a destination watch it for weather alerts, pushed by the server.
                if hasDates, location != nil, FeatureFlagStore.shared.isEnabled(TripWeatherSection.flagKey) {
                    await PushRegistrationService.registerForPushIfNeeded()
                }
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
