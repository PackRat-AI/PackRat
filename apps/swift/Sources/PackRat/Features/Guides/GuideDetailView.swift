import MarkdownUI
import SwiftUI

private let relatedGuideCount = 3
/// Caps the text column on iPad and Mac: long lines are hard to track back from.
private let readingWidth: CGFloat = 680

struct GuideDetailView: View {
    let guide: Guide

    @State private var fullGuide: Guide?
    @State private var related: [Guide] = []
    @State private var failed = false

    private let service = GuidesService.shared

    var body: some View {
        Group {
            if failed {
                GuidesLoadFailedView(title: "Couldn’t Load This Guide") { await load() }
            } else {
                article(fullGuide ?? guide)
            }
        }
        // The title is the first thing on the page, so the bar stays a plain
        // back bar on iPhone; the Mac window keeps it as its title.
        #if os(iOS)
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        #else
        .navigationTitle(guide.title)
        #endif
        .task(id: guide.id) {
            guard fullGuide == nil else { return }
            await load()
        }
    }

    private func article(_ guide: Guide) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header(guide)
                Divider().padding(.vertical, 24)
                articleBody(guide)
                if !related.isEmpty { relatedGuides }
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 40)
            .frame(maxWidth: readingWidth, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
    }

    @ViewBuilder
    private func header(_ guide: Guide) -> some View {
        // Some guides tag their difficulty as a topic too ("advanced"), so
        // de-duplicate by label.
        let tags = ((guide.categories ?? []).map(GuideTopic.label(for:)) + [guide.difficulty].compactMap { $0 })
            .reduce(into: [String]()) { if !$0.contains($1) { $0.append($1) } }
        if !tags.isEmpty {
            FlowLayout(tags) { tag in
                Text(tag)
                    .font(.caption.weight(.medium))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Color.accentColor.opacity(0.12), in: Capsule())
                    .foregroundStyle(Color.accentColor)
            }
            .padding(.bottom, 12)
        }

        Text(guide.title)
            .font(.largeTitle.bold())
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader)

        if let byline = bylineWithDate(guide) {
            Text(byline)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .padding(.top, 8)
        }

        if let summary = guide.excerpt {
            Text(summary)
                .font(.title3)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 20)
        }
    }

    @ViewBuilder
    private func articleBody(_ guide: Guide) -> some View {
        if let content = guide.content {
            Markdown(content)
                .markdownTheme(.basic)
                .textSelection(.enabled)
        } else {
            // The shape of the opening lines while the article loads.
            VStack(alignment: .leading, spacing: 10) {
                ForEach(0..<6, id: \.self) { line in
                    Text(String(repeating: "placeholder ", count: line == 5 ? 5 : 9))
                        .lineLimit(1)
                }
            }
            .font(.body)
            .redacted(reason: .placeholder)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Loading guide")
        }
    }

    private var relatedGuides: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Related Guides")
                .font(.title2.bold())
                .accessibilityAddTraits(.isHeader)
            ForEach(related) { item in
                NavigationLink {
                    GuideDetailView(guide: item)
                } label: {
                    HStack(spacing: 12) {
                        GuideRowView(guide: item, showsSummary: false)
                        Image(systemName: "chevron.right")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("guide_related_\(item.id)")
            }
        }
        .padding(.top, 40)
    }

    /// "By Jamie Rivera · 6 min read · Updated Oct 3, 2026".
    private func bylineWithDate(_ guide: Guide) -> String? {
        let updated = (guide.updatedAt ?? guide.createdAt)?.toDate()
            .map { "Updated \($0.formatted(date: .abbreviated, time: .omitted))" }
        let parts = [guide.byline, updated].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private func load() async {
        failed = false
        if VisualSampleData.isEnabled {
            fullGuide = guide
            related = relatedGuides(from: VisualSampleData.guides, topic: guide.topic)
            return
        }
        do {
            fullGuide = try await service.getGuide(guide.id)
        } catch {
            if !Task.isCancelled { failed = true }
            return
        }
        // Related guides are extra; the article stands without them.
        guard let topic = fullGuide?.categories?.first,
              let page = try? await service.listGuides(limit: relatedGuideCount + 1, category: topic)
        else { return }
        related = relatedGuides(from: page.items, topic: topic)
    }

    private func relatedGuides(from guides: [Guide], topic: String?) -> [Guide] {
        guides
            .filter { $0.id != guide.id && (topic == nil || $0.categories?.contains(topic ?? "") == true) }
            .prefix(relatedGuideCount)
            .map { $0 }
    }
}
