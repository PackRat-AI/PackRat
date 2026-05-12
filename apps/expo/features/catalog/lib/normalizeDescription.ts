const DETAILS_ARRAY_RE = /^Details:\s*(\[[\s\S]*\])$/;

export function normalizeDescription(description: string | null | undefined): string | null {
  if (!description) return null;
  const match = description.match(DETAILS_ARRAY_RE);
  if (match?.[1]) {
    try {
      const items = JSON.parse(match[1]) as string[];
      return items.join('. ');
    } catch {
      // fall through
    }
  }
  return description;
}
