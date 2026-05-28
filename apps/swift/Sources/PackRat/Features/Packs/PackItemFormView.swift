import SwiftUI
import SwiftData

struct PackItemFormView: View {
    let packId: String
    let viewModel: PacksViewModel
    let existingItem: PackItem?

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext

    @State private var name = ""
    @State private var weightText = ""
    @State private var weightUnit = "g"
    @State private var category = ""
    @State private var quantity = 1
    @State private var consumable = false
    @State private var worn = false
    @State private var notes = ""
    @State private var isLoading = false
    @State private var error: String?

    private var isEditing: Bool { existingItem != nil }
    private var isValid: Bool { !name.trimmingCharacters(in: .whitespaces).isEmpty }

    init(packId: String, viewModel: PacksViewModel, existingItem: PackItem? = nil) {
        self.packId = packId
        self.viewModel = viewModel
        self.existingItem = existingItem
    }

    var body: some View {
        NavigationStack {
            formContent
                .navigationTitle(isEditing ? "Edit Item" : "Add Item")
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                #endif
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button(isLoading ? "Saving..." : (isEditing ? "Save" : "Add")) { submit() }
                            .disabled(!isValid || isLoading)
                    }
                }
                .onAppear { prefill() }
        }
        .formSheetSize(minWidth: 540, minHeight: 560)
    }

    private var formContent: some View {
        Form {
            Section("Item") {
                TextField("Name", text: $name)
                    .textContentType(.name)
                    .accessibilityIdentifier("pack_item_name")

                Picker("Category", selection: $category) {
                    Text("None").tag("")
                    ForEach(PackCategory.allCases, id: \.rawValue) { cat in
                        Label(cat.label, systemImage: cat.symbol).tag(cat.rawValue)
                    }
                }
            }

            Section("Weight") {
                LabeledContent("Weight") {
                    HStack {
                        TextField("0", text: $weightText)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 72)
                            #if os(iOS)
                            .keyboardType(.decimalPad)
                            #endif
                            .accessibilityIdentifier("item_weight")

                        Picker("Unit", selection: $weightUnit) {
                            ForEach(AppWeightUnit.allCases, id: \.rawValue) { u in
                                Text(u.label).tag(u.rawValue)
                            }
                        }
                        .labelsHidden()
                        .frame(width: 76)
                    }
                }

                Stepper("Quantity: \(quantity)", value: $quantity, in: 1...999)
            }

            Section {
                Toggle("Worn on body", isOn: $worn)
                Toggle("Consumable", isOn: $consumable)
            } header: {
                Text("Pack Weight")
            } footer: {
                Text("Worn and consumable items are tracked separately from base weight.")
            }

            Section("Notes") {
                TextField("Notes", text: $notes, axis: .vertical)
                    .lineLimit(3, reservesSpace: true)
                    .accessibilityIdentifier("pack_item_notes")
            }

            if let error {
                Section {
                    InlineErrorView(message: error)
                }
            }
        }
    }

    private func prefill() {
        guard let item = existingItem else { return }
        name = item.name
        weightText = item.weight > 0 ? String(format: "%.0f", item.weight) : ""
        weightUnit = item.weightUnit.rawValue
        quantity = item.quantity
        category = item.category ?? ""
        consumable = item.consumable
        worn = item.worn
        notes = item.notes ?? ""
    }

    private func submit() {
        guard isValid, !isLoading else { return }
        isLoading = true
        error = nil
        let weight = Double(weightText)
        Task {
            defer { isLoading = false }
            do {
                if let item = existingItem {
                    try await viewModel.updateItem(
                        item.id, in: packId,
                        name: name, weight: weight,
                        weightUnit: weight != nil ? weightUnit : nil,
                        quantity: quantity,
                        category: category.isEmpty ? nil : category,
                        consumable: consumable, worn: worn,
                        notes: notes.isEmpty ? nil : notes,
                        context: modelContext
                    )
                } else {
                    try await viewModel.addItem(
                        to: packId,
                        name: name, weight: weight,
                        weightUnit: weight != nil ? weightUnit : nil,
                        quantity: quantity,
                        category: category.isEmpty ? nil : category,
                        consumable: consumable, worn: worn,
                        notes: notes.isEmpty ? nil : notes,
                        context: modelContext
                    )
                }
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
