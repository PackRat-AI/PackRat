import SwiftUI

// MARK: - Topics

enum GuideTopic {
    /// Hand-written labels for the editorial topics (`ContentCategorySchema`
    /// in packages/schemas/src/guides.ts). Same wording as Android.
    private static let labels: [String: String] = [
        "gear-essentials": "Gear Essentials",
        "pack-strategy": "Pack Strategy",
        "weight-management": "Weight Management",
        "trip-planning": "Trip Planning",
        "seasonal-guides": "Seasonal",
        "activity-specific": "Activities",
        "destination-guides": "Destinations",
        "maintenance": "Gear Care",
        "emergency-prep": "Emergency Prep",
        "family-adventures": "Family Adventures",
        "budget-options": "Budget",
        "sustainability": "Sustainability",
        "tech-outdoors": "Outdoor Tech",
        "food-nutrition": "Food & Nutrition",
        "beginner-resources": "Beginners",
    ]

    /// Guides also carry free-form tags ("trails", "family"), which are
    /// title-cased from the slug.
    static func label(for slug: String) -> String {
        if let label = labels[slug] { return label }
        return slug.split(separator: "-")
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
    }
}

extension Guide {
    /// The topic a guide is filed under first.
    var topic: String? { categories?.first ?? category }

    /// "Food & Nutrition · Beginner", from whichever parts the guide has.
    var overline: String? {
        let parts = [topic.map(GuideTopic.label(for:)), difficulty].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// "By Jamie Rivera · 6 min read", from whichever parts the guide has.
    var byline: String? {
        let parts = [
            author.map { "By \($0)" },
            readingTime.map { "\($0) min read" },
        ].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

// MARK: - Row

struct GuideRowView: View {
    let guide: Guide
    /// Related guides under an article drop the summary.
    var showsSummary = true

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let overline = guide.overline {
                Text(overline)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tint)
                    .lineLimit(1)
            }
            Text(guide.title)
                .font(.headline)
                .lineLimit(2)
            if showsSummary, let summary = guide.excerpt {
                Text(summary)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            if let byline = guide.byline {
                Text(byline)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 6)
        .accessibilityElement(children: .combine)
    }

    /// Stand-in guides for redacted loading rows; their text only sets the shape.
    static let placeholders: [Guide] = (0..<6).map { index in
        Guide(
            id: "placeholder-\(index)",
            title: "A guide title that runs onto a second line",
            content: nil,
            description: "A one-line summary of what the guide covers, long enough to wrap.",
            category: nil,
            categories: ["trip-planning"],
            author: "PackRat Team",
            difficulty: "Beginner",
            createdAt: nil,
            readingTime: 6
        )
    }
}

// MARK: - Topic chips

/// "All" plus one chip per topic, as the first row of the list. One topic at
/// a time; the selected chip carries a checkmark.
struct GuideTopicChips: View {
    let topics: [String]
    @Binding var selection: String?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                chip(nil, label: "All")
                ForEach(topics, id: \.self) { topic in
                    chip(topic, label: GuideTopic.label(for: topic))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
    }

    private func chip(_ topic: String?, label: String) -> some View {
        let isSelected = selection == topic
        return Button {
            withAnimation(.snappy) { selection = topic }
        } label: {
            HStack(spacing: 4) {
                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.caption2.weight(.bold))
                }
                Text(label)
            }
            .font(.subheadline.weight(.medium))
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(
                isSelected ? Color.accentColor : Color.accentColor.opacity(0.1),
                in: Capsule()
            )
            .foregroundStyle(isSelected ? .white : Color.accentColor)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .accessibilityIdentifier("guides_topic_\(topic ?? "all")")
    }
}
