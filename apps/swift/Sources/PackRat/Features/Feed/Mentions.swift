import Foundation
import Observation
import SwiftUI

/// `@` mentions in captions and comments.
///
/// A mention is plain text — `@First Last` — so a caption reads the same
/// wherever it is shown. Who is actually tagged travels separately as
/// `taggedUserIds`, collected from the people the user picked whose names are
/// still in the text when it is sent.
enum Mentions {
    /// The `@` query being typed at the end of `text`, if any.
    ///
    /// The query runs from the last `@` that starts a word to the end of the
    /// text. It ends at a newline, a trailing space, or a third word, so
    /// accepting a suggestion (which appends a space) closes it. SwiftUI's
    /// text editors do not expose the caret, so this assumes typing at the end.
    static func activeQuery(in text: String) -> (atIndex: String.Index, query: String)? {
        guard let atIndex = text.lastIndex(of: "@") else { return nil }
        if atIndex > text.startIndex {
            let before = text[text.index(before: atIndex)]
            guard before.isWhitespace else { return nil }
        }
        let query = String(text[text.index(after: atIndex)...])
        guard !query.isEmpty,
              query.count <= 40,
              !query.contains(where: \.isNewline),
              query.last?.isWhitespace == false,
              query.split(separator: " ", omittingEmptySubsequences: false).count <= 3
        else { return nil }
        return (atIndex, query)
    }

    /// `text` with the active query replaced by `@Name `.
    static func insert(_ person: PostAuthor, into text: String) -> String {
        guard let active = activeQuery(in: text) else { return text }
        return String(text[..<active.atIndex]) + "@" + person.displayName + " "
    }

    /// The people from `candidates` whose `@Name` still appears in `text`.
    static func taggedIds(in text: String, candidates: [PostAuthor]) -> [String] {
        var seen = Set<String>()
        return candidates.filter { person in
            guard !seen.contains(person.id), text.contains("@" + person.displayName) else { return false }
            seen.insert(person.id)
            return true
        }
        .map(\.id)
    }

    /// `text` with each `@Name` of a tagged person highlighted. A person who
    /// removed their tag is no longer in `people`, so their name stays plain.
    static func highlighted(_ text: String, people: [PostAuthor], color: Color = .accentColor) -> AttributedString {
        var attributed = AttributedString(text)
        let names = Set(people.map { "@" + $0.displayName }).sorted { $0.count > $1.count }
        for name in names {
            var searchStart = attributed.startIndex
            while searchStart < attributed.endIndex,
                  let range = attributed[searchStart...].range(of: name) {
                attributed[range].foregroundColor = color
                attributed[range].inlinePresentationIntent = .stronglyEmphasized
                searchStart = range.upperBound
            }
        }
        return attributed
    }
}

/// Live `@` suggestions for one text field.
@Observable
@MainActor
final class MentionSuggester {
    private(set) var suggestions: [PostAuthor] = []
    /// Everyone the user has picked from suggestions, plus anyone already
    /// tagged when editing. Only those still named in the text are sent.
    private(set) var picked: [PostAuthor]

    private let service: FeedService
    private var lastQuery: String?

    init(known: [PostAuthor] = [], service: FeedService = .shared) {
        self.picked = known
        self.service = service
    }

    /// Call on every text change. Debounced; cancelled by the next call when
    /// driven from `.task(id:)`.
    func refresh(for text: String) async {
        guard let query = Mentions.activeQuery(in: text)?.query else {
            suggestions = []
            lastQuery = nil
            return
        }
        guard query != lastQuery else { return }
        try? await Task.sleep(for: .milliseconds(220))
        guard !Task.isCancelled else { return }
        lastQuery = query
        let results = (try? await service.mentionSuggestions(for: query)) ?? []
        guard !Task.isCancelled else { return }
        suggestions = results
    }

    func accept(_ person: PostAuthor, into text: String) -> String {
        if !picked.contains(where: { $0.id == person.id }) {
            picked.append(person)
        }
        suggestions = []
        lastQuery = nil
        return Mentions.insert(person, into: text)
    }

    func taggedIds(in text: String) -> [String] {
        Mentions.taggedIds(in: text, candidates: picked)
    }

    func taggedPeople(in text: String) -> [PostAuthor] {
        let ids = Set(taggedIds(in: text))
        return picked.filter { ids.contains($0.id) }
    }

    func dismiss() {
        suggestions = []
    }
}

/// The suggestion list shown under a field while an `@` query is active.
struct MentionSuggestionList: View {
    let suggestions: [PostAuthor]
    let onSelect: (PostAuthor) -> Void

    var body: some View {
        VStack(spacing: 0) {
            ForEach(suggestions) { person in
                Button {
                    onSelect(person)
                } label: {
                    HStack(spacing: 10) {
                        AvatarView(url: person.avatarUrl, fallbackText: person.initials, size: 30)
                        Text(person.displayName)
                            .font(.callout)
                            .foregroundStyle(.primary)
                        Spacer()
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("feed_mention_suggestion_\(person.id)")
                if person.id != suggestions.last?.id {
                    Divider().padding(.leading, 54)
                }
            }
        }
        .accessibilityIdentifier("feed_mention_suggestions")
    }
}
