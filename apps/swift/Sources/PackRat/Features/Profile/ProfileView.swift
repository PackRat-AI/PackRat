import SwiftUI
import NukeUI
import UserNotifications

struct ProfileView: View {
    @Environment(AuthManager.self) private var authManager
    @Environment(\.openURL) private var openURL
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var isSaving = false
    @State private var saveError: String?
    @State private var saveSuccess = false
    @State private var showingSignOutAlert = false
    @State private var showingDeleteAccountAlert = false
    @State private var showingAvatarPicker = false
    @State private var isUploadingAvatar = false
    @State private var isDeletingAccount = false
    @State private var notificationsEnabled = false
    @State private var notificationAuthStatus: UNAuthorizationStatus = .notDetermined

    var body: some View {
        Group {
            if authManager.isAuthenticated {
                authenticatedProfile
            } else {
                guestProfile
            }
        }
        .navigationTitle("Profile")
        .onAppear {
            prefill()
            Task { await refreshNotificationStatus() }
        }
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

            notificationSection
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

            notificationSection

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

    private var notificationSection: some View {
        Section("Notifications") {
            if notificationAuthStatus == .denied {
                HStack {
                    Image(systemName: "bell.slash.fill").foregroundStyle(.secondary)
                    Text("Notifications are blocked in Settings")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                    Spacer()
                    #if os(iOS)
                    Button("Open Settings") {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            openURL(url)
                        }
                    }
                    .font(.callout)
                    #endif
                }
            } else {
                Toggle("Push Notifications", isOn: $notificationsEnabled)
                    .onChange(of: notificationsEnabled) { _, enabled in
                        Task { await toggleNotifications(enabled) }
                    }
            }
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

    private func refreshNotificationStatus() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        notificationAuthStatus = settings.authorizationStatus
        notificationsEnabled = settings.authorizationStatus == .authorized
    }

    private func toggleNotifications(_ enable: Bool) async {
        let center = UNUserNotificationCenter.current()
        if enable {
            let status = await center.notificationSettings().authorizationStatus
            if status == .notDetermined {
                _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
            }
        }
        await refreshNotificationStatus()
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
