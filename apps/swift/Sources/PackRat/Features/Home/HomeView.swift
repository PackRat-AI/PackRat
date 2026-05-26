import SwiftUI

struct HomeView: View {
    @Environment(AppState.self) private var appState
    @Environment(AuthManager.self) private var authManager
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var showingSeasonSuggestions = false
    @State private var showingShoppingList = false
    @State private var homeSearchText = ""

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12: return "Good morning"
        case 12..<17: return "Good afternoon"
        default: return "Good evening"
        }
    }

    private var firstName: String {
        guard let firstName = authManager.currentUser?.firstName?.trimmingCharacters(in: .whitespacesAndNewlines),
              !firstName.isEmpty,
              !firstName.contains("@")
        else { return "" }
        return firstName
    }

    @ViewBuilder
    var body: some View {
        if horizontalSizeClass == .compact {
            compactBody
        } else {
            regularBody
        }
    }

    private var compactBody: some View {
        List {
            Section {
                headerSection
                    .listRowInsets(EdgeInsets(top: 10, leading: 16, bottom: 10, trailing: 16))
            }
            .listRowBackground(Color.clear)

            Section {
                summarySection
                    .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
            }
            .listRowBackground(Color.clear)

            ForEach(filteredActionGroups) { group in
                Section(group.title) {
                    ForEach(group.actions) { action in
                        HomeActionRow(action: action)
                    }
                }
            }
        }
        .platformGroupedListStyle()
        .scrollContentBackground(.hidden)
        .navigationTitle("Home")
        .searchable(text: $homeSearchText, prompt: "Search PackRat")
        .overlay {
            if !homeSearchText.isEmpty && filteredActionGroups.allSatisfy(\.actions.isEmpty) {
                ContentUnavailableView.search(text: homeSearchText)
            }
        }
        .homeSheets(showingSeasonSuggestions: $showingSeasonSuggestions, showingShoppingList: $showingShoppingList)
    }

    private var regularBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                headerSection
                summarySection
                actionsSection
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .navigationTitle("Home")
        .searchable(text: $homeSearchText, prompt: "Search PackRat")
        .homeSheets(showingSeasonSuggestions: $showingSeasonSuggestions, showingShoppingList: $showingShoppingList)
    }

    // MARK: - Header

    private var headerSection: some View {
        HStack(alignment: .center, spacing: 12) {
            ZStack {
                Circle()
                    .fill(.tint.opacity(0.12))

                if authManager.currentUser == nil {
                    Image(systemName: "person.crop.circle.fill")
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(.tint)
                        .symbolRenderingMode(.hierarchical)
                } else {
                    Text(authManager.currentUser?.initials ?? "?")
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(.tint)
                }
            }
            .frame(width: 44, height: 44)

            VStack(alignment: .leading, spacing: 4) {
                Text(firstName.isEmpty ? greeting : "\(greeting), \(firstName)")
                    .font(.title2.bold())
                    .accessibilityIdentifier("home_greeting")
                Text("Here's your outdoor dashboard")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 0)
        }
        .padding(.top, 8)
    }

    // MARK: - Summary

    private var summarySection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                ZStack {
                    Circle()
                        .fill(Color.accentColor.opacity(0.14))
                        .frame(width: 52, height: 52)

                    Image(systemName: summarySymbol)
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundStyle(Color.accentColor)
                }

                VStack(alignment: .leading, spacing: 5) {
                    Text(summaryTitle)
                        .font(.headline)
                        .foregroundStyle(.primary)
                    Text(summarySubtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: 0)
            }

            statsRow

            HStack(spacing: 10) {
                SummaryActionButton(title: primarySummaryActionTitle, symbol: primarySummaryActionSymbol, isProminent: true) {
                    appState.navItem = primarySummaryDestination
                }

                SummaryActionButton(title: "Search", symbol: "magnifyingglass") {
                    appState.isGlobalSearchPresented = true
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(.regularMaterial)
        }
        .overlay {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(.separator.opacity(0.35), lineWidth: 0.5)
        }
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var summarySymbol: String {
        if appState.packsVM.packs.isEmpty { return "backpack" }
        if appState.tripsVM.trips.isEmpty { return "map" }
        return "checkmark.seal.fill"
    }

    private var summaryTitle: String {
        if appState.packsVM.packs.isEmpty { return "Start with a pack" }
        if appState.tripsVM.trips.isEmpty { return "Plan the next route" }
        return "Ready for the trail"
    }

    private var summarySubtitle: String {
        if appState.packsVM.packs.isEmpty {
            return "Create a packing list, add gear, and keep the essentials close."
        }
        if appState.tripsVM.trips.isEmpty {
            return "Turn your gear into a trip plan with weather, conditions, and notes."
        }
        return "Your packs, trips, and trail context are organized in one place."
    }

    private var primarySummaryActionTitle: String {
        if appState.packsVM.packs.isEmpty { return "Start Pack" }
        if appState.tripsVM.trips.isEmpty { return "Trips" }
        return "Open Packs"
    }

    private var primarySummaryActionSymbol: String {
        if appState.packsVM.packs.isEmpty { return "plus" }
        if appState.tripsVM.trips.isEmpty { return "map" }
        return "backpack.fill"
    }

    private var primarySummaryDestination: NavItem {
        if appState.tripsVM.trips.isEmpty && !appState.packsVM.packs.isEmpty { return .trips }
        return .packs
    }

    // MARK: - Stats Row

    private var statsRow: some View {
        HStack(spacing: 12) {
            statChip(
                value: "\(appState.packsVM.packs.count)",
                label: appState.packsVM.packs.count == 1 ? "Pack" : "Packs",
                symbol: "backpack.fill"
            )
            statChip(
                value: "\(appState.tripsVM.trips.count)",
                label: appState.tripsVM.trips.count == 1 ? "Trip" : "Trips",
                symbol: "map.fill"
            )
            let totalItems = appState.packsVM.packs.flatMap { $0.activeItems }.count
            statChip(
                value: "\(totalItems)",
                label: totalItems == 1 ? "Item" : "Items",
                symbol: "archivebox.fill"
            )
        }
    }

    private func statChip(value: String, label: String, symbol: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Image(systemName: symbol)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.accentColor)

            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(value)
                    .font(.headline.weight(.semibold))
                Text(label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    // MARK: - Actions

    @ViewBuilder
    private var actionsSection: some View {
        if horizontalSizeClass == .compact {
            VStack(alignment: .leading, spacing: 18) {
                ForEach(filteredActionGroups) { group in
                    HomeActionSection(title: group.title, actions: group.actions)
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 18) {
                ForEach(filteredActionGroups) { group in
                    HomeActionSection(title: group.title, actions: group.actions)
                }
            }
        }
    }

    private var actionGroups: [HomeActionGroup] {
        [
            HomeActionGroup(title: "Plan", actions: Array(homeActions.prefix(4))),
            HomeActionGroup(title: "Organize", actions: Array(homeActions.dropFirst(4).prefix(4))),
            HomeActionGroup(title: "Explore", actions: Array(homeActions.dropFirst(8))),
        ]
    }

    private var filteredActionGroups: [HomeActionGroup] {
        let query = homeSearchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return actionGroups }

        return actionGroups.compactMap { group in
            let actions = group.actions.filter { action in
                action.title.lowercased().contains(query)
                    || action.subtitle.lowercased().contains(query)
            }
            return actions.isEmpty ? nil : HomeActionGroup(title: group.title, actions: actions)
        }
    }

    private var homeActions: [HomeAction] {
        [
            HomeAction(
                title: "My Packs",
                subtitle: appState.packsVM.packs.isEmpty ? "No packs yet" : "\(appState.packsVM.packs.count) pack\(appState.packsVM.packs.count == 1 ? "" : "s")",
                symbol: "backpack.fill",
                color: .blue
            ) { appState.navItem = .packs },
            HomeAction(title: "Trips", subtitle: upcomingTripsSubtitle, symbol: "map.fill", color: .green) { appState.navItem = .trips },
            HomeAction(title: "Weather", subtitle: "Forecasts & alerts", symbol: "cloud.sun.fill", color: .cyan) { appState.navItem = .weather },
            HomeAction(title: "AI Assistant", subtitle: "Ask about gear & trips", symbol: "bubble.left.and.text.bubble.right", color: .purple) { appState.navItem = .chat },
            HomeAction(title: "Gear Inventory", subtitle: inventorySubtitle, symbol: "shippingbox.fill", color: .orange) { appState.navItem = .gearInventory },
            HomeAction(title: "Season Suggestions", subtitle: "AI-powered packing tips", symbol: "leaf.fill", color: .mint) { showingSeasonSuggestions = true },
            HomeAction(
                title: "Pack Templates",
                subtitle: "\(appState.templatesVM.templates.count) template\(appState.templatesVM.templates.count == 1 ? "" : "s")",
                symbol: "doc.on.doc.fill",
                color: .indigo
            ) { appState.navItem = .templates },
            HomeAction(title: "Guides", subtitle: "Gear & packing articles", symbol: "book.fill", color: .brown) { appState.navItem = .guides },
            HomeAction(title: "Catalog", subtitle: "Browse gear database", symbol: "magnifyingglass", color: .gray) { appState.navItem = .catalog },
            HomeAction(title: "Community Feed", subtitle: "Posts & trip reports", symbol: "newspaper.fill", color: .teal) { appState.navItem = .feed },
            HomeAction(title: "Trail Conditions", subtitle: "Community reports", symbol: "figure.hiking", color: .red) { appState.navItem = .trailConditions },
            HomeAction(title: "Shopping List", subtitle: "Gear wishlist", symbol: "cart.fill", color: .pink) { showingShoppingList = true },
            HomeAction(title: "Wildlife ID", subtitle: "Identify animals & plants", symbol: "pawprint.fill", color: Color(red: 0.5, green: 0.3, blue: 0.1)) {
                appState.navItem = .wildlife
            },
        ]
    }

    private var upcomingTripsSubtitle: String {
        let upcoming = appState.tripsVM.trips.filter { trip in
            guard let startStr = trip.startDate, let date = startStr.toDate() else { return false }
            return date > Date()
        }
        if upcoming.isEmpty { return "No upcoming trips" }
        return "\(upcoming.count) upcoming"
    }

    private var inventorySubtitle: String {
        let count = appState.packsVM.packs.flatMap { $0.activeItems }.count
        return count == 0 ? "No items yet" : "\(count) item\(count == 1 ? "" : "s")"
    }
}

// MARK: - Tile Card

struct HomeActionGroup: Identifiable {
    let title: String
    let actions: [HomeAction]

    var id: String { title }
}

struct HomeAction: Identifiable {
    let title: String
    let subtitle: String
    let symbol: String
    let color: Color
    let action: () -> Void

    var id: String { title }
}

private struct SummaryActionButton: View {
    let title: String
    let symbol: String
    var isProminent = false
    let action: () -> Void

    var body: some View {
        if isProminent {
            buttonLabel
                .buttonStyle(.borderedProminent)
        } else {
            buttonLabel
                .buttonStyle(.bordered)
        }
    }

    private var buttonLabel: some View {
        Button(action: action) {
            Label(title, systemImage: symbol)
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
        }
        .controlSize(.regular)
    }
}

private struct HomeActionSection: View {
    let title: String
    let actions: [HomeAction]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
                .padding(.horizontal, 2)

            VStack(spacing: 0) {
                ForEach(Array(actions.enumerated()), id: \.element.id) { index, action in
                    HomeActionRow(action: action)
                    if index < actions.count - 1 {
                        Divider()
                            .padding(.leading, 56)
                    }
                }
            }
            .background(.background.secondary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(.separator.opacity(0.45), lineWidth: 0.5)
            )
        }
    }
}

private struct HomeActionRow: View {
    let action: HomeAction

    var body: some View {
        Button(action: action.action) {
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .fill(action.color.gradient)
                    .frame(width: 28, height: 28)
                    .overlay {
                        Image(systemName: action.symbol)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.white)
                            .symbolRenderingMode(.hierarchical)
                    }

                VStack(alignment: .leading, spacing: 2) {
                    Text(action.title)
                        .font(.body)
                        .foregroundStyle(.primary)
                    Text(action.subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer(minLength: 8)

                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .contentShape(Rectangle())
            .padding(.horizontal, 12)
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("home_action_\(action.title.accessibilityIdentifierFragment)")
    }
}

private extension String {
    var accessibilityIdentifierFragment: String {
        lowercased()
            .filter { $0.isLetter || $0.isNumber }
    }
}

private extension View {
    @ViewBuilder
    func platformGroupedListStyle() -> some View {
        #if os(iOS)
        self.listStyle(.insetGrouped)
        #else
        self.listStyle(.inset)
        #endif
    }

    func homeSheets(
        showingSeasonSuggestions: Binding<Bool>,
        showingShoppingList: Binding<Bool>
    ) -> some View {
        self
            .sheet(isPresented: showingSeasonSuggestions) {
                SeasonSuggestionsView()
            }
            .sheet(isPresented: showingShoppingList) {
                NavigationStack {
                    ShoppingListView()
                }
            }
    }
}
