import SwiftUI

struct AsyncButton<Label: View>: View {
    let action: () async throws -> Void
    @ViewBuilder let label: () -> Label

    @State private var isLoading = false
    @State private var error: String?

    init(action: @escaping () async throws -> Void, @ViewBuilder label: @escaping () -> Label) {
        self.action = action
        self.label = label
    }

    var body: some View {
        Button {
            guard !isLoading else { return }
            isLoading = true
            error = nil
            Task {
                defer { isLoading = false }
                do {
                    try await action()
                } catch {
                    self.error = error.localizedDescription
                }
            }
        } label: {
            if isLoading {
                ProgressView().controlSize(.small)
            } else {
                label()
            }
        }
        .disabled(isLoading)
        .alert("Error", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) {
            Button("OK", role: .cancel) { error = nil }
        } message: {
            Text(error ?? "")
        }
    }
}

extension AsyncButton where Label == Text {
    init(_ title: String, action: @escaping () async throws -> Void) {
        self.init(action: action) { Text(title) }
    }
}
