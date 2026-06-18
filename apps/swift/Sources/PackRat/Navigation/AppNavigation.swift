import SwiftUI

enum NavItem: String, CaseIterable, Identifiable {
    // Order matters: first entries are the primary iPhone tab bar destinations.
    case home, packs, trips, weather, chat
    case catalog, templates, trailConditions, feed
    case guides, gearInventory, wildlife, aiPacks

    var id: String { rawValue }
    var label: String {
        switch self {
        case .home:          return "Home"
        case .packs:         return "Packs"
        case .trips:         return "Trips"
        case .weather:       return "Weather"
        case .chat:          return "Assistant"
        case .catalog:       return "Catalog"
        case .templates:     return "Templates"
        case .trailConditions: return "Trail Conditions"
        case .feed:          return "Feed"
        case .guides:        return "Guides"
        case .gearInventory: return "Gear Inventory"
        case .wildlife:      return "Wildlife"
        case .aiPacks:       return "AI Packs"
        }
    }
    var symbol: String {
        switch self {
        case .home:          return "house"
        case .packs:         return "backpack"
        case .trips:         return "map"
        case .weather:       return "cloud.sun"
        case .chat:          return "bubble.left.and.text.bubble.right"
        case .catalog:       return "magnifyingglass"
        case .templates:     return "doc.on.doc"
        case .trailConditions: return "figure.hiking"
        case .feed:          return "newspaper"
        case .guides:        return "book"
        case .gearInventory: return "shippingbox"
        case .wildlife:      return "pawprint"
        case .aiPacks:       return "sparkles"
        }
    }

    var hasListDetail: Bool {
        switch self {
        case .packs, .trips, .templates, .trailConditions: return true
        default: return false
        }
    }

    var isFeatureEnabled: Bool {
        switch self {
        case .trips: return AppFeatureFlags.enableTrips
        case .templates: return AppFeatureFlags.enablePackTemplates
        case .trailConditions: return AppFeatureFlags.enableTrailConditions
        case .feed: return AppFeatureFlags.enableFeed
        case .wildlife: return AppFeatureFlags.enableWildlifeIdentification
        default: return true
        }
    }
}

#if os(iOS)
private enum PhoneTab: Hashable {
    case home
    case packs
    case trips
    case chat

    init?(navItem: NavItem) {
        switch navItem {
        case .home: self = .home
        case .packs: self = .packs
        case .trips: self = .trips
        case .chat: self = .chat
        default: return nil
        }
    }

    var navItem: NavItem? {
        switch self {
        case .home: return .home
        case .packs: return .packs
        case .trips: return .trips
        case .chat: return .chat
        }
    }
}
#endif

struct AppNavigation: View {
    @Environment(AuthManager.self) private var authManager
    @State private var appState = AppState()

    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var phoneTab: PhoneTab = .home
    @State private var phoneHomePath: [NavItem] = []
    #endif

    var body: some View {
        #if os(iOS)
        if horizontalSizeClass == .compact {
            phoneLayout
        } else {
            splitLayout
        }
        #else
        splitLayout
        #endif
    }

    // MARK: - Mac / iPad: 3-column split

    private var splitLayout: some View {
        @Bindable var state = appState

        return VStack(spacing: 0) {
            OfflineBanner()
            splitNavigation
        }
        .animation(.easeInOut(duration: 0.3), value: NetworkMonitor.shared.isConnected)
        .environment(appState)
        #if os(macOS)
        .navigationSplitViewStyle(.balanced)
        #endif
        .sheet(isPresented: $state.isGlobalSearchPresented) {
            GlobalSearchView()
                .environment(appState)
        }
        .background {
            Button("") { state.isGlobalSearchPresented.toggle() }
                .keyboardShortcut("f", modifiers: .command)
                .frame(width: 0, height: 0)
                .hidden()
        }
        .focusedSceneValue(\.globalSearchAction, $state.isGlobalSearchPresented)
        #if os(iOS)
        .watchCompanionSync(appState)
        #endif
        .accessibilityIdentifier("app_navigation")
    }

    @ViewBuilder
    private var splitNavigation: some View {
        if appState.navItem.hasListDetail {
            NavigationSplitView {
                sidebar
            } content: {
                listColumn
            } detail: {
                detailColumn
            }
        } else {
            NavigationSplitView {
                sidebar
            } detail: {
                primaryColumn
            }
        }
    }

    private var sidebar: some View {
        @Bindable var state = appState
        return List(NavItem.allCases.filter(\.isFeatureEnabled)) { item in
            Button {
                state.navItem = item
            } label: {
                Label(item.label, systemImage: item.symbol)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("nav_\(item.rawValue)")
            .listRowBackground(state.navItem == item ? Color.accentColor.opacity(0.16) : Color.clear)
        }
        .accessibilityIdentifier("app_sidebar")
        .navigationTitle("PackRat")
        #if os(macOS)
        .navigationSplitViewColumnWidth(min: 160, ideal: 190)
        #endif
        .safeAreaInset(edge: .bottom) {
            userFooter
        }
    }

    @ViewBuilder
    private var listColumn: some View {
        @Bindable var state = appState

        switch appState.navItem {
        case .packs:
            PacksListView(viewModel: appState.packsVM, selectedId: $state.selectedPackId)
        case .trips:
            TripsListView(viewModel: appState.tripsVM, selectedId: $state.selectedTripId)
        case .templates:
            PackTemplatesListView(viewModel: appState.templatesVM, selectedId: $state.selectedTemplateId, packsVM: appState.packsVM)
        case .trailConditions:
            TrailConditionsListView(viewModel: appState.trailConditionsVM, selectedId: $state.selectedReportId)
        default:
            EmptyView()
        }
    }

    @ViewBuilder
    private var primaryColumn: some View {
        switch appState.navItem {
        case .home:
            HomeView().environment(appState)
        case .weather:
            WeatherView(viewModel: appState.weatherVM)
        case .catalog:
            CatalogView().environment(appState)
        case .chat:
            ChatView(viewModel: appState.chatVM)
        case .feed:
            FeedView(viewModel: appState.feedVM)
        case .guides:
            GuidesView()
        case .gearInventory:
            GearInventoryView().environment(appState)
        case .wildlife:
            WildlifeView()
        case .aiPacks:
            AIPacksView(viewModel: appState.aiPacksVM, packsVM: appState.packsVM)
        case .packs, .trips, .templates, .trailConditions:
            EmptyView()
        }
    }

    @ViewBuilder
    private var detailColumn: some View {
        switch appState.navItem {
        case .packs:
            if let id = appState.selectedPackId,
               let pack = appState.packsVM.packs.first(where: { $0.id == id }) {
                PackDetailView(pack: pack, viewModel: appState.packsVM)
            } else {
                placeholder("Select a Pack", symbol: "backpack")
            }
        case .trips:
            if let id = appState.selectedTripId,
               let trip = appState.tripsVM.trips.first(where: { $0.id == id }) {
                TripDetailView(trip: trip, viewModel: appState.tripsVM)
            } else {
                placeholder("Select a Trip", symbol: "map")
            }
        case .templates:
            if !authManager.isAuthenticated {
                GuestLimitedView(
                    "Templates Require an Account",
                    subtitle: "Pack templates sync with your account so they can be reused across devices.",
                    systemImage: "doc.on.doc"
                )
            } else if let id = appState.selectedTemplateId,
               let t = appState.templatesVM.templates.first(where: { $0.id == id }) {
                PackTemplateDetailView(template: t, viewModel: appState.templatesVM, packsVM: appState.packsVM)
            } else {
                placeholder("Select a Template", symbol: "doc.on.doc")
            }
        case .trailConditions:
            if !authManager.isAuthenticated {
                GuestLimitedView(
                    "Trail Reports Require an Account",
                    subtitle: "Community trail conditions are shared through your PackRat account.",
                    systemImage: "figure.hiking"
                )
            } else if let id = appState.selectedReportId,
               let report = appState.trailConditionsVM.reports.first(where: { $0.id == id }) {
                TrailConditionDetailView(report: report)
            } else {
                placeholder("Select a Report", symbol: "figure.hiking")
            }
        default:
            Color.clear
        }
    }

    private func placeholder(_ title: String, symbol: String) -> some View {
        UnavailableStateView(title: title, systemImage: symbol)
    }

    // MARK: - iPhone: tab layout

    #if os(iOS)
    private var phoneLayout: some View {
        @Bindable var state = appState

        return TabView(selection: $phoneTab) {
            NavigationStack(path: $phoneHomePath) {
                phoneContentView(.home)
                    .navigationTitle(NavItem.home.label)
                    .navigationDestination(for: NavItem.self) { item in
                        phoneContentView(item)
                            .navigationTitle(item.label)
                    }
            }
            .tabItem { Label(NavItem.home.label, systemImage: NavItem.home.symbol) }
            .tag(PhoneTab.home)

            ForEach(phonePrimaryItems.filter { $0 != .home }) { item in
                NavigationStack {
                    phoneContentView(item)
                        .navigationTitle(item.label)
                }
                .tabItem { Label(item.label, systemImage: item.symbol) }
                .tag(PhoneTab(navItem: item)!)
            }
        }
        .onChange(of: phoneTab) { _, newTab in
            if let item = newTab.navItem {
                state.navItem = item
            }
        }
        .onChange(of: appState.navItem) { _, item in
            if let tab = PhoneTab(navItem: item) {
                phoneTab = tab
                phoneHomePath.removeAll()
            } else {
                phoneTab = .home
                if phoneHomePath.last != item {
                    phoneHomePath = [item]
                }
            }
        }
        .onChange(of: phoneHomePath) { _, path in
            if let item = path.last {
                state.navItem = item
            } else if phoneTab == .home {
                state.navItem = .home
            }
        }
        .environment(appState)
        .sheet(isPresented: $state.isGlobalSearchPresented) {
            GlobalSearchView()
                .environment(appState)
        }
        .focusedSceneValue(\.globalSearchAction, $state.isGlobalSearchPresented)
        .watchCompanionSync(appState)
    }

    private var phonePrimaryItems: [NavItem] {
        [.home, .packs, .trips, .chat].filter(\.isFeatureEnabled)
    }

    @ViewBuilder
    private func phoneContentView(_ item: NavItem) -> some View {
        @Bindable var state = appState
        switch item {
        case .home:            HomeView().environment(appState)
        case .packs:           PacksListView(viewModel: appState.packsVM, selectedId: $state.selectedPackId)
        case .trips:           TripsListView(viewModel: appState.tripsVM, selectedId: $state.selectedTripId)
        case .templates:       PackTemplatesListView(viewModel: appState.templatesVM, selectedId: $state.selectedTemplateId, packsVM: appState.packsVM)
        case .trailConditions: TrailConditionsListView(viewModel: appState.trailConditionsVM, selectedId: $state.selectedReportId)
        case .weather:         WeatherView(viewModel: appState.weatherVM)
        case .catalog:         CatalogView().environment(appState)
        case .chat:            ChatView(viewModel: appState.chatVM)
        case .feed:            FeedView(viewModel: appState.feedVM)
        case .guides:          GuidesView()
        case .gearInventory:   GearInventoryView().environment(appState)
        case .wildlife:        WildlifeView()
        case .aiPacks:         AIPacksView(viewModel: appState.aiPacksVM, packsVM: appState.packsVM)
        }
    }
    #endif

    // MARK: - User Footer

    private var userFooter: some View {
        let displayName = footerDisplayName
        let email = authManager.currentUser?.email ?? ""

        return HStack(spacing: 8) {
            Circle()
                .fill(.tint.opacity(0.12))
                .frame(width: 30, height: 30)
                .overlay {
                    Text(authManager.currentUser?.initials ?? "?")
                        .font(.caption.bold())
                        .foregroundStyle(.tint)
                }
            VStack(alignment: .leading, spacing: 1) {
                if let displayName {
                    Text(displayName)
                        .font(.caption.bold())
                        .lineLimit(1)
                    Text(email)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                } else {
                    Text(email)
                        .font(.caption.bold())
                        .lineLimit(1)
                }
            }
            .help(email)
            Spacer()
            Menu {
                NavigationLink(destination: ProfileView()) {
                    Label("Profile", systemImage: "person.circle")
                }
                Divider()
                Button("Sign Out", role: .destructive) {
                    Task { try? await authManager.logout() }
                }
            } label: {
                Image(systemName: "ellipsis.circle").foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(.bar)
    }

    private var footerDisplayName: String? {
        guard let displayName = authManager.currentUser?.displayName.trimmingCharacters(in: .whitespacesAndNewlines),
              !displayName.isEmpty,
              !displayName.contains("@")
        else { return nil }
        return displayName
    }
}

#if os(iOS)
private extension View {
    func watchCompanionSync(_ appState: AppState) -> some View {
        task {
            WatchCompanionService.shared.activate()
            WatchCompanionService.shared.publishSnapshot(from: appState)
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(15))
                WatchCompanionService.shared.publishSnapshot(from: appState)
            }
        }
        .onChange(of: appState.navItem) { _, _ in
            WatchCompanionService.shared.publishSnapshot(from: appState)
        }
        .onChange(of: appState.selectedPackId) { _, _ in
            WatchCompanionService.shared.publishSnapshot(from: appState)
        }
        .onChange(of: appState.selectedTripId) { _, _ in
            WatchCompanionService.shared.publishSnapshot(from: appState)
        }
    }
}
#endif
