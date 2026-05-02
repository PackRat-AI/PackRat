import SwiftUI

enum NavItem: String, CaseIterable, Identifiable {
    case packs, trips, weather, catalog, chat, feed

    var id: String { rawValue }
    var label: String { rawValue.capitalized }
    var symbol: String {
        switch self {
        case .packs:   "backpack"
        case .trips:   "map"
        case .weather: "cloud.sun"
        case .catalog: "magnifyingglass"
        case .chat:    "bubble.left.and.bubble.right"
        case .feed:    "newspaper"
        }
    }
}

struct AppNavigation: View {
    @Environment(AuthManager.self) private var authManager
    @State private var selection: NavItem? = .packs

    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    #endif

    var body: some View {
        #if os(iOS)
        if horizontalSizeClass == .compact {
            tabLayout
        } else {
            sidebarLayout
        }
        #else
        sidebarLayout
        #endif
    }

    private var sidebarLayout: some View {
        NavigationSplitView {
            List(NavItem.allCases, selection: $selection) { item in
                Label(item.label, systemImage: item.symbol)
                    .tag(item)
            }
            .navigationTitle("PackRat")
            #if os(macOS)
            .navigationSplitViewColumnWidth(min: 180, ideal: 200)
            #endif
            Divider()
            userFooter
        } detail: {
            detailView(for: selection ?? .packs)
        }
    }

    #if os(iOS)
    private var tabLayout: some View {
        TabView {
            ForEach(NavItem.allCases) { item in
                NavigationStack {
                    detailView(for: item)
                        .navigationTitle(item.label)
                }
                .tabItem { Label(item.label, systemImage: item.symbol) }
                .tag(item)
            }
        }
    }
    #endif

    @ViewBuilder
    private func detailView(for item: NavItem) -> some View {
        switch item {
        case .packs:   PacksListView()
        case .trips:   TripsListView()
        case .weather: WeatherView()
        case .catalog: CatalogView()
        case .chat:    ChatView()
        case .feed:    FeedView()
        }
    }

    private var userFooter: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(.tint.opacity(0.15))
                .overlay {
                    Text(authManager.currentUser?.initials ?? "?")
                        .font(.caption.bold())
                        .foregroundStyle(.tint)
                }
                .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 1) {
                Text(authManager.currentUser?.displayName ?? "")
                    .font(.caption.bold())
                    .lineLimit(1)
                Text(authManager.currentUser?.email ?? "")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Menu {
                Button("Sign Out", role: .destructive) {
                    Task { try? await authManager.logout() }
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }
}
