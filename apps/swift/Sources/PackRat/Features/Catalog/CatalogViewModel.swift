import Foundation
import Observation

@Observable
final class CatalogViewModel {
    var items: [CatalogItem] = []
    var searchText = ""
    var isLoading = false
    var error: String?
    var hasSearched = false
    var currentPage = 1

    private let service: CatalogService
    private var searchTask: Task<Void, Never>?

    init(service: CatalogService = .shared) {
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
        if VisualSampleData.isEnabled && !items.isEmpty {
            isLoading = false
            error = nil
            hasSearched = true
            return
        }
        if VisualSampleData.isScreenshotCapture && !VisualSampleData.isEnabled {
            if reset { currentPage = 1 }
            isLoading = false
            error = nil
            items = []
            hasSearched = !searchText.isEmpty
            return
        }

        if reset { currentPage = 1 }
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let results = try await service.search(query: searchText, page: currentPage)
            if reset {
                items = results
            } else {
                items.append(contentsOf: results)
            }
            hasSearched = true
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadMore() async {
        guard !VisualSampleData.isScreenshotCapture else { return }
        guard !isLoading, !searchText.isEmpty else { return }
        currentPage += 1
        await search(reset: false)
    }
}
