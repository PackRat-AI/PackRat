import SwiftUI

/// Chooses the pack a trip uses: every pack with its size and weight, a
/// checkmark on the current one, None, and New Pack.
struct TripPackChooserView: View {
    @Binding var selectedPackId: String?
    let packsViewModel: PacksViewModel

    @Environment(\.dismiss) private var dismiss
    @Environment(\.weightUnit) private var weightUnit
    @State private var query = ""
    @State private var showingNewPack = false
    /// Pack ids before New Pack opened, so the pack it creates gets selected.
    @State private var idsBeforeNewPack: Set<String>?

    private var packs: [Pack] { packsViewModel.packs }

    private var filteredPacks: [Pack] {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return packs }
        return packs.filter { $0.name.localizedCaseInsensitiveContains(trimmed) }
    }

    var body: some View {
        List {
            Section {
                Button {
                    showingNewPack = true
                } label: {
                    Label("New Pack", systemImage: "plus.circle.fill")
                }
                .accessibilityIdentifier("trip_pack_new")
            }

            Section {
                if query.isEmpty {
                    row(title: "None", subtitle: nil, symbol: "minus.circle", id: nil)
                        .accessibilityIdentifier("trip_pack_none")
                }
                ForEach(filteredPacks) { pack in
                    row(
                        title: pack.name,
                        subtitle: detail(for: pack),
                        symbol: pack.category?.symbol ?? "backpack",
                        id: pack.id
                    )
                    .accessibilityIdentifier("trip_pack_\(pack.id)")
                }
            } footer: {
                if packs.isEmpty {
                    Text("Packs you create show up here.")
                }
            }
        }
        .overlay {
            if !query.isEmpty && filteredPacks.isEmpty {
                ContentUnavailableView.search(text: query)
            }
        }
        .navigationTitle("Pack")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .searchable(text: $query, prompt: "Search packs")
        .sheet(isPresented: $showingNewPack) {
            PackFormView(viewModel: packsViewModel)
        }
        .onChange(of: showingNewPack) { _, isShowing in
            if isShowing { idsBeforeNewPack = Set(packs.map(\.id)) }
        }
        .onChange(of: packs.map(\.id)) { _, ids in
            guard let before = idsBeforeNewPack,
                  let created = ids.first(where: { !before.contains($0) }) else { return }
            idsBeforeNewPack = nil
            selectedPackId = created
            dismiss()
        }
    }

    private func row(title: String, subtitle: String?, symbol: String, id: String?) -> some View {
        Button {
            selectedPackId = id
            dismiss()
        } label: {
            HStack(spacing: 14) {
                Image(systemName: symbol)
                    .font(.body)
                    .foregroundStyle(id == nil ? Color.secondary : Color.accentColor)
                    .frame(width: 32, height: 32)
                    .background(.quaternary.opacity(0.6), in: RoundedRectangle(cornerRadius: 8))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).foregroundStyle(.primary).lineLimit(1)
                    if let subtitle {
                        Text(subtitle)
                            .font(.subheadline.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 0)
                if selectedPackId == id {
                    Image(systemName: "checkmark")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Color.accentColor)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func detail(for pack: Pack) -> String {
        let items = pack.itemCount == 1 ? "1 item" : "\(pack.itemCount) items"
        guard let total = pack.totalWeight, total > 0 else { return items }
        return "\(items) · \(pack.formattedWeight(total, in: weightUnit))"
    }
}
