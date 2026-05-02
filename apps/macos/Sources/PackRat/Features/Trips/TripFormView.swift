import SwiftUI

struct TripFormView: View {
    let viewModel: TripsViewModel
    let existingTrip: Trip?

    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var description = ""
    @State private var notes = ""
    @State private var startDate: Date = Date()
    @State private var endDate: Date = Date().addingTimeInterval(86400 * 3)
    @State private var hasDates = false
    @State private var locationName = ""
    @State private var isLoading = false
    @State private var error: String?

    private var isEditing: Bool { existingTrip != nil }
    private var isValid: Bool { !name.trimmingCharacters(in: .whitespaces).isEmpty }

    init(viewModel: TripsViewModel, existingTrip: Trip? = nil) {
        self.viewModel = viewModel
        self.existingTrip = existingTrip
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Trip Name", text: $name)
                    TextField("Description (optional)", text: $description, axis: .vertical)
                        .lineLimit(3, reservesSpace: true)
                }

                Section("Location") {
                    TextField("Location name (optional)", text: $locationName)
                }

                Section("Dates") {
                    Toggle("Set trip dates", isOn: $hasDates.animation())
                    if hasDates {
                        DatePicker("Start Date", selection: $startDate, displayedComponents: .date)
                        DatePicker("End Date", selection: $endDate, in: startDate..., displayedComponents: .date)
                    }
                }

                Section("Notes") {
                    TextField("Additional notes", text: $notes, axis: .vertical)
                        .lineLimit(4, reservesSpace: true)
                }

                if let error {
                    Section {
                        InlineErrorView(message: error)
                    }
                }
            }
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
        }
        #if os(macOS)
        .frame(minWidth: 400, minHeight: 380)
        #endif
    }

    private func prefill() {
        guard let trip = existingTrip else { return }
        name = trip.name
        description = trip.description ?? ""
        notes = trip.notes ?? ""
        locationName = trip.location?.name ?? ""
        let fmt = ISO8601DateFormatter()
        if let s = trip.startDate, let d = fmt.date(from: s) { startDate = d; hasDates = true }
        if let e = trip.endDate, let d = fmt.date(from: e) { endDate = d }
    }

    private func submit() {
        guard isValid, !isLoading else { return }
        isLoading = true
        error = nil
        let location = locationName.isEmpty ? nil : TripLocationBody(latitude: 0, longitude: 0, name: locationName)
        Task {
            defer { isLoading = false }
            do {
                if let trip = existingTrip {
                    try await viewModel.updateTrip(
                        trip.id,
                        name: name, description: description.isEmpty ? nil : description,
                        startDate: hasDates ? startDate : nil,
                        endDate: hasDates ? endDate : nil,
                        location: location,
                        notes: notes.isEmpty ? nil : notes,
                        packId: trip.packId
                    )
                } else {
                    try await viewModel.createTrip(
                        name: name, description: description.isEmpty ? nil : description,
                        startDate: hasDates ? startDate : nil,
                        endDate: hasDates ? endDate : nil,
                        location: location,
                        notes: notes.isEmpty ? nil : notes,
                        packId: nil
                    )
                }
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
