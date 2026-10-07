import SwiftData
import SwiftUI

/// A trip's "Before you go" list: the non-gear things that can stop a trip —
/// a permit, a park pass, a campsite booking. Synced with the trip, so it
/// survives a lost phone; unticked tasks feed the evening-before reminder.
struct TripChecklistSection: View {
    let trip: Trip
    let viewModel: TripsViewModel

    @Environment(\.modelContext) private var modelContext
    @State private var draft = ""
    @FocusState private var isAdding: Bool

    private var items: [TripChecklistItem] { trip.checklist ?? [] }
    private var suggestions: [String] { TripReminderPlanner.checklistSuggestions(for: trip) }
    private var remaining: Int { items.filter { !$0.done }.count }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("BEFORE YOU GO")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                if !items.isEmpty {
                    Text(remaining == 0 ? "All done" : "\(remaining) to do")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(remaining == 0 ? AnyShapeStyle(.green) : AnyShapeStyle(.secondary))
                }
            }

            VStack(spacing: 0) {
                ForEach(items) { item in
                    row(item)
                    Divider().padding(.leading, 46)
                }
                addRow
            }
            .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))

            if !suggestions.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(suggestions, id: \.self) { title in
                            Button {
                                add(title)
                            } label: {
                                Label(title, systemImage: "plus")
                                    .font(.footnote.weight(.medium))
                            }
                            .buttonStyle(.bordered)
                            .buttonBorderShape(.capsule)
                            .controlSize(.small)
                        }
                    }
                }
                .scrollClipDisabled()
                .accessibilityLabel("Suggestions")
            }
        }
        .padding(.horizontal)
        .accessibilityIdentifier("trip_checklist_section")
    }

    private func row(_ item: TripChecklistItem) -> some View {
        Button {
            toggle(item)
        } label: {
            HStack(spacing: 12) {
                Image(systemName: item.done ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(item.done ? AnyShapeStyle(.green) : AnyShapeStyle(.tertiary))
                    .contentTransition(.symbolEffect(.replace))
                Text(item.title)
                    .font(.callout)
                    .strikethrough(item.done)
                    .foregroundStyle(item.done ? .secondary : .primary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: item.done)
        .contextMenu {
            Button("Delete", systemImage: "trash", role: .destructive) { remove(item) }
        }
        .accessibilityAddTraits(item.done ? .isSelected : [])
        .accessibilityAction(named: "Delete") { remove(item) }
    }

    private var addRow: some View {
        HStack(spacing: 12) {
            Image(systemName: "plus.circle.fill")
                .font(.title3)
                .foregroundStyle(.tint)
            TextField("Add a permit, pass or booking", text: $draft)
                .font(.callout)
                .focused($isAdding)
                .submitLabel(.done)
                .onSubmit {
                    add(draft)
                    draft = ""
                }
                .accessibilityIdentifier("trip_checklist_add_field")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }

    // MARK: - Edits

    private func add(_ title: String) {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              !items.contains(where: { $0.title.caseInsensitiveCompare(trimmed) == .orderedSame })
        else { return }
        let item = TripChecklistItem(id: UUID().uuidString.lowercased(), title: String(trimmed.prefix(200)), done: false)
        save(items + [item])
    }

    private func toggle(_ item: TripChecklistItem) {
        save(items.map { $0.id == item.id ? TripChecklistItem(id: $0.id, title: $0.title, done: !$0.done) : $0 })
    }

    private func remove(_ item: TripChecklistItem) {
        save(items.filter { $0.id != item.id })
    }

    private func save(_ checklist: [TripChecklistItem]) {
        viewModel.updateChecklist(trip.id, checklist, context: modelContext)
    }
}
