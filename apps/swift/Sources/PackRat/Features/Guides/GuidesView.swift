import SwiftUI
import MarkdownUI

// MARK: - Models

struct Guide: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let content: String?
    let excerpt: String?
    let category: String?
    let imageUrl: String?
    let createdAt: String?
}

struct GuidesResponse: Codable {
    let guides: [Guide]?
    let data: [Guide]?
    let total: Int?

    var items: [Guide] { guides ?? data ?? [] }
}

// MARK: - Service

final class GuidesService: Sendable {
    static let shared = GuidesService()
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    func listGuides(page: Int = 1, limit: Int = 20, category: String? = nil) async throws -> [Guide] {
        var query: [String: String] = ["page": "\(page)", "limit": "\(limit)"]
        if let cat = category { query["category"] = cat }
        let endpoint = Endpoint(.get, "/api/guides", query: query)
        if let wrapped = try? await api.send(endpoint, as: GuidesResponse.self) {
            return wrapped.items
        }
        return try await api.send(endpoint)
    }

    func getGuide(_ id: String) async throws -> Guide {
        let endpoint = Endpoint(.get, "/api/guides/\(id)")
        return try await api.send(endpoint)
    }

    func categories() async throws -> [String] {
        let endpoint = Endpoint(.get, "/api/guides/categories")
        if let arr = try? await api.send(endpoint, as: [String].self) { return arr }
        return []
    }
}

// MARK: - ViewModel

@Observable
@MainActor
final class GuidesViewModel {
    var guides: [Guide] = []
    var categories: [String] = []
    var isLoading = false
    var error: String?
    var searchText = ""
    var selectedCategory: String?

    private let service = GuidesService.shared

    var filteredGuides: [Guide] {
        var result = guides
        if let cat = selectedCategory { result = result.filter { $0.category == cat } }
        if !searchText.isEmpty {
            result = result.filter {
                $0.title.localizedCaseInsensitiveContains(searchText) ||
                ($0.excerpt?.localizedCaseInsensitiveContains(searchText) == true)
            }
        }
        return result
    }

    func load() async {
        if VisualSampleData.isEnabled {
            isLoading = false
            error = nil
            guides = VisualSampleData.guides
            categories = VisualSampleData.guideCategories
            return
        }

        if VisualSampleData.isScreenshotCapture {
            isLoading = false
            error = nil
            guides = []
            categories = []
            return
        }

        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            async let g = service.listGuides()
            async let c = service.categories()
            (guides, categories) = try await (g, c)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadMore() async {
        guard !isLoading else { return }
        let nextPage = (guides.count / 20) + 1
        do {
            let more = try await service.listGuides(page: nextPage, category: selectedCategory)
            if !more.isEmpty { guides.append(contentsOf: more) }
        } catch { }
    }
}

// MARK: - Guides List View

struct GuidesView: View {
    @State private var viewModel = GuidesViewModel()
    @State private var selectedGuide: Guide?
    @Environment(AuthManager.self) private var authManager

    var body: some View {
        Group {
            if !authManager.isAuthenticated {
                GuestLimitedView(
                    "Guides Require an Account",
                    subtitle: "Guides sync with your PackRat account when you are online.",
                    systemImage: "book"
                )
            } else if viewModel.isLoading && viewModel.guides.isEmpty {
                ProgressView("Loading guides…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.error, viewModel.guides.isEmpty {
                ErrorView(error, retry: { await viewModel.load() })
            } else if viewModel.filteredGuides.isEmpty && !viewModel.searchText.isEmpty {
                ContentUnavailableView.search(text: viewModel.searchText)
            } else if viewModel.filteredGuides.isEmpty {
                EmptyStateView(
                    "No Guides",
                    subtitle: viewModel.selectedCategory != nil ? "No guides in this category" : "Guides will appear here",
                    systemImage: "book"
                )
            } else {
                guideList
            }
        }
        .navigationTitle("Guides")
        .searchable(text: $viewModel.searchText, prompt: "Search guides")
        .task { if authManager.isAuthenticated { await viewModel.load() } }
        .refreshable { if authManager.isAuthenticated { await viewModel.load() } }
        .sheet(item: $selectedGuide) { guide in
            NavigationStack { GuideDetailView(guide: guide) }
        }
    }

    private var categoryBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                categoryChip(nil, label: "All")
                ForEach(viewModel.categories, id: \.self) { cat in
                    categoryChip(cat, label: cat.capitalized)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .background(.bar)
    }

    private func categoryChip(_ cat: String?, label: String) -> some View {
        let selected = viewModel.selectedCategory == cat
        return Button {
            withAnimation(.spring(duration: 0.2)) { viewModel.selectedCategory = cat }
        } label: {
            Text(label)
                .font(.caption.bold())
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(selected ? Color.accentColor : Color.accentColor.opacity(0.1), in: Capsule())
                .foregroundStyle(selected ? .white : Color.accentColor)
        }
        .buttonStyle(.plain)
    }

    private var guideList: some View {
        List {
            if !viewModel.categories.isEmpty {
                Section {
                    categoryBar
                        .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))
                        .listRowSeparator(.hidden)
                }
            }

            ForEach(viewModel.filteredGuides) { guide in
                Button { selectedGuide = guide } label: { GuideRowView(guide: guide) }
                    .buttonStyle(.plain)
                    .task {
                        if guide.id == viewModel.filteredGuides.last?.id { await viewModel.loadMore() }
                    }
            }
        }
    }
}

private struct GuideRowView: View {
    let guide: Guide

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(guide.title)
                    .font(.headline)
                    .lineLimit(2)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            if let excerpt = guide.excerpt {
                Text(excerpt)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            if let cat = guide.category {
                Label(cat.capitalized, systemImage: "tag")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Guide Detail View

struct GuideDetailView: View {
    let guide: Guide
    @State private var fullGuide: Guide?
    @State private var isLoading = false
    @Environment(\.dismiss) private var dismiss

    private var displayGuide: Guide { fullGuide ?? guide }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let cat = displayGuide.category {
                    Label(cat.capitalized, systemImage: "tag")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal)
                }
                if let content = displayGuide.content {
                    Markdown(content)
                        .markdownTheme(.gitHub)
                        .padding(.horizontal)
                } else if isLoading {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                } else if let excerpt = displayGuide.excerpt {
                    Text(excerpt)
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal)
                }
            }
            .padding(.bottom, 24)
        }
        .navigationTitle(displayGuide.title)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.large)
        #endif
        .task {
            guard guide.content == nil else { return }
            isLoading = true
            defer { isLoading = false }
            fullGuide = try? await GuidesService.shared.getGuide(guide.id)
        }
    }
}
