import SwiftUI

/// Who can tag me, which feed notifications I get, and who I've blocked.
struct FeedSettingsView: View {
    @State private var settings: SocialSettings?
    @State private var blocked: [PostAuthor] = []
    @State private var loadError: String?
    @State private var isLoading = false
    @State private var alert: FeedAlert?

    private let service = FeedService.shared

    var body: some View {
        Group {
            if let settings {
                form(settings)
            } else if let loadError {
                ErrorView(loadError, retry: { await load() })
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle("Feed Settings")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .task { if settings == nil { await load() } }
        .alert(
            alert?.title ?? "",
            isPresented: Binding(get: { alert != nil }, set: { if !$0 { alert = nil } }),
            presenting: alert
        ) { _ in
            Button("OK", role: .cancel) { alert = nil }
        } message: { alert in
            Text(alert.message)
        }
        .accessibilityIdentifier("feed_settings_screen")
    }

    private func form(_ current: SocialSettings) -> some View {
        Form {
            Section {
                Picker("Who Can Tag You", selection: binding(\.allowTagging, current)) {
                    Text("Anyone").tag(true)
                    Text("No One").tag(false)
                }
                .accessibilityIdentifier("feed_settings_allow_tagging")
            } header: {
                Text("Tagging")
            } footer: {
                Text(current.allowTagging
                     ? "Anyone can tag or mention you in posts and comments."
                     : "No one can tag you, and mentions of your name won't link to you.")
            }

            Section {
                Toggle("Tags and Mentions", isOn: binding(\.notifyTags, current))
                    .accessibilityIdentifier("feed_settings_notify_tags")
                Toggle("Comments on Your Posts", isOn: binding(\.notifyComments, current))
                    .accessibilityIdentifier("feed_settings_notify_comments")
                Toggle("Replies to Your Comments", isOn: binding(\.notifyReplies, current))
                    .accessibilityIdentifier("feed_settings_notify_replies")
            } header: {
                Text("Notifications")
            } footer: {
                Text("Choose which feed activity sends you a notification.")
            }

            Section {
                NavigationLink {
                    BlockedPeopleView(people: $blocked)
                } label: {
                    LabeledContent("Blocked People") {
                        Text(blocked.isEmpty ? "None" : "\(blocked.count)")
                            .monospacedDigit()
                    }
                }
                .accessibilityIdentifier("feed_settings_blocked_link")
            } footer: {
                Text("Blocked people can't see your posts or comments, and you won't see theirs.")
            }
        }
        .packRatFormStyle()
    }

    /// Writes through to the server on change; snaps back if the save fails.
    private func binding(_ keyPath: WritableKeyPath<SocialSettings, Bool>, _ current: SocialSettings) -> Binding<Bool> {
        Binding(
            get: { settings?[keyPath: keyPath] ?? current[keyPath: keyPath] },
            set: { newValue in
                guard var updated = settings else { return }
                let previous = updated
                updated[keyPath: keyPath] = newValue
                settings = updated
                Task { await save(keyPath, newValue, revertTo: previous) }
            }
        )
    }

    private func save(_ keyPath: WritableKeyPath<SocialSettings, Bool>, _ value: Bool, revertTo previous: SocialSettings) async {
        var changes = UpdateSocialSettingsRequest()
        switch keyPath {
        case \SocialSettings.allowTagging: changes.allowTagging = value
        case \SocialSettings.notifyTags: changes.notifyTags = value
        case \SocialSettings.notifyComments: changes.notifyComments = value
        case \SocialSettings.notifyReplies: changes.notifyReplies = value
        default: return
        }
        do {
            settings = try await service.updateSocialSettings(changes)
        } catch {
            settings = previous
            alert = .failure("Couldn't Save Setting", error)
        }
    }

    private func load() async {
        isLoading = true
        loadError = nil
        defer { isLoading = false }
        do {
            async let loadedSettings = service.socialSettings()
            async let loadedBlocked = service.blockedPeople()
            let (s, b) = try await (loadedSettings, loadedBlocked)
            settings = s
            blocked = b
        } catch {
            loadError = error.localizedDescription
        }
    }
}

struct BlockedPeopleView: View {
    @Binding var people: [PostAuthor]
    @State private var pendingUnblock: PostAuthor?
    @State private var unblocking: Set<String> = []
    @State private var alert: FeedAlert?

    private let service = FeedService.shared

    var body: some View {
        Group {
            if people.isEmpty {
                EmptyStateView(
                    "No One Blocked",
                    subtitle: "People you block from a post, comment or notification show up here.",
                    systemImage: "hand.raised",
                    accessibilityIdentifier: "feed_blocked_empty"
                )
            } else {
                List {
                    ForEach(people) { person in
                        HStack(spacing: 12) {
                            AvatarView(url: person.avatarUrl, fallbackText: person.initials, size: 36)
                            Text(person.displayName)
                            Spacer()
                            if unblocking.contains(person.id) {
                                ProgressView().controlSize(.small)
                            } else {
                                Button("Unblock") { pendingUnblock = person }
                                    .buttonStyle(.bordered)
                                    .controlSize(.small)
                                    .accessibilityIdentifier("feed_unblock_\(person.id)")
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Blocked People")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .confirmationDialog(
            "Unblock \(pendingUnblock?.displayName ?? "")?",
            isPresented: Binding(get: { pendingUnblock != nil }, set: { if !$0 { pendingUnblock = nil } }),
            titleVisibility: .visible,
            presenting: pendingUnblock
        ) { person in
            Button("Unblock") { Task { await unblock(person) } }
                .accessibilityIdentifier("feed_confirm_unblock")
        } message: { _ in
            Text("You'll see each other's posts and comments again, and you can tag each other.")
        }
        .alert(
            alert?.title ?? "",
            isPresented: Binding(get: { alert != nil }, set: { if !$0 { alert = nil } }),
            presenting: alert
        ) { _ in
            Button("OK", role: .cancel) { alert = nil }
        } message: { alert in
            Text(alert.message)
        }
        .accessibilityIdentifier("feed_blocked_screen")
    }

    private func unblock(_ person: PostAuthor) async {
        unblocking.insert(person.id)
        defer { unblocking.remove(person.id) }
        do {
            try await service.unblock(userId: person.id)
            withAnimation { people.removeAll { $0.id == person.id } }
        } catch {
            alert = .failure("Couldn't Unblock \(person.displayName)", error)
        }
    }
}
