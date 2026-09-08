import Foundation
import Observation

@Observable
final class CatalogViewModel {
    var items: [CatalogItem] = []
    var searchText = ""
    var isLoading = false
    /// Paging state, kept separate from `isLoading` so the footer spinner can be
    /// shown for a page fetch without the whole list being replaced by the
    /// full-screen "Searching gear…" state.
    var isLoadingMore = false
    var error: String?
    var hasSearched = false
    var currentPage = 1
    /// False once a page comes back short, so scrolling to the bottom stops
    /// asking for pages the server has already run out of.
    var hasMore = true

    /// One page as requested from `CatalogService.search`. Anything shorter than
    /// this means the server has no more rows to give.
    private static let pageSize = 20

    private let service: any CatalogBrowsing
    private var searchTask: Task<Void, Never>?

    init(service: any CatalogBrowsing = CatalogService.shared) {
        self.service = service
    }

    func onSearchTextChanged() {
        searchTask?.cancel()
        guard searchText.count >= 2 else {
            if searchText.isEmpty { items = []; hasSearched = false }
            return
        }
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            await search(reset: true)
        }
    }

    func search(reset: Bool = false) async {
        if VisualSampleData.isEnabled || VisualSampleData.isUITestFixturesEnabled {
            if reset { currentPage = 1; hasMore = false }
            isLoading = false
            error = nil
            items = VisualSampleData.catalogItems(matching: searchText)
            hasSearched = true
            return
        }
        if VisualSampleData.isScreenshotCapture && !VisualSampleData.isEnabled {
            if reset { currentPage = 1; hasMore = false }
            isLoading = false
            error = nil
            items = []
            hasSearched = !searchText.isEmpty
            return
        }

        if reset {
            currentPage = 1
            hasMore = true
        }
        // A page fetch shows the list footer; a fresh search replaces the list.
        // Sharing one flag made the second page blank the results.
        if reset { isLoading = true } else { isLoadingMore = true }
        error = nil
        defer {
            isLoading = false
            isLoadingMore = false
        }
        do {
            let results = try await service.search(query: searchText, page: currentPage, limit: Self.pageSize)
            if reset {
                items = results
            } else {
                items.append(contentsOf: results)
            }
            // A short page is the last page. Without this the footer spinner
            // stays visible forever and every bounce at the bottom refetches.
            hasMore = results.count >= Self.pageSize
            hasSearched = true
        } catch {
            self.error = error.localizedDescription
            // Don't strand the user mid-list: a failed page can be retried by
            // scrolling again, but a failed first page owns the error state.
            if !reset { currentPage -= 1 }
        }
    }

    func loadMore() async {
        guard !VisualSampleData.isScreenshotCapture else { return }
        guard !isLoading, !isLoadingMore, hasMore, !searchText.isEmpty else { return }
        currentPage += 1
        await search(reset: false)
    }
}
