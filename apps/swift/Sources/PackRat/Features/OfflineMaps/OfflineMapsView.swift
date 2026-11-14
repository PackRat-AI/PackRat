#if os(iOS)
import Defaults
import SwiftUI

/// Every saved map area, the space they take, and the download settings.
struct OfflineMapsView: View {
    @State private var store = OfflineMapStore.shared
    @Default(.offlineMapsAllowCellular) private var allowCellular
    @Default(.offlineMapsStorageLimitBytes) private var storageLimit
    @State private var showingPicker = false
    @State private var renaming: OfflineArea?
    @State private var newName = ""
    @State private var confirmingDeleteAll = false

    private static let limitChoices: [Int64] = [0, 500_000_000, 1_000_000_000, 2_000_000_000, 5_000_000_000]

    var body: some View {
        List {
            if store.areas.isEmpty {
                ContentUnavailableView {
                    Label("No saved maps", systemImage: "map")
                } description: {
                    Text("Save the map for an area before you go, and it keeps working without signal.")
                } actions: {
                    Button("Save a Map Area") { showingPicker = true }
                        .buttonStyle(.borderedProminent)
                        .accessibilityIdentifier("offline_maps_empty_add")
                }
                .listRowBackground(Color.clear)
            } else {
                Section {
                    ForEach(sortedAreas) { area in
                        row(for: area)
                            .swipeActions {
                                Button("Delete", role: .destructive) { store.delete(area) }
                            }
                            .contextMenu { menu(for: area) }
                    }
                } header: {
                    Text("Saved Areas")
                } footer: {
                    Text("\(store.totalBytes.fileSizeText) used")
                }

                Section {
                    Button("Delete All Saved Maps", role: .destructive) { confirmingDeleteAll = true }
                        .accessibilityIdentifier("offline_maps_delete_all")
                }
            }

            Section {
                Toggle("Download over Cellular", isOn: $allowCellular)
                    .accessibilityIdentifier("offline_maps_allow_cellular")
                Picker("Storage Limit", selection: $storageLimit) {
                    ForEach(Self.limitChoices, id: \.self) { bytes in
                        Text(bytes == 0 ? "No Limit" : bytes.fileSizeText).tag(bytes)
                    }
                }
                .accessibilityIdentifier("offline_maps_storage_limit")
            } header: {
                Text("Downloads")
            } footer: {
                Text("Maps download over Wi-Fi unless you allow cellular.")
            }
        }
        .navigationTitle("Offline Maps")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showingPicker = true
                } label: {
                    Label("Save a Map Area", systemImage: "plus")
                }
                .accessibilityIdentifier("offline_maps_add")
            }
        }
        .sheet(isPresented: $showingPicker) {
            NavigationStack { OfflineAreaPickerView() }
        }
        .alert("Rename Map", isPresented: Binding(
            get: { renaming != nil },
            set: { if !$0 { renaming = nil } }
        )) {
            TextField("Name", text: $newName)
            Button("Save") {
                if let renaming { store.rename(renaming, to: newName) }
                renaming = nil
            }
            Button("Cancel", role: .cancel) { renaming = nil }
        }
        .confirmationDialog(
            "Delete all saved maps?",
            isPresented: $confirmingDeleteAll,
            titleVisibility: .visible
        ) {
            Button("Delete All", role: .destructive) { store.deleteAll() }
        } message: {
            Text("Maps for these areas won't work without signal until you save them again.")
        }
    }

    /// Areas for finished trips first, so they are easy to clear out.
    private var sortedAreas: [OfflineArea] {
        store.areas.sorted { lhs, rhs in
            if lhs.tripHasEnded != rhs.tripHasEnded { return lhs.tripHasEnded }
            return lhs.savedAt > rhs.savedAt
        }
    }

    /// A finished area opens its map; one still downloading keeps its
    /// Cancel and Try Again buttons tappable instead.
    @ViewBuilder
    private func row(for area: OfflineArea) -> some View {
        if area.isComplete && !store.isDownloading(area.id) && store.failures[area.id] == nil {
            NavigationLink {
                OfflineAreaMapView(area: area)
            } label: {
                OfflineAreaRow(area: area, store: store)
            }
        } else {
            OfflineAreaRow(area: area, store: store)
        }
    }

    @ViewBuilder
    private func menu(for area: OfflineArea) -> some View {
        Button {
            newName = area.name
            renaming = area
        } label: {
            Label("Rename", systemImage: "pencil")
        }
        if area.isComplete && !store.isDownloading(area.id) {
            Button {
                store.update(area)
            } label: {
                Label("Update Map", systemImage: "arrow.clockwise")
            }
        }
        Button(role: .destructive) {
            store.delete(area)
        } label: {
            Label("Delete", systemImage: "trash")
        }
    }
}

private struct OfflineAreaRow: View {
    let area: OfflineArea
    let store: OfflineMapStore

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(area.name).font(.headline)
                Spacer()
                if store.isDownloading(area.id) {
                    Button("Cancel") { store.cancel(area) }
                        .buttonStyle(.borderless)
                        .font(.subheadline)
                }
            }

            if let progress = store.progress[area.id] {
                ProgressView(value: progress.fraction)
                Text("\(Int(progress.fraction * 100))% · \(progress.bytes.fileSizeText)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            } else if let failure = store.failures[area.id] {
                Text(failure.localizedDescription)
                    .font(.caption)
                    .foregroundStyle(.red)
                Button("Try Again") { store.update(area) }
                    .buttonStyle(.borderless)
                    .font(.caption)
            } else {
                Text(details)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if area.tripHasEnded {
                Label("Trip finished", systemImage: "flag.checkered")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
        }
        .padding(.vertical, 2)
        .accessibilityIdentifier("offline_area_row_\(area.id)")
    }

    private var details: String {
        [
            area.sizeBytes.fileSizeText,
            area.detail.label,
            area.savedAt.formatted(date: .abbreviated, time: .omitted),
        ].joined(separator: " · ")
    }
}
#endif
