/**
 * Name matching for the assistant's `listUserPacks` tool.
 *
 * The model resolves a pack the user mentioned by NAME ("my Japan Trip pack")
 * into a pack id before it can read or write that pack, so this is the step
 * that decides whether "add a T-shirt to my Japan Trip pack" works at all.
 *
 * Kept pure and free of store/Legend-State imports so it can be unit tested
 * directly, and so the Swift and TypeScript clients can be held to the same
 * matching rules (see `LocalChatPackTools.listPacks` in apps/swift).
 */

/** The subset of a pack this module needs. Structural so both the Legend-State
 *  store record and test fixtures satisfy it without casts. */
export type PackNameCandidate = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  isPublic?: boolean;
  tags?: string[] | null;
  deleted?: boolean;
};

export type PackMatchSummary = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  isPublic?: boolean;
  tags?: string[] | null;
};

/**
 * Normalise for comparison: strip surrounding whitespace, collapse internal
 * runs of whitespace, and case-fold.
 *
 * Collapsing internal runs matters because pack names are free text typed on a
 * phone — "Japan  Trip" and "Japan Trip" are the same pack to the user, and the
 * model echoes back whatever the user typed.
 */
function normalize(value: string): string {
  // Whitespace-split without a regex literal: apps/expo does not depend on
  // magic-regexp, and the repo's no-raw-regex rule flags the `/\s+/` form.
  // Any run of whitespace collapses to one space, so "Japan  Trip" === "Japan Trip".
  const words: string[] = [];
  let word = '';
  for (const char of value) {
    if (char.trim() === '') {
      if (word) words.push(word);
      word = '';
    } else {
      word += char;
    }
  }
  if (word) words.push(word);
  return words.join(' ').toLocaleLowerCase();
}

/**
 * Rank a pack against a query. Lower is better; `null` means no match.
 *
 * Exact beats prefix beats substring so that when a user has both "Japan" and
 * "Japan Trip", asking for "Japan" resolves to the pack actually called
 * "Japan" rather than whichever happens to sort first.
 */
function matchRank(packName: string, query: string): number | null {
  const name = normalize(packName);
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  return null;
}

/**
 * Find the user's packs matching an optional name query.
 *
 * Soft-deleted packs are always excluded — they are not visible on the Packs
 * screen, so the assistant must not offer to add items to them.
 *
 * An empty, whitespace-only or omitted query lists every live pack, which is
 * what lets the model answer "what packs do I have?" and recover when its first
 * guess at a name misses.
 */
export function matchPacksByName({
  packs,
  nameQuery,
}: {
  packs: PackNameCandidate[];
  nameQuery?: string | null;
}): PackMatchSummary[] {
  const live = packs.filter((pack) => !pack.deleted);
  const query = normalize(nameQuery ?? '');

  const selected =
    query === ''
      ? live
      : live
          .map((pack) => ({ pack, rank: matchRank(pack.name, query) }))
          .filter(
            (scored): scored is { pack: PackNameCandidate; rank: number } => scored.rank !== null,
          )
          .sort((a, b) => a.rank - b.rank)
          .map((scored) => scored.pack);

  return selected.map((pack) => ({
    id: pack.id,
    name: pack.name,
    description: pack.description,
    category: pack.category,
    isPublic: pack.isPublic,
    tags: pack.tags,
  }));
}
