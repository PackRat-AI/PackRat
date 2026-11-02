import type { PostAuthor } from '../types';

/**
 * `@` mentions in captions and comments.
 *
 * A mention is plain text — `@First Last` — so a caption reads the same wherever it is shown. Who
 * is actually tagged travels separately as `taggedUserIds`, collected from the people the user
 * picked whose names are still in the text when it is sent. Mirrors `Mentions.swift`.
 */

const MAX_QUERY_LENGTH = 40;
const MAX_QUERY_WORDS = 3;
const WHITESPACE = /\s/;
const NEWLINE = /[\n\r]/;
const TRAILING_WHITESPACE = /\s$/;

export function displayName(person: Pick<PostAuthor, 'firstName' | 'lastName'>): string {
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  return name || 'PackRat member';
}

export function initials(person: Pick<PostAuthor, 'firstName' | 'lastName'>): string {
  return [person.firstName, person.lastName]
    .map((part) => part?.trim().charAt(0) ?? '')
    .join('')
    .toUpperCase();
}

/**
 * The `@` query being typed at the end of `text`, if any. It runs from the last `@` that starts a
 * word to the end of the text, and ends at a newline, a trailing space, or a third word, so
 * accepting a suggestion (which appends a space) closes it.
 */
export function activeMentionQuery(text: string): { atIndex: number; query: string } | null {
  const atIndex = text.lastIndexOf('@');
  if (atIndex < 0) return null;
  if (atIndex > 0 && !WHITESPACE.test(text.charAt(atIndex - 1))) return null;
  const query = text.slice(atIndex + 1);
  if (
    query.length === 0 ||
    query.length > MAX_QUERY_LENGTH ||
    NEWLINE.test(query) ||
    TRAILING_WHITESPACE.test(query) ||
    query.split(' ').length > MAX_QUERY_WORDS
  ) {
    return null;
  }
  return { atIndex, query };
}

/** `text` with the active query replaced by `@Name `. */
export function insertMention(text: string, person: PostAuthor): string {
  const active = activeMentionQuery(text);
  if (!active) return text;
  return `${text.slice(0, active.atIndex)}@${displayName(person)} `;
}

/** The people from `candidates` whose `@Name` still appears in `text`, first pick wins. */
export function taggedPeopleIn(text: string, candidates: PostAuthor[]): PostAuthor[] {
  const seen = new Set<string>();
  return candidates.filter((person) => {
    if (seen.has(person.id) || !text.includes(`@${displayName(person)}`)) return false;
    seen.add(person.id);
    return true;
  });
}

export type MentionSegment = { text: string; person?: PostAuthor };

/**
 * Splits `text` into runs, marking each `@Name` of someone in `people`. A person who removed their
 * tag is no longer in `people`, so their name stays plain. Longer names match first so
 * `@Ann Lee` is not cut short by `@Ann`.
 */
export function mentionSegments(text: string, people: PostAuthor[]): MentionSegment[] {
  const byName = new Map<string, PostAuthor>();
  for (const person of people) byName.set(`@${displayName(person)}`, person);
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  if (names.length === 0 || text.length === 0) return text ? [{ text }] : [];

  const segments: MentionSegment[] = [];
  let plain = '';
  let index = 0;
  while (index < text.length) {
    const name = names.find((candidate) => text.startsWith(candidate, index));
    if (name) {
      if (plain) segments.push({ text: plain });
      plain = '';
      segments.push({ text: name, person: byName.get(name) });
      index += name.length;
    } else {
      plain += text.charAt(index);
      index += 1;
    }
  }
  if (plain) segments.push({ text: plain });
  return segments;
}

/** "Ann", "Ann and Ben", or "Ann and 2 others" — the line under a post naming who was there. */
export function taggedSummary(people: PostAuthor[]): string | null {
  const [first, second] = people.map(displayName);
  if (!first) return null;
  if (people.length === 1) return first;
  if (people.length === 2) return `${first} and ${second}`;
  return `${first} and ${people.length - 1} others`;
}
