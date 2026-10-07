import SwiftUI

struct FeedView: View {
    let viewModel: FeedViewModel
    @Environment(AuthManager.self) private var authManager
    @State private var showingCompose = false

    var body: some View {
        Group {
            if !authManager.isAuthenticated {
                GuestLimitedView(
                    "Sign In to Join the Feed",
                    subtitle: "See what other people are packing and carrying, and post your own. Your packs and trips stay on this device and keep working without an account.",
                    systemImage: "person.2"
                )
            } else if viewModel.isLoading && viewModel.posts.isEmpty {
                ProgressView("Loading feed…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.error, viewModel.posts.isEmpty {
                ErrorView(error, retry: { await viewModel.load(refresh: true) })
            } else if viewModel.posts.isEmpty {
                EmptyStateView(
                    "No Posts Yet",
                    subtitle: "Share photos from the trail and tag the people you hiked with.",
                    systemImage: "photo.on.rectangle.angled",
                    actionLabel: "Write a Post",
                    action: { showingCompose = true }
                )
            } else {
                PostList(viewModel: viewModel)
            }
        }
        .navigationTitle("Community Feed")
        .toolbar {
            if authManager.isAuthenticated {
                ToolbarItem(placement: overflowPlacement) {
                    FeedLibraryMenu(feed: viewModel)
                }
            }
            ToolbarItem(placement: .primaryAction) {
                Button("New Post", systemImage: "square.and.pencil") {
                    showingCompose = true
                }
                .disabled(!authManager.isAuthenticated)
                .keyboardShortcut("n", modifiers: .command)
                .accessibilityIdentifier("feed_new_post_button")
            }
        }
        .task { if authManager.isAuthenticated && viewModel.posts.isEmpty { await viewModel.load() } }
        .refreshable { if authManager.isAuthenticated { await viewModel.load(refresh: true) } }
        .sheet(isPresented: $showingCompose) {
            ComposePostView(viewModel: viewModel)
        }
        .feedAlerts(viewModel)
    }

    private var overflowPlacement: ToolbarItemPlacement {
        #if os(iOS)
        .topBarTrailing
        #else
        .primaryAction
        #endif
    }
}

/// A scrolling column of post cards with infinite paging.
struct PostList: View {
    let viewModel: FeedViewModel

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                ForEach(viewModel.posts) { post in
                    PostCard(post: post, viewModel: viewModel)
                        .padding(.horizontal)
                        .frame(maxWidth: 640)
                }
                if viewModel.hasMore {
                    ProgressView()
                        .padding(.bottom)
                        .task { await viewModel.loadMore() }
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
        }
        .accessibilityIdentifier("feed_post_list")
    }
}

/// Saved posts, posts I'm tagged in, and feed settings.
private struct FeedLibraryMenu: View {
    let feed: FeedViewModel

    var body: some View {
        Menu {
            NavigationLink {
                ScopedPostListView(scope: .saved, feed: feed)
            } label: {
                Label("Saved", systemImage: "bookmark")
            }
            .accessibilityIdentifier("feed_saved_link")

            NavigationLink {
                ScopedPostListView(scope: .tagged, feed: feed)
            } label: {
                Label("Tagged in", systemImage: "person.crop.square")
            }
            .accessibilityIdentifier("feed_tagged_link")

            Divider()

            NavigationLink {
                FeedSettingsView()
            } label: {
                Label("Feed Settings", systemImage: "gearshape")
            }
            .accessibilityIdentifier("feed_settings_link")
        } label: {
            Label("More", systemImage: "ellipsis.circle")
        }
        .accessibilityLabel("More")
        .accessibilityIdentifier("feed_more_menu_button")
    }
}

/// Saved posts or posts I'm tagged in. Changes made here are mirrored into
/// the community feed.
struct ScopedPostListView: View {
    let scope: FeedScope
    @State private var viewModel: FeedViewModel

    init(scope: FeedScope, feed: FeedViewModel) {
        self.scope = scope
        let model = FeedViewModel(scope: scope)
        model.linked = feed
        _viewModel = State(initialValue: model)
    }

    private var title: String { scope == .saved ? "Saved" : "Tagged in" }

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.posts.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.error, viewModel.posts.isEmpty {
                ErrorView(error, retry: { await viewModel.load(refresh: true) })
            } else if viewModel.posts.isEmpty {
                if scope == .saved {
                    EmptyStateView(
                        "Nothing Saved Yet",
                        subtitle: "Tap the bookmark on any post to keep it here. Only you can see what you save.",
                        systemImage: "bookmark",
                        accessibilityIdentifier: "feed_saved_empty"
                    )
                } else {
                    EmptyStateView(
                        "No Tags Yet",
                        subtitle: "When someone tags you in a post, it shows up here.",
                        systemImage: "person.crop.square",
                        accessibilityIdentifier: "feed_tagged_empty"
                    )
                }
            } else {
                PostList(viewModel: viewModel)
            }
        }
        .navigationTitle(title)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .task { if viewModel.posts.isEmpty { await viewModel.load() } }
        .refreshable { await viewModel.load(refresh: true) }
        .feedAlerts(viewModel)
        .accessibilityIdentifier(scope == .saved ? "feed_saved_screen" : "feed_tagged_screen")
    }
}
