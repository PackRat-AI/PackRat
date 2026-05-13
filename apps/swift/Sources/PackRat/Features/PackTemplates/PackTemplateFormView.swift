import SwiftUI

private let templateCategories = [
    "hiking", "backpacking", "camping", "climbing",
    "winter", "desert", "custom", "water sports", "skiing",
]

struct PackTemplateFormView: View {
    let viewModel: PackTemplatesViewModel
    var existingTemplate: PackTemplate? = nil
    var onSave: ((PackTemplate) -> Void)? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var description: String
    @State private var category: String
    @State private var isSaving = false
    @State private var error: String?

    private var isEditing: Bool { existingTemplate != nil }

    init(viewModel: PackTemplatesViewModel, existingTemplate: PackTemplate? = nil, onSave: ((PackTemplate) -> Void)? = nil) {
        self.viewModel = viewModel
        self.existingTemplate = existingTemplate
        self.onSave = onSave
        _name = State(initialValue: existingTemplate?.name ?? "")
        _description = State(initialValue: existingTemplate?.description ?? "")
        _category = State(initialValue: existingTemplate?.category ?? "custom")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Template Info") {
                    TextField("Name", text: $name)
                        .accessibilityIdentifier("template_name")
                    TextField("Description (optional)", text: $description, axis: .vertical)
                        .lineLimit(2...4)
                }
                Section("Category") {
                    Picker("Category", selection: $category) {
                        ForEach(templateCategories, id: \.self) { cat in
                            Text(cat.capitalized).tag(cat)
                        }
                    }
                    .pickerStyle(.menu)
                }
                if let error {
                    InlineErrorView(message: error).listRowBackground(Color.clear)
                }
            }
            .navigationTitle(isEditing ? "Edit Template" : "New Template")
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
        .frame(minWidth: 360, minHeight: 280)
        #endif
    }

    private func save() async {
        isSaving = true
        error = nil
        defer { isSaving = false }
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        let trimmedDesc = description.trimmingCharacters(in: .whitespaces)
        let desc = trimmedDesc.isEmpty ? nil : trimmedDesc
        do {
            let saved: PackTemplate
            if let existing = existingTemplate {
                saved = try await viewModel.updateTemplate(existing.id, name: trimmedName, description: desc, category: category)
            } else {
                saved = try await viewModel.createTemplate(name: trimmedName, description: desc, category: category)
            }
            onSave?(saved)
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
