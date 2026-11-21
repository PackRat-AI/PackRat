#if os(iOS)
import SwiftUI

/// On a trip or trail page: offers to save the map around it, then shows the
/// download and a "Saved for offline" badge once it is done.
struct OfflineMapRow: View {
    /// The area already saved for this trip or trail, if any.
    let area: OfflineArea?
    /// Prefixes the accessibility identifiers, e.g. `trip` or `trail_page`.
    let idPrefix: String
    /// Sized to its content to sit beside other content on one line, instead of filling the width.
    var compact = false
    @ViewBuilder let picker: () -> OfflineAreaPickerView

    @State private var store = OfflineMapStore.shared
    @State private var showingPicker = false

    var body: some View {
        Group {
            if let area {
                saved(area)
            } else {
                Button {
                    showingPicker = true
                } label: {
                    Label("Save for Offline", systemImage: "arrow.down.circle")
                        .font(compact ? .subheadline.weight(.semibold) : .body)
                        .frame(maxWidth: compact ? nil : .infinity)
                }
                .buttonStyle(.bordered)
                .buttonBorderShape(compact ? .capsule : .automatic)
                .accessibilityIdentifier("\(idPrefix)_save_offline_map")
            }
        }
        .sheet(isPresented: $showingPicker) {
            NavigationStack { picker() }
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
            .frame(maxWidth: compact ? 140 : .infinity, alignment: .leading)
            .accessibilityIdentifier("\(idPrefix)_offline_map_progress")
        } else if store.failures[area.id] != nil {
            Button {
                store.update(area)
            } label: {
                Label("Map didn't finish saving. Try again.", systemImage: "exclamationmark.triangle")
                    .font(.subheadline)
            }
            .tint(.orange)
            .accessibilityIdentifier("\(idPrefix)_offline_map_retry")
        } else {
            Label("Saved for offline", systemImage: "checkmark.circle.fill")
                .font(.subheadline)
                .foregroundStyle(.green)
                .accessibilityIdentifier("\(idPrefix)_offline_map_saved")
        }
    }
}
#endif
