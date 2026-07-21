import SwiftUI
import NukeUI
import PhotosUI

struct ProfileView: View {
    @Environment(AuthManager.self) private var authManager
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var isSaving = false
    @State private var saveError: String?
    @State private var saveSuccess = false
    @State private var showingSignOutAlert = false
    @State private var showingDeleteAccountAlert = false
    @State private var avatarPhotoItem: PhotosPickerItem?
    @State private var isUploadingAvatar = false
    @State private var isDeletingAccount = false
    #if os(macOS)
    @State private var showingAvatarPicker = false
    #endif

    var body: some View {
        Group {
            if authManager.isAuthenticated {
                authenticatedProfile
            } else {
                guestProfile
            }
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
        .alert("Delete Account", isPresented: $showingDeleteAccountAlert) {
            Button("Delete Account", role: .destructive) {
                Task { await deleteAccount() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will permanently delete your account and all your data, including packs, trips, and templates. This action cannot be undone.")
        }
    }

    private var authenticatedProfile: some View {
        profileForm
    }

    private var guestProfile: some View {
        Form {
            Section {
                HStack(spacing: 12) {
                    Image(systemName: "person.crop.circle")
                        .font(.title2)
                        .foregroundStyle(.tint)
                        .frame(width: 40, height: 40)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Guest Mode")
                            .font(.headline)
                        Text("Local packs and trips stay on this device.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }

            Section {
                Button {
                    authManager.signOut()
                } label: {
                    Label("Sign In or Create Account", systemImage: "person.badge.key")
                }
            } footer: {
                Text("An account unlocks sync, social features, AI tools, templates, and profile settings.")
            }
        }
        .packRatFormStyle()
    }

    private var profileForm: some View {
        Form {
            Section {
                HStack {
                    Spacer()
                    avatarSection
                    Spacer()
                }
                .padding(.vertical, 8)
            }
            .listRowBackground(Color.clear)

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
                Button("Delete Account", role: .destructive) {
                    showingDeleteAccountAlert = true
                }
                .disabled(isDeletingAccount)
            }
        }
        .packRatFormStyle()
        #if os(macOS)
        .frame(maxWidth: 500)
        #endif
    }

    // MARK: - Avatar

    private var avatarSection: some View {
        ZStack(alignment: .bottomTrailing) {
            if let imageURL = APIClient.resolvedImageURL(authManager.currentUser?.avatarUrl) {
                LazyImage(url: imageURL) { state in
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
                #if os(iOS)
                PhotosPicker(selection: $avatarPhotoItem, matching: .images) {
                    Image(systemName: "pencil.circle.fill")
                        .font(.title3)
                        .foregroundStyle(.tint)
                        .background(Circle().fill(.background))
                }
                .offset(x: 4, y: 4)
                #else
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
                #endif
            }
        }
        #if os(iOS)
        .onChange(of: avatarPhotoItem) { _, item in
            guard let item else { return }
            Task {
                defer { avatarPhotoItem = nil }
                guard let data = try? await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: data) else { return }
                await uploadAvatar(image: image)
            }
        }
        #endif
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

    private func deleteAccount() async {
        isDeletingAccount = true
        defer { isDeletingAccount = false }
        do {
            let endpoint = Endpoint(.delete, "/api/auth")
            try await APIClient.shared.sendDiscarding(endpoint)
            try? await authManager.logout()
        } catch {
            saveError = error.localizedDescription
        }
    }

    private func uploadAvatar(avatarUrl: String) async {
        isUploadingAvatar = true
        defer { isUploadingAvatar = false }
        do {
            struct AvatarBody: Encodable { let avatarUrl: String }
            let endpoint = Endpoint(.put, "/api/user/profile", body: AvatarBody(avatarUrl: avatarUrl))
            try await APIClient.shared.sendDiscarding(endpoint)
            try await authManager.refreshProfile()
        } catch { }
    }

    #if os(macOS)
    private func uploadAvatar(url: URL) async {
        guard let publicUrl = try? await UploadService.shared.uploadImage(at: url) else { return }
        await uploadAvatar(avatarUrl: publicUrl)
    }
    #endif

    #if os(iOS)
    private func uploadAvatar(image: UIImage) async {
        guard let publicUrl = try? await UploadService.shared.uploadUIImage(image) else { return }
        await uploadAvatar(avatarUrl: publicUrl)
    }
    #endif
}
