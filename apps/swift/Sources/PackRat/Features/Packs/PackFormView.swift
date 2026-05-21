import SwiftUI

struct PackFormView: View {
    let viewModel: PacksViewModel
    let existingPack: Pack?

    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var description = ""
    @State private var category = ""
    @State private var isPublic = false
    @State private var isLoading = false
    @State private var error: String?

    private var isEditing: Bool { existingPack != nil }
    private var isValid: Bool { !name.trimmingCharacters(in: .whitespaces).isEmpty }

    init(viewModel: PacksViewModel, existingPack: Pack? = nil) {
        self.viewModel = viewModel
        self.existingPack = existingPack
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Pack Name", text: $name)
                    TextField("Description (optional)", text: $description, axis: .vertical)
                        .lineLimit(3, reservesSpace: true)
                }

                Section("Category") {
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

                Section("Visibility") {
                    Toggle("Share publicly", isOn: $isPublic)
                }

                if let error {
                    Section {
                        InlineErrorView(message: error)
                    }
                }
            }
            .navigationTitle(isEditing ? "Edit Pack" : "New Pack")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "Save" : "Create") { submit() }
                        .disabled(!isValid || isLoading)
                }
            }
            .onAppear { prefill() }
        }
        #if os(macOS)
        .frame(minWidth: 400, minHeight: 300)
        #endif
    }

    private func prefill() {
        guard let pack = existingPack else { return }
        name = pack.name
        description = pack.description ?? ""
        category = pack.category?.rawValue ?? ""
        isPublic = pack.isPublic
    }

    private func submit() {
        guard isValid, !isLoading else { return }
        isLoading = true
        error = nil
        Task {
            defer { isLoading = false }
            do {
                if let pack = existingPack {
                    try await viewModel.updatePack(
                        pack.id,
                        name: name.trimmingCharacters(in: .whitespaces),
                        description: description.isEmpty ? nil : description,
                        category: category.isEmpty ? nil : category,
                        isPublic: isPublic
                    )
                } else {
                    try await viewModel.createPack(
                        name: name.trimmingCharacters(in: .whitespaces),
                        description: description.isEmpty ? nil : description,
                        category: category.isEmpty ? nil : category,
                        isPublic: isPublic
                    )
                }
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
