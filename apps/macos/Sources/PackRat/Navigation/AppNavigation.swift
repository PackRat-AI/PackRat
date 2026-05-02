import SwiftUI

enum NavItem: String, CaseIterable, Identifiable {
    case packs, trips, templates, weather, catalog, chat, trailConditions, feed

    var id: String { rawValue }
    var label: String {
        switch self {
        case .trailConditions: return "Trail Conditions"
        default: return rawValue.capitalized
        }
    }
    var symbol: String {
        switch self {
        case .packs:           return "backpack"
        case .trips:           return "map"
        case .templates:       return "doc.on.doc"
        case .weather:         return "cloud.sun"
        case .catalog:         return "magnifyingglass"
        case .chat:            return "bubble.left.and.bubble.right"
        case .trailConditions: return "figure.hiking"
        case .feed:            return "newspaper"
        }
    }

    var hasListDetail: Bool {
        switch self {
        case .packs, .trips, .templates, .trailConditions: return true
        default: return false
        }
    }
}

struct AppNavigation: View {
    @Environment(AuthManager.self) private var authManager
    @State private var appState = AppState()

    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
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
            NavigationSplitView {
                sidebar
            } content: {
                contentColumn
            } detail: {
                detailColumn
            }
        }
        .animation(.easeInOut(duration: 0.3), value: NetworkMonitor.shared.isConnected)
        .environment(appState)
        #if os(macOS)
        .navigationSplitViewStyle(.balanced)
        #endif
    }

    private var sidebar: some View {
        @Bindable var state = appState

        return List(NavItem.allCases, selection: $state.navItem) { item in
            Label(item.label, systemImage: item.symbol).tag(item)
        }
        .navigationTitle("PackRat")
        #if os(macOS)
        .navigationSplitViewColumnWidth(min: 160, ideal: 190)
        #endif
        .safeAreaInset(edge: .bottom) {
            userFooter
        }
    }

    @ViewBuilder
    private var contentColumn: some View {
        @Bindable var state = appState

        switch appState.navItem {
        case .packs:
            PacksListView(viewModel: appState.packsVM, selectedId: $state.selectedPackId)
        case .trips:
            TripsListView(viewModel: appState.tripsVM, selectedId: $state.selectedTripId)
        case .templates:
            PackTemplatesListView(viewModel: appState.templatesVM, selectedId: $state.selectedTemplateId)
        case .trailConditions:
            TrailConditionsListView(viewModel: appState.trailConditionsVM, selectedId: $state.selectedReportId)
        case .weather:
            WeatherView(viewModel: appState.weatherVM)
        case .catalog:
            CatalogView().environment(appState)
        case .chat:
            ChatView(viewModel: appState.chatVM)
        case .feed:
            FeedView(viewModel: appState.feedVM)
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
            if let id = appState.selectedTemplateId,
               let template = appState.templatesVM.templates.first(where: { $0.id == id }) {
                PackTemplateDetailView(template: template, viewModel: appState.templatesVM, packsVM: appState.packsVM)
            } else {
                placeholder("Select a Template", symbol: "doc.on.doc")
            }
        case .trailConditions:
            if let id = appState.selectedReportId,
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
        ContentUnavailableView(title, systemImage: symbol)
    }

    // MARK: - iPhone: tab layout

    #if os(iOS)
    private var phoneLayout: some View {
        TabView {
            ForEach(NavItem.allCases) { item in
                NavigationStack {
                    phoneContentView(item)
                        .navigationTitle(item.label)
                }
                .tabItem { Label(item.label, systemImage: item.symbol) }
            }
        }
        .environment(appState)
    }

    @ViewBuilder
    private func phoneContentView(_ item: NavItem) -> some View {
        @Bindable var state = appState
        switch item {
        case .packs:           PacksListView(viewModel: appState.packsVM, selectedId: $state.selectedPackId)
        case .trips:           TripsListView(viewModel: appState.tripsVM, selectedId: $state.selectedTripId)
        case .templates:       PackTemplatesListView(viewModel: appState.templatesVM, selectedId: $state.selectedTemplateId)
        case .trailConditions: TrailConditionsListView(viewModel: appState.trailConditionsVM, selectedId: $state.selectedReportId)
        case .weather:         WeatherView(viewModel: appState.weatherVM)
        case .catalog:         CatalogView().environment(appState)
        case .chat:            ChatView(viewModel: appState.chatVM)
        case .feed:            FeedView(viewModel: appState.feedVM)
        }
    }
    #endif

    // MARK: - User Footer

    private var userFooter: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(.tint.opacity(0.12))
                .frame(width: 30, height: 30)
                .overlay {
                    Text(authManager.currentUser?.initials ?? "?")
                        .font(.caption.bold())
                        .foregroundStyle(.tint)
                }
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
}
