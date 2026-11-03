import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { mentionSuggestions } from '../lib/feedApi';
import type { PostAuthor } from '../types';
import { activeMentionQuery, insertMention, taggedPeopleIn } from '../utils/mentions';
import { feedKeys } from './queryKeys';

const DEBOUNCE_MS = 220;

/**
 * Live `@` suggestions for one text field. `picked` is everyone chosen from suggestions plus
 * anyone already tagged when editing; only those still named in the text are sent as tags.
 */
export function useMentionSuggester({ text, known = [] }: { text: string; known?: PostAuthor[] }) {
  const [picked, setPicked] = useState<PostAuthor[]>(known);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const query = activeMentionQuery(text)?.query ?? null;
  const [debounced, setDebounced] = useState<string | null>(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { data } = useQuery({
    queryKey: feedKeys.mentions(debounced ?? ''),
    queryFn: () => mentionSuggestions(debounced ?? ''),
    enabled: debounced !== null && debounced === query,
    staleTime: 60_000,
  });

  const suggestions =
    query !== null && query !== dismissedFor && debounced === query ? (data ?? []) : [];

  const accept = useCallback(
    (person: PostAuthor) => {
      setPicked((current) =>
        current.some((p) => p.id === person.id) ? current : [...current, person],
      );
      setDismissedFor(null);
      return insertMention({ text, person });
    },
    [text],
  );

  const tagged = taggedPeopleIn({ text, candidates: picked });

  return {
    suggestions,
    accept,
    dismiss: () => setDismissedFor(query),
    taggedPeople: tagged,
    taggedIds: tagged.map((p) => p.id),
    reset: (people: PostAuthor[] = []) => setPicked(people),
  };
}
