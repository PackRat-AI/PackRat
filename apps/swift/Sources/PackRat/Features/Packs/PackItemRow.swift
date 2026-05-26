import SwiftUI
import UniformTypeIdentifiers

// UTType for drag-and-drop of pack items within the app
extension UTType {
    static let packItem = UTType(exportedAs: "world.packrat.packitem")
}

struct PackItemRow: View {
    let item: PackItem
    let onEdit: () -> Void
    let onDelete: () -> Void
    var onDetail: (() -> Void)? = nil

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(item.name)
                    .font(.body)
                    .accessibilityLabel(item.name)

                HStack(spacing: 8) {
                    if !item.displayWeight.isEmpty {
                        Label(item.displayWeight, systemImage: "scalemass")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if item.quantity > 1 {
                        Label("×\(item.quantity)", systemImage: "number")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if item.worn {
                        Label("Worn", systemImage: "person.fill")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                    if item.consumable {
                        Label("Consumable", systemImage: "flame")
                            .font(.caption)
                            .foregroundStyle(.purple)
                    }
                }
            }

            Spacer()

            HStack(spacing: 8) {
                if let notes = item.notes, !notes.isEmpty {
                    Image(systemName: "note.text")
                        .foregroundStyle(.secondary)
                        .font(.caption)
                        .help(notes)
                }
                if onDetail != nil {
                    Image(systemName: "chevron.right")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
        .accessibilityIdentifier("pack_item_row_\(item.id)")
        .contentShape(Rectangle())
        .onTapGesture { onDetail?() ?? onEdit() }
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive, action: onDelete) {
                Label("Delete", systemImage: "trash")
            }
            Button(action: onEdit) {
                Label("Edit", systemImage: "pencil")
            }
            .tint(.blue)
        }
        .contextMenu {
            if onDetail != nil {
                Button("View Details", systemImage: "info.circle", action: { onDetail?() })
            }
            Button("Edit", systemImage: "pencil", action: onEdit)
            Divider()
            Button("Delete", systemImage: "trash", role: .destructive, action: onDelete)
        }
        .draggable(item.id) {
            Label(item.name, systemImage: "archivebox")
                .padding(8)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 8))
        }
    }
}
