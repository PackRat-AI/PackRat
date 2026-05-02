import SwiftUI

struct PackItemFormView: View {
    let packId: String
    let viewModel: PacksViewModel
    let existingItem: PackItem?

    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var weightText = ""
    @State private var weightUnit = "g"
    @State private var quantityText = "1"
    @State private var category = ""
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
            Form {
                Section("Item") {
                    TextField("Name", text: $name)
                }

                Section("Weight") {
                    HStack {
                        TextField("0", text: $weightText)
                            #if os(iOS)
                            .keyboardType(.decimalPad)
                            #endif
                        Picker("Unit", selection: $weightUnit) {
                            ForEach(AppWeightUnit.allCases, id: \.rawValue) { u in
                                Text(u.label).tag(u.rawValue)
                            }
                        }
                        .labelsHidden()
                        .frame(width: 60)
                    }
                }

                Section("Quantity & Category") {
                    HStack {
                        Text("Quantity")
                        Spacer()
                        TextField("1", text: $quantityText)
                            #if os(iOS)
                            .keyboardType(.numberPad)
                            #endif
                            .multilineTextAlignment(.trailing)
                            .frame(width: 60)
                    }
                    Picker("Category", selection: $category) {
                        Text("None").tag("")
                        ForEach(PackCategory.allCases, id: \.rawValue) { cat in
                            Label(cat.label, systemImage: cat.symbol).tag(cat.rawValue)
                        }
                    }
                    #if os(macOS)
                    .pickerStyle(.menu)
                    #endif
                }

                Section("Flags") {
                    Toggle("Consumable", isOn: $consumable)
                    Toggle("Worn on body", isOn: $worn)
                }

                Section("Notes") {
                    TextField("Optional notes", text: $notes, axis: .vertical)
                        .lineLimit(3, reservesSpace: true)
                }

                if let error {
                    Section {
                        InlineErrorView(message: error)
                    }
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
                    Button(isEditing ? "Save" : "Add") { submit() }
                        .disabled(!isValid || isLoading)
                }
            }
            .onAppear { prefill() }
        }
        #if os(macOS)
        .frame(minWidth: 400, minHeight: 350)
        #endif
    }

    private func prefill() {
        guard let item = existingItem else { return }
        name = item.name
        weightText = item.weight.map { String(format: "%.0f", $0) } ?? ""
        weightUnit = item.weightUnit ?? "g"
        quantityText = item.quantity.map(String.init) ?? "1"
        category = item.category ?? ""
        consumable = item.consumable ?? false
        worn = item.worn ?? false
        notes = item.notes ?? ""
    }

    private func submit() {
        guard isValid, !isLoading else { return }
        isLoading = true
        error = nil
        let weight = Double(weightText)
        let quantity = Int(quantityText) ?? 1
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
                        notes: notes.isEmpty ? nil : notes
                    )
                } else {
                    try await viewModel.addItem(
                        to: packId,
                        name: name, weight: weight,
                        weightUnit: weight != nil ? weightUnit : nil,
                        quantity: quantity,
                        category: category.isEmpty ? nil : category,
                        consumable: consumable, worn: worn,
                        notes: notes.isEmpty ? nil : notes
                    )
                }
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
