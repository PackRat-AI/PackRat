import SwiftData
import SwiftUI

/// Past sightings, read from the device.
///
/// Browsable with no network by construction — these rows were never on a
/// server. A recorded sighting is worth more than the moment it was made in.
struct IdentificationHistoryView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \SavedIdentification.timestamp, order: .reverse)
    private var sightings: [SavedIdentification]

    var body: some View {
        Group {
            if sightings.isEmpty {
                UnavailableStateView(
                    title: "No sightings yet",
                    subtitle: "Identifications you save are kept on this device and stay readable without a signal.",
                    systemImage: "clock.arrow.circlepath"
                )
            } else {
                List {
                    ForEach(sightings) { sighting in
                        NavigationLink {
                            SightingDetailView(sighting: sighting)
                        } label: {
                            SightingRow(sighting: sighting)
                        }
                    }
                    .onDelete(perform: delete)
                }
            }
        }
        .navigationTitle("Sightings")
    }

    private func delete(at offsets: IndexSet) {
        for index in offsets {
            modelContext.delete(sightings[index])
        }
        try? modelContext.save()
    }
}

// MARK: - Row

private struct SightingRow: View {
    let sighting: SavedIdentification

    var body: some View {
        HStack(spacing: 12) {
            SightingThumbnail(imageData: sighting.imageData)
            VStack(alignment: .leading, spacing: 4) {
                Text(sighting.primaryName)
                    .font(.headline)
                Text(sighting.timestamp, style: .date)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            // The highest danger among all candidates, not just the top one:
            // a harmless top match with a dangerous runner-up is exactly the
            // case worth flagging in a list.
            if let danger = sighting.highestDangerLevel, danger != .safe {
                DangerBadge(level: danger)
            }
        }
    }
}

private struct SightingThumbnail: View {
    let imageData: Data?

    var body: some View {
        Group {
            #if os(iOS)
            if let imageData, let image = UIImage(data: imageData) {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                placeholder
            }
            #else
            if let imageData, let image = NSImage(data: imageData) {
                Image(nsImage: image).resizable().scaledToFill()
            } else {
                placeholder
            }
            #endif
        }
        .frame(width: 56, height: 56)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private var placeholder: some View {
        RoundedRectangle(cornerRadius: 10)
            .fill(.quaternary)
            .overlay { Image(systemName: "pawprint").foregroundStyle(.secondary) }
    }
}

// MARK: - Detail

private struct SightingDetailView: View {
    let sighting: SavedIdentification

    var body: some View {
        List {
            Section {
                SightingThumbnail(imageData: sighting.imageData)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .scaleEffect(3, anchor: .center)
                    .frame(height: 180)
            }

            Section("Ranked matches") {
                ForEach(Array(sighting.results.enumerated()), id: \.element.id) { index, result in
                    NavigationLink {
                        SpeciesDetailView(result: result)
                    } label: {
                        IdentificationResultRow(result: result, isTopResult: index == 0)
                    }
                }
            }

            Section("Recorded") {
                LabeledContent("When", value: sighting.timestamp.formatted(date: .abbreviated, time: .shortened))
                if let latitude = sighting.latitude, let longitude = sighting.longitude {
                    LabeledContent("Where", value: String(format: "%.3f, %.3f", latitude, longitude))
                }
                if let notes = sighting.notes, !notes.isEmpty {
                    LabeledContent("Notes", value: notes)
                }
            }
        }
        .navigationTitle(sighting.primaryName)
    }
}
