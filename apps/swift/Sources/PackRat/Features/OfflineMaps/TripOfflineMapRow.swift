#if os(iOS)
import CoreLocation
import SwiftUI

/// On a trip: offers to save the map around its destination, then shows the
/// download and a "Saved for offline" badge once it is done.
struct TripOfflineMapRow: View {
    let tripId: String
    let tripName: String
    let destination: CLLocationCoordinate2D
    let endDate: Date?

    @State private var store = OfflineMapStore.shared
    @State private var showingPicker = false

    var body: some View {
        Group {
            if let area = store.area(forTrip: tripId) {
                saved(area)
            } else {
                Button {
                    showingPicker = true
                } label: {
                    Label("Save Map for Offline", systemImage: "arrow.down.circle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("trip_save_offline_map")
            }
        }
        .padding(.horizontal)
        .sheet(isPresented: $showingPicker) {
            NavigationStack {
                OfflineAreaPickerView(
                    initialCenter: destination,
                    suggestedName: tripName,
                    tripId: tripId,
                    tripEndDate: endDate
                )
            }
        }
    }

    @ViewBuilder
    private func saved(_ area: OfflineArea) -> some View {
        if let progress = store.progress[area.id] {
            VStack(alignment: .leading, spacing: 4) {
                Label("Saving map for offline", systemImage: "arrow.down.circle")
                    .font(.subheadline)
                ProgressView(value: progress.fraction)
                Text("\(Int(progress.fraction * 100))% · \(progress.bytes.fileSizeText)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
            .accessibilityIdentifier("trip_offline_map_progress")
        } else if store.failures[area.id] != nil {
            Button {
                store.update(area)
            } label: {
                Label("Map didn't finish saving. Try again.", systemImage: "exclamationmark.triangle")
                    .font(.subheadline)
            }
            .tint(.orange)
            .accessibilityIdentifier("trip_offline_map_retry")
        } else {
            Label("Saved for offline", systemImage: "checkmark.circle.fill")
                .font(.subheadline)
                .foregroundStyle(.green)
                .accessibilityIdentifier("trip_offline_map_saved")
        }
    }
}
#endif
