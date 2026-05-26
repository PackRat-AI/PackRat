import SwiftUI

struct PackTemplateItemFormView: View {
    let viewModel: PackTemplatesViewModel
    let templateId: String
    var existingItem: PackTemplateItem? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var weightText: String
    @State private var weightUnit: String
    @State private var quantity: Int
    @State private var category: String
    @State private var consumable: Bool
    @State private var worn: Bool
    @State private var notes: String
    @State private var isSaving = false
    @State private var error: String?

    private var isEditing: Bool { existingItem != nil }
    private let weightUnits = ["g", "kg", "lb", "oz"]

    init(viewModel: PackTemplatesViewModel, templateId: String, existingItem: PackTemplateItem? = nil) {
        self.viewModel = viewModel
        self.templateId = templateId
        self.existingItem = existingItem
        _name = State(initialValue: existingItem?.name ?? "")
        _weightText = State(initialValue: String(format: "%.2f", existingItem?.weight ?? 0))
        _weightUnit = State(initialValue: existingItem?.weightUnit ?? "g")
        _quantity = State(initialValue: existingItem?.quantity ?? 1)
        _category = State(initialValue: existingItem?.category ?? "")
        _consumable = State(initialValue: existingItem?.consumable ?? false)
        _worn = State(initialValue: existingItem?.worn ?? false)
        _notes = State(initialValue: existingItem?.notes ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Item Info") {
                    TextField("Name", text: $name)
                    TextField("Notes (optional)", text: $notes, axis: .vertical)
                        .lineLimit(2...3)
                }
                Section("Weight & Quantity") {
                    LabeledContent("Weight") {
                        HStack {
                        TextField("Weight", text: $weightText)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 80)
                            #if os(iOS)
                            .keyboardType(.decimalPad)
                            #endif
                        Picker("Unit", selection: $weightUnit) {
                            ForEach(weightUnits, id: \.self) { u in Text(u).tag(u) }
                        }
                        .pickerStyle(.segmented)
                        .frame(maxWidth: 180)
                        }
                    }
                    Stepper("Quantity: \(quantity)", value: $quantity, in: 1...99)
                }
                Section {
                    TextField("Category (optional)", text: $category)
                    Toggle("Worn", isOn: $worn)
                    Toggle("Consumable", isOn: $consumable)
                } header: {
                    Text("Details")
                } footer: {
                    Text("Worn and consumable items are excluded from base weight totals.")
                }
                if let error {
                    InlineErrorView(message: error).listRowBackground(Color.clear)
                }
            }
            .navigationTitle(isEditing ? "Edit Item" : "Add Item")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Saving…" : "Save") {
                        Task { await save() }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 360, minHeight: 360)
        #endif
    }

    private func save() async {
        isSaving = true
        error = nil
        defer { isSaving = false }
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        let weight = Double(weightText) ?? 0
        let catOpt = category.trimmingCharacters(in: .whitespaces).isEmpty ? nil : category.trimmingCharacters(in: .whitespaces)
        let notesOpt = notes.trimmingCharacters(in: .whitespaces).isEmpty ? nil : notes.trimmingCharacters(in: .whitespaces)
        do {
            if let item = existingItem {
                try await viewModel.updateItem(
                    inTemplate: templateId, itemId: item.id,
                    name: trimmedName, weight: weight, weightUnit: weightUnit,
                    quantity: quantity, category: catOpt, consumable: consumable, worn: worn, notes: notesOpt
                )
            } else {
                _ = try await viewModel.addItem(
                    toTemplate: templateId, name: trimmedName, weight: weight, weightUnit: weightUnit,
                    quantity: quantity, category: catOpt, consumable: consumable, worn: worn, notes: notesOpt
                )
            }
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
