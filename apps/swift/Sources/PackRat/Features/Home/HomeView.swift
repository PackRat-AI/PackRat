import SwiftUI

struct HomeView: View {
    @Environment(AppState.self) private var appState
    @Environment(AuthManager.self) private var authManager
    @State private var showingSeasonSuggestions = false
    @State private var showingShoppingList = false

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12: return "Good morning"
        case 12..<17: return "Good afternoon"
        default: return "Good evening"
        }
    }

    private var firstName: String {
        authManager.currentUser?.displayName.components(separatedBy: " ").first ?? ""
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                headerSection
                statsRow
                tilesGrid
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
        }
        .navigationTitle("Home")
        .sheet(isPresented: $showingSeasonSuggestions) {
            SeasonSuggestionsView()
        }
        .sheet(isPresented: $showingShoppingList) {
            NavigationStack {
                ShoppingListView()
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(firstName.isEmpty ? greeting : "\(greeting), \(firstName)")
                .font(.title2.bold())
            Text("Here's your outdoor dashboard")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(.top, 8)
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
        HStack(spacing: 6) {
            Image(systemName: symbol)
                .font(.caption)
                .foregroundStyle(Color.accentColor)
            Text(value)
                .font(.subheadline.bold())
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.fill.secondary, in: Capsule())
    }

    // MARK: - Tiles Grid

    private var tilesGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
            HomeTileCard(
                title: "My Packs",
                subtitle: appState.packsVM.packs.isEmpty ? "No packs yet" : "\(appState.packsVM.packs.count) pack\(appState.packsVM.packs.count == 1 ? "" : "s")",
                symbol: "backpack.fill",
                color: .blue
            ) { appState.navItem = .packs }

            HomeTileCard(
                title: "Trips",
                subtitle: upcomingTripsSubtitle,
                symbol: "map.fill",
                color: .green
            ) { appState.navItem = .trips }

            HomeTileCard(
                title: "Weather",
                subtitle: "Forecasts & alerts",
                symbol: "cloud.sun.fill",
                color: .cyan
            ) { appState.navItem = .weather }

            HomeTileCard(
                title: "AI Assistant",
                subtitle: "Ask about gear & trips",
                symbol: "bubble.left",
                color: .purple
            ) { appState.navItem = .chat }

            HomeTileCard(
                title: "Gear Inventory",
                subtitle: inventorySubtitle,
                symbol: "shippingbox.fill",
                color: .orange
            ) { appState.navItem = .gearInventory }

            HomeTileCard(
                title: "Season Suggestions",
                subtitle: "AI-powered packing tips",
                symbol: "leaf.fill",
                color: .mint
            ) { showingSeasonSuggestions = true }

            HomeTileCard(
                title: "Pack Templates",
                subtitle: "\(appState.templatesVM.templates.count) template\(appState.templatesVM.templates.count == 1 ? "" : "s")",
                symbol: "doc.on.doc.fill",
                color: .indigo
            ) { appState.navItem = .templates }

            HomeTileCard(
                title: "Guides",
                subtitle: "Gear & packing articles",
                symbol: "book.fill",
                color: .brown
            ) { appState.navItem = .guides }

            HomeTileCard(
                title: "Catalog",
                subtitle: "Browse gear database",
                symbol: "magnifyingglass",
                color: .gray
            ) { appState.navItem = .catalog }

            HomeTileCard(
                title: "Community Feed",
                subtitle: "Posts & trip reports",
                symbol: "newspaper.fill",
                color: .teal
            ) { appState.navItem = .feed }

            HomeTileCard(
                title: "Trail Conditions",
                subtitle: "Community reports",
                symbol: "figure.hiking",
                color: .red
            ) { appState.navItem = .trailConditions }

            HomeTileCard(
                title: "Shopping List",
                subtitle: "Gear wishlist",
                symbol: "cart.fill",
                color: .pink
            ) { showingShoppingList = true }

            HomeTileCard(
                title: "Wildlife ID",
                subtitle: "Identify animals & plants",
                symbol: "pawprint.fill",
                color: Color(red: 0.5, green: 0.3, blue: 0.1)
            ) { appState.navItem = .wildlife }
        }
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

struct HomeTileCard: View {
    let title: String
    let subtitle: String
    let symbol: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 10) {
                Circle()
                    .fill(color.opacity(0.15))
                    .frame(width: 44, height: 44)
                    .overlay {
                        Image(systemName: symbol)
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(color)
                    }

                Spacer()

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.subheadline.bold())
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .frame(minHeight: 120)
            .background(.background.secondary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(.separator.opacity(0.5), lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(accessibilityID)
    }

    private var accessibilityID: String {
        let slug = title
            .lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
            .joined(separator: "_")
        return "home_tile_\(slug)"
    }
}
