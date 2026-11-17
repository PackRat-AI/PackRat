import SwiftUI

// MARK: - Models

struct Guide: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    let content: String?
    /// The API calls this `description`; the UI shows it as the summary.
    let description: String?
    /// Coarse bucket — currently `"general"` for every guide.
    let category: String?
    /// The topic tags the /guides/categories endpoint returns; the topic
    /// filter and the card's topic line read these, not `category`.
    let categories: [String]?
    let author: String?
    let difficulty: String?
    let createdAt: String?
    /// Minutes. Guide frontmatter stores it as either a number or a string.
    var readingTime: Int? = nil
    var updatedAt: String? = nil

    var excerpt: String? { description }
}

extension Guide {
    private enum CodingKeys: String, CodingKey {
        case id, title, content, description, category, categories, author, difficulty
        case createdAt, readingTime, updatedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decode(String.self, forKey: .title)
        content = try c.decodeIfPresent(String.self, forKey: .content)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        category = try c.decodeIfPresent(String.self, forKey: .category)
        categories = try c.decodeIfPresent([String].self, forKey: .categories)
        author = try c.decodeIfPresent(String.self, forKey: .author)
        difficulty = try c.decodeIfPresent(String.self, forKey: .difficulty)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt)
        if let minutes = try? c.decodeIfPresent(Double.self, forKey: .readingTime) {
            readingTime = Int(minutes.rounded())
        } else if let text = try? c.decodeIfPresent(String.self, forKey: .readingTime),
                  let minutes = Double(text) {
            readingTime = Int(minutes.rounded())
        }
    }
}

/// Mirrors `GuidesResponseSchema` (and `GuideSearchResponseSchema`, which adds
/// `query`) in packages/schemas/src/guides.ts.
struct GuidesResponse: Codable, Sendable {
    let items: [Guide]
    let totalCount: Int?
    let page: Int?
    let limit: Int?
    let totalPages: Int?
}

/// Mirrors `GuideCategoriesResponseSchema`: `{ categories, count }`.
struct GuideCategoriesResponse: Codable {
    let categories: [String]
    let count: Int?
}

// MARK: - Service

final class GuidesService: Sendable {
    static let shared = GuidesService()
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    /// Newest first. Errors propagate: a failed fetch must surface as an error
    /// state, not as an empty list indistinguishable from "there are no guides".
    func listGuides(page: Int = 1, limit: Int = 20, category: String? = nil) async throws -> GuidesResponse {
        var query: [String: String] = [
            "page": "\(page)",
            "limit": "\(limit)",
            "sort[field]": "createdAt",
            "sort[order]": "desc",
        ]
        if let category { query["category"] = category }
        return try await api.send(Endpoint(.get, "/api/guides", query: query), as: GuidesResponse.self)
    }

    /// Ranked by the server: title matches first, then summary, then article text.
    func searchGuides(_ text: String, page: Int = 1, limit: Int = 20) async throws -> GuidesResponse {
        let query = ["q": text, "page": "\(page)", "limit": "\(limit)"]
        return try await api.send(Endpoint(.get, "/api/guides/search", query: query), as: GuidesResponse.self)
    }

    func getGuide(_ id: String) async throws -> Guide {
        let endpoint = Endpoint(.get, "/api/guides/\(id)")
        return try await api.send(endpoint)
    }

    func categories() async throws -> [String] {
        let endpoint = Endpoint(.get, "/api/guides/categories")
        return try await api.send(endpoint, as: GuideCategoriesResponse.self).categories
    }
}

// MARK: - Paging

private let guidesPageSize = 20

/// One paged list of guides: the library for a topic, or the results for a
/// search. `key` names what is loaded, so a view reappearing after a pushed
/// guide does not reload it, and a newer load always wins over an older one
/// that answers late.
@Observable
@MainActor
final class GuidePager {
    enum Phase: Equatable { case idle, loading, loaded, failed }

    typealias Fetch = @Sendable (_ page: Int) async throws -> GuidesResponse

    private(set) var items: [Guide] = []
    private(set) var totalCount = 0
    private(set) var phase: Phase = .idle
    private(set) var isLoadingMore = false
    private(set) var loadMoreFailed = false
    private(set) var key: String?

    private var page = 0
    private var totalPages = 0
    private var generation = 0
    private var fetch: Fetch?

    var hasMore: Bool { page < totalPages }

    /// `refreshing` reloads even when `key` is already loaded, and keeps the
    /// current items on screen until the new page arrives.
    func load(key: String, refreshing: Bool = false, fetch: @escaping Fetch) async {
        if !refreshing, key == self.key, phase == .loaded { return }
        generation += 1
        let current = generation
        let keepsItems = refreshing && key == self.key && !items.isEmpty
        self.key = key
        self.fetch = fetch
        isLoadingMore = false
        loadMoreFailed = false
        if !keepsItems {
            items = []
            phase = .loading
        }
        do {
            let response = try await fetch(1)
            guard current == generation else { return }
            apply(response, replacing: true)
            phase = .loaded
        } catch {
            guard current == generation, !keepsItems else { return }
            phase = Task.isCancelled ? .idle : .failed
        }
    }

    func loadMore() async {
        guard phase == .loaded, hasMore, !isLoadingMore, let fetch else { return }
        let current = generation
        isLoadingMore = true
        loadMoreFailed = false
        defer { if current == generation { isLoadingMore = false } }
        do {
            let response = try await fetch(page + 1)
            guard current == generation else { return }
            apply(response, replacing: false)
        } catch {
            guard current == generation, !Task.isCancelled else { return }
            loadMoreFailed = true
        }
    }

    func reset() {
        generation += 1
        items = []
        totalCount = 0
        phase = .idle
        isLoadingMore = false
        loadMoreFailed = false
        key = nil
        page = 0
        totalPages = 0
        fetch = nil
    }

    private func apply(_ response: GuidesResponse, replacing: Bool) {
        if replacing {
            items = response.items
        } else {
            let known = Set(items.map(\.id))
            items += response.items.filter { !known.contains($0.id) }
        }
        page = response.page ?? (replacing ? 1 : page + 1)
        totalPages = response.totalPages ?? page
        totalCount = response.totalCount ?? items.count
    }
}

// MARK: - ViewModel

@Observable
@MainActor
final class GuidesViewModel {
    var categories: [String] = []
    var selectedCategory: String?
    var searchText = ""

    let library = GuidePager()
    let search = GuidePager()

    private let service: GuidesService

    init(service: GuidesService = .shared) { self.service = service }

    var trimmedQuery: String { searchText.trimmingCharacters(in: .whitespacesAndNewlines) }

    /// True from a keystroke until the debounced search for it has started,
    /// so the results area holds its placeholders instead of flashing stale
    /// results or "No Results".
    var isSearchPending: Bool { !trimmedQuery.isEmpty && search.key != trimmedQuery }

    func loadCategories() async {
        if VisualSampleData.isEnabled {
            categories = VisualSampleData.guideCategories
            return
        }
        guard categories.isEmpty, !VisualSampleData.isScreenshotCapture else { return }
        // The topic chips are a convenience; losing them must not blank the
        // list, so their failure stays separate from the guides request.
        categories = (try? await service.categories()) ?? []
    }

    func loadLibrary(refreshing: Bool = false) async {
        let category = selectedCategory
        let service = service
        await library.load(key: category ?? "", refreshing: refreshing) { page in
            if let sample = Self.sampleResponse(page: page, matching: { category == nil || $0.categories?.contains(category ?? "") == true }) {
                return sample
            }
            return try await service.listGuides(page: page, limit: guidesPageSize, category: category)
        }
    }

    /// Debounced: runs from `.task(id: searchText)`, which cancels the wait
    /// when the user keeps typing.
    func searchAfterPause() async {
        guard !trimmedQuery.isEmpty else {
            search.reset()
            return
        }
        try? await Task.sleep(for: .milliseconds(300))
        guard !Task.isCancelled else { return }
        await runSearch()
    }

    func runSearch() async {
        let query = trimmedQuery
        guard !query.isEmpty else { return }
        let service = service
        await search.load(key: query) { page in
            if let sample = Self.sampleResponse(page: page, matching: {
                $0.title.localizedCaseInsensitiveContains(query)
                    || $0.excerpt?.localizedCaseInsensitiveContains(query) == true
            }) {
                return sample
            }
            return try await service.searchGuides(query, page: page, limit: guidesPageSize)
        }
    }

    /// Screenshot and visual-QA runs read fixed guides instead of the API.
    nonisolated private static func sampleResponse(
        page: Int,
        matching include: (Guide) -> Bool
    ) -> GuidesResponse? {
        let items: [Guide]
        if VisualSampleData.isEnabled {
            items = VisualSampleData.guides.filter(include)
        } else if VisualSampleData.isScreenshotCapture {
            items = []
        } else {
            return nil
        }
        return GuidesResponse(items: items, totalCount: items.count, page: page, limit: guidesPageSize, totalPages: 1)
    }
}

// MARK: - Guides List View

struct GuidesView: View {
    @State private var viewModel = GuidesViewModel()
    @State private var isSearching = false
    @Environment(AuthManager.self) private var authManager

    var body: some View {
        Group {
            if authManager.isAuthenticated {
                library
            } else {
                GuestLimitedView(
                    "Sign In to Read Guides",
                    subtitle: "Gear and packing guides written for the trips you are planning. Your packs and trips stay on this device and keep working without an account.",
                    systemImage: "book"
                )
            }
        }
        .navigationTitle("Guides")
    }

    private var library: some View {
        libraryContent
            // Search sits over the library rather than replacing it, so
            // closing search returns to the same topic and scroll position.
            .overlay {
                if isSearching {
                    GuideSearchResultsView(viewModel: viewModel)
                        .background(.background)
                }
            }
            #if os(iOS)
            // Always shown, like the Gear Catalog, so search is never hidden
            // behind a pull-down.
            .searchable(
                text: $viewModel.searchText,
                isPresented: $isSearching,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: "Search guides"
            )
            #else
            .searchable(text: $viewModel.searchText, isPresented: $isSearching, prompt: "Search guides")
            #endif
            .task { await viewModel.loadCategories() }
            .task(id: viewModel.selectedCategory) { await viewModel.loadLibrary() }
            .task(id: viewModel.searchText) { await viewModel.searchAfterPause() }
    }

    /// One List for every phase, with states laid over it: swapping the
    /// scroll view underneath the navigation bar loses its large title.
    private var libraryContent: some View {
        let pager = viewModel.library
        return List {
            // The first row rather than a pinned strip: a pinned strip under
            // a large title renders the title blurred on iOS 26.
            GuideTopicChips(topics: viewModel.categories, selection: $viewModel.selectedCategory)
                .listRowInsets(EdgeInsets())
                .listRowSeparator(.hidden)
            switch pager.phase {
            case .idle, .loading: GuidePlaceholderRows()
            case .loaded: GuideRows(pager: pager)
            case .failed: EmptyView()
            }
        }
        .listStyle(.plain)
        .refreshable { await viewModel.loadLibrary(refreshing: true) }
        .accessibilityIdentifier("guides_list")
        .overlay {
            if pager.phase == .failed {
                GuidesLoadFailedView(title: "Couldn’t Load Guides") {
                    await viewModel.loadLibrary()
                }
            } else if pager.phase == .loaded, pager.items.isEmpty {
                emptyLibrary
            }
        }
    }

    @ViewBuilder
    private var emptyLibrary: some View {
        if let topic = viewModel.selectedCategory {
            ContentUnavailableView {
                Label("No \(GuideTopic.label(for: topic)) Guides Yet", systemImage: "book")
            } actions: {
                Button("Show All Guides") {
                    withAnimation(.snappy) { viewModel.selectedCategory = nil }
                }
            }
        } else {
            ContentUnavailableView(
                "No Guides Yet",
                systemImage: "book",
                description: Text("Check back soon for new guides.")
            )
        }
    }
}

// MARK: - Search

private struct GuideSearchResultsView: View {
    let viewModel: GuidesViewModel

    var body: some View {
        let pager = viewModel.search
        let isWaiting = viewModel.isSearchPending || pager.phase == .loading || pager.phase == .idle
        List {
            if viewModel.trimmedQuery.isEmpty {
                EmptyView()
            } else if isWaiting {
                GuidePlaceholderRows()
            } else if pager.phase == .loaded, !pager.items.isEmpty {
                Section {
                    GuideRows(pager: pager)
                } header: {
                    Text("^[\(pager.totalCount) result](inflect: true)")
                }
            }
        }
        .listStyle(.plain)
        .accessibilityIdentifier("guides_search_results")
        .overlay {
            if viewModel.trimmedQuery.isEmpty {
                ContentUnavailableView(
                    "Search Guides",
                    systemImage: "magnifyingglass",
                    description: Text("Search by topic, gear or destination.")
                )
            } else if isWaiting {
                EmptyView()
            } else if pager.phase == .failed {
                GuidesLoadFailedView(title: "Couldn’t Load Guides") {
                    await viewModel.runSearch()
                }
            } else if pager.items.isEmpty {
                ContentUnavailableView {
                    Label("No Results for “\(viewModel.trimmedQuery)”", systemImage: "magnifyingglass")
                } description: {
                    Text("Try another word, or browse by topic.")
                }
            }
        }
    }
}

// MARK: - Shared list pieces

/// The guide rows of a pager, then a footer that loads the next page as the
/// user nears the end, or offers to retry it in place if it failed.
private struct GuideRows: View {
    let pager: GuidePager

    var body: some View {
        ForEach(pager.items) { guide in
            // A destination link, not `NavigationLink(value:)`: the iPhone
            // Home stack binds a typed `[NavItem]` path, which cannot hold a Guide.
            NavigationLink {
                GuideDetailView(guide: guide)
            } label: {
                GuideRowView(guide: guide)
            }
            .accessibilityIdentifier("guide_row_\(guide.id)")
            .task {
                if guide.id == pager.items.last?.id { await pager.loadMore() }
            }
        }

        if pager.isLoadingMore {
            ProgressView()
                .frame(maxWidth: .infinity)
                .listRowSeparator(.hidden)
        } else if pager.loadMoreFailed {
            VStack(spacing: 6) {
                Text("Couldn’t load more guides.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Button("Try Again") { Task { await pager.loadMore() } }
                    .font(.footnote.weight(.semibold))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .listRowSeparator(.hidden)
        }
    }
}

/// Placeholder rows in the same shape as real ones, so nothing moves when the
/// first page arrives.
private struct GuidePlaceholderRows: View {
    var body: some View {
        ForEach(GuideRowView.placeholders) { guide in
            GuideRowView(guide: guide)
        }
        .redacted(reason: .placeholder)
        .disabled(true)
        .accessibilityHidden(true)
    }
}

struct GuidesLoadFailedView: View {
    let title: String
    let retry: () async -> Void

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: "wifi.exclamationmark")
        } description: {
            Text("Check your connection and try again.")
        } actions: {
            Button("Try Again") { Task { await retry() } }
                .buttonStyle(.bordered)
        }
    }
}
