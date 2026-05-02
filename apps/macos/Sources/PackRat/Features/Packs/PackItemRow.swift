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

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(item.name)
                    .font(.body)

                HStack(spacing: 8) {
                    if !item.displayWeight.isEmpty {
                        Label(item.displayWeight, systemImage: "scalemass")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if let qty = item.quantity, qty > 1 {
                        Label("×\(qty)", systemImage: "number")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if item.worn == true {
                        Label("Worn", systemImage: "person.fill")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                    if item.consumable == true {
                        Label("Consumable", systemImage: "flame")
                            .font(.caption)
                            .foregroundStyle(.purple)
                    }
                }
            }

            Spacer()

            if let notes = item.notes, !notes.isEmpty {
                Image(systemName: "note.text")
                    .foregroundStyle(.secondary)
                    .font(.caption)
                    .help(notes)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
        .onTapGesture(perform: onEdit)
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
            Button("Edit", systemImage: "pencil", action: onEdit)
            Divider()
            Button("Delete", systemImage: "trash", role: .destructive, action: onDelete)
        }
        .draggable(item.id) {
            // Drag preview
            Label(item.name, systemImage: "archivebox")
                .padding(8)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 8))
        }
    }
}
