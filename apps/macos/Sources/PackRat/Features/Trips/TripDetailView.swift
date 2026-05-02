import SwiftUI

struct TripDetailView: View {
    let trip: Trip
    let viewModel: TripsViewModel

    @State private var showingEditSheet = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Metadata cards
                HStack(spacing: 12) {
                    if !trip.dateRange.isEmpty {
                        metaCard("Dates", value: trip.dateRange, symbol: "calendar", color: .blue)
                    }
                    if let loc = trip.location?.name {
                        metaCard("Location", value: loc, symbol: "mappin.circle", color: .red)
                    }
                    if let packName = trip.pack?.name {
                        metaCard("Pack", value: packName, symbol: "backpack", color: .green)
                    }
                }
                .padding(.horizontal)

                if let desc = trip.description, !desc.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Description")
                            .font(.caption.uppercaseSmallCaps())
                            .foregroundStyle(.secondary)
                        Text(desc)
                            .font(.body)
                    }
                    .padding(.horizontal)
                }

                if let notes = trip.notes, !notes.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Notes")
                            .font(.caption.uppercaseSmallCaps())
                            .foregroundStyle(.secondary)
                        Text(notes)
                            .font(.body)
                            .foregroundStyle(.secondary)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.fill.secondary, in: RoundedRectangle(cornerRadius: 10))
                    .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
        .navigationTitle(trip.name)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.large)
        #endif
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Edit", systemImage: "pencil") {
                    showingEditSheet = true
                }
            }
        }
        .sheet(isPresented: $showingEditSheet) {
            TripFormView(viewModel: viewModel, existingTrip: trip)
        }
    }

    private func metaCard(_ label: String, value: String, symbol: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(label, systemImage: symbol)
                .font(.caption)
                .foregroundStyle(color)
            Text(value)
                .font(.callout.bold())
                .lineLimit(2)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }
}
