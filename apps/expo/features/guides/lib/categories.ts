import { ContentCategorySchema } from '@packrat/schemas/guides';
import type { TFunction } from 'i18next';

type KnownCategory = (typeof ContentCategorySchema.options)[number];

function isKnownCategory(slug: string): slug is KnownCategory {
  return ContentCategorySchema.safeParse(slug).success;
}

/**
 * Display label for a guide category slug. The editorial categories have hand-written labels
 * ("food-nutrition" → "Food & Nutrition"); guides also carry free-form tags ("trails", "family"),
 * which are title-cased from the slug.
 */
export function guideCategoryLabel({ slug, t }: { slug: string; t: TFunction }): string {
  if (isKnownCategory(slug)) return t(`guides.categories.${slug}`);
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
