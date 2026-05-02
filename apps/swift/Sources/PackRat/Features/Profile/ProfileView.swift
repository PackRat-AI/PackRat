import SwiftUI
import NukeUI

struct ProfileView: View {
    @Environment(AuthManager.self) private var authManager
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var isSaving = false
    @State private var saveError: String?
    @State private var saveSuccess = false
    @State private var showingSignOutAlert = false
    @State private var showingAvatarPicker = false
    @State private var isUploadingAvatar = false

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                avatarSection
                    .padding(.top, 8)

                Form {
                    Section("Account Info") {
                        LabeledContent("Email") {
                            Text(authManager.currentUser?.email ?? "")
                                .foregroundStyle(.secondary)
                        }
                        TextField("First Name", text: $firstName)
                        TextField("Last Name", text: $lastName)
                    }

                    Section("Role") {
                        LabeledContent("Account Type") {
                            Text(authManager.currentUser?.role?.capitalized ?? "User")
                                .foregroundStyle(.secondary)
                        }
                        LabeledContent("Member Since") {
                            if let date = authManager.currentUser?.createdAt?.toDate() {
                                Text(date.formatted(date: .abbreviated, time: .omitted))
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    if let error = saveError {
                        Section { InlineErrorView(message: error) }
                    }

                    if saveSuccess {
                        Section {
                            Label("Profile updated", systemImage: "checkmark.circle.fill")
                                .foregroundStyle(.green)
                        }
                    }

                    Section {
                        Button {
                            save()
                        } label: {
                            if isSaving {
                                HStack {
                                    ProgressView().controlSize(.small)
                                    Text("Saving…")
                                }
                            } else {
                                Text("Save Changes")
                            }
                        }
                        .disabled(isSaving || !hasChanges)
                    }

                    Section {
                        Button("Sign Out", role: .destructive) {
                            showingSignOutAlert = true
                        }
                    }
                }
                .formStyle(.grouped)
                #if os(macOS)
                .frame(maxWidth: 500)
                #endif
            }
            .padding()
        }
        .navigationTitle("Profile")
        .onAppear { prefill() }
        .alert("Sign Out", isPresented: $showingSignOutAlert) {
            Button("Sign Out", role: .destructive) {
                Task { try? await authManager.logout() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Are you sure you want to sign out?")
        }
    }

    // MARK: - Avatar

    private var avatarSection: some View {
        ZStack(alignment: .bottomTrailing) {
            if let url = authManager.currentUser?.avatarUrl {
                LazyImage(url: URL(string: url)) { state in
                    if let image = state.image {
                        image.resizable().scaledToFill()
                    } else {
                        initialsCircle
                    }
                }
                .frame(width: 80, height: 80)
                .clipShape(Circle())
            } else {
                initialsCircle
            }

            if isUploadingAvatar {
                ProgressView()
                    .controlSize(.small)
                    .padding(6)
                    .background(.regularMaterial, in: Circle())
                    .offset(x: 4, y: 4)
            } else {
                Button {
                    showingAvatarPicker = true
                } label: {
                    Image(systemName: "pencil.circle.fill")
                        .font(.title3)
                        .foregroundStyle(.tint)
                        .background(Circle().fill(.background))
                }
                .buttonStyle(.plain)
                .offset(x: 4, y: 4)
            }
        }
        #if os(macOS)
        .fileImporter(
            isPresented: $showingAvatarPicker,
            allowedContentTypes: [.image],
            allowsMultipleSelection: false
        ) { result in
            guard let url = try? result.get().first else { return }
            Task { await uploadAvatar(url: url) }
        }
        #endif
    }

    private var initialsCircle: some View {
        Circle()
            .fill(.tint.opacity(0.15))
            .frame(width: 80, height: 80)
            .overlay {
                Text(authManager.currentUser?.initials ?? "?")
                    .font(.title.bold())
                    .foregroundStyle(.tint)
            }
    }

    // MARK: - Helpers

    private var hasChanges: Bool {
        firstName != (authManager.currentUser?.firstName ?? "")
        || lastName != (authManager.currentUser?.lastName ?? "")
    }

    private func prefill() {
        firstName = authManager.currentUser?.firstName ?? ""
        lastName = authManager.currentUser?.lastName ?? ""
    }

    private func save() {
        isSaving = true
        saveError = nil
        saveSuccess = false
        Task {
            defer { isSaving = false }
            do {
                struct UpdateBody: Encodable { let firstName: String; let lastName: String }
                let endpoint = Endpoint(.put, "/api/user/profile",
                                       body: UpdateBody(firstName: firstName, lastName: lastName))
                try await APIClient.shared.sendDiscarding(endpoint)
                try await authManager.refreshProfile()
                saveSuccess = true
                Task {
                    try? await Task.sleep(for: .seconds(3))
                    saveSuccess = false
                }
            } catch {
                saveError = error.localizedDescription
            }
        }
    }

    #if os(macOS)
    private func uploadAvatar(url: URL) async {
        isUploadingAvatar = true
        defer { isUploadingAvatar = false }
        do {
            let avatarUrl = try await UploadService.shared.uploadImage(at: url)
            struct AvatarBody: Encodable { let avatarUrl: String }
            let endpoint = Endpoint(.put, "/api/user/profile", body: AvatarBody(avatarUrl: avatarUrl))
            try await APIClient.shared.sendDiscarding(endpoint)
            try await authManager.refreshProfile()
        } catch { }
    }
    #endif
}
