import SwiftUI

struct RecentPacksView: View {
    let packs: [Pack]

    private var sorted: [Pack] {
        packs.sorted {
            ($0.createdAt ?? "") > ($1.createdAt ?? "")
        }
    }

    var body: some View {
        Group {
            if sorted.isEmpty {
                ContentUnavailableView(
                    "No Packs",
                    systemImage: "backpack",
                    description: Text("Create a pack to get started")
                )
            } else {
                List(sorted) { pack in
                    RecentPackRow(pack: pack)
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Recent Packs")
        .accessibilityIdentifier("recent_packs_view")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.large)
        #endif
    }
}

private struct RecentPackRow: View {
    let pack: Pack

    private var timeAgo: String {
        guard let dateStr = pack.createdAt,
              let date = ISO8601DateFormatter().date(from: dateStr) else {
            return ""
        }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color.accentColor.opacity(0.12))
                .frame(width: 44, height: 44)
                .overlay {
                    Image(systemName: "backpack")
                        .foregroundStyle(.tint)
                }

            VStack(alignment: .leading, spacing: 3) {
                Text(pack.name)
                    .font(.body)
                if let desc = pack.description, !desc.isEmpty {
                    Text(desc)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 3) {
                Text(pack.formattedWeight(pack.totalWeight))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
                if !timeAgo.isEmpty {
                    Text(timeAgo)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}
