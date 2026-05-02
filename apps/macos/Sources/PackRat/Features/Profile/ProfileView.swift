import SwiftUI

struct ProfileView: View {
    @Environment(AuthManager.self) private var authManager
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var isSaving = false
    @State private var saveError: String?
    @State private var showingSignOutAlert = false

    var body: some View {
        Form {
            Section("Account") {
                LabeledContent("Email") {
                    Text(authManager.currentUser?.email ?? "")
                        .foregroundStyle(.secondary)
                }
                TextField("First Name", text: $firstName)
                TextField("Last Name", text: $lastName)
            }

            if let error = saveError {
                Section {
                    InlineErrorView(message: error)
                }
            }

            Section {
                Button("Save Changes") { save() }
                    .disabled(isSaving)
            }

            Section {
                Button("Sign Out", role: .destructive) {
                    showingSignOutAlert = true
                }
            }
        }
        .navigationTitle("Profile")
        .onAppear {
            firstName = authManager.currentUser?.firstName ?? ""
            lastName = authManager.currentUser?.lastName ?? ""
        }
        .alert("Sign Out", isPresented: $showingSignOutAlert) {
            Button("Sign Out", role: .destructive) {
                Task { try? await authManager.logout() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Are you sure you want to sign out?")
        }
    }

    private func save() {
        isSaving = true
        saveError = nil
        Task {
            defer { isSaving = false }
            do {
                struct UpdateBody: Encodable { let firstName: String; let lastName: String }
                let endpoint = Endpoint(.put, "/api/user/profile", body: UpdateBody(firstName: firstName, lastName: lastName))
                try await APIClient.shared.sendDiscarding(endpoint)
                try await authManager.refreshProfile()
            } catch {
                saveError = error.localizedDescription
            }
        }
    }
}
