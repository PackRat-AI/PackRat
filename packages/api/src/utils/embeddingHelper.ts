import type { CatalogItem, PackItem } from '@packrat/db';
import { isObject, isString } from '@packrat/guards';

type ItemForEmbedding = Partial<CatalogItem> | Partial<PackItem>;

type GetEmbeddingTextArgs = {
  item: ItemForEmbedding;
  existingItem?: Partial<CatalogItem> | Partial<PackItem>;
};

export function getEmbeddingText(args: GetEmbeddingTextArgs): string;
export function getEmbeddingText(
  item: ItemForEmbedding,
  existingItem?: Partial<CatalogItem> | Partial<PackItem>,
): string;
export function getEmbeddingText(
  argsOrItem: GetEmbeddingTextArgs | ItemForEmbedding,
  maybeExistingItem?: Partial<CatalogItem> | Partial<PackItem>,
): string {
  const { item, existingItem } =
    'item' in argsOrItem ? argsOrItem : { item: argsOrItem, existingItem: maybeExistingItem };

  const formatVariants = (variants: unknown): string | undefined => {
    if (!Array.isArray(variants)) return undefined;
    return variants
      .map((variant) => {
        if (!isObject(variant)) return undefined;
        const { attribute, values } = variant as { attribute?: unknown; values?: unknown };
        if (!isString(attribute) || !attribute) return undefined;
        const vals = Array.isArray(values) ? values : [values].filter(Boolean);
        if (vals.length === 0) return undefined;
        return `${attribute}: ${vals.join(', ')}`;
      })
      .filter(Boolean)
      .join('; ');
  };

  const embeddingInput = [
    item.name,
    item.description,
    ('brand' in item && item.brand) ||
      (existingItem && 'brand' in existingItem && existingItem.brand),
    ('model' in item && item.model) ||
      (existingItem && 'model' in existingItem && existingItem.model),
    ('categories' in item && item.categories?.join(', ')) ||
      (existingItem && 'categories' in existingItem && existingItem.categories?.join(', ')),
    ('category' in item && item.category) ||
      (existingItem && 'category' in existingItem && existingItem.category),
    ('variants' in item && formatVariants(item.variants)) ||
      (existingItem && 'variants' in existingItem && formatVariants(existingItem.variants)),
    ('techs' in item && item.techs
      ? Object.entries(item.techs)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')
      : '') ||
      (existingItem && 'techs' in existingItem && existingItem.techs
        ? Object.entries(existingItem.techs)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')
        : ''),
    ('color' in item && item.color) ||
      (existingItem && 'color' in existingItem && existingItem.color),
    ('size' in item && item.size) || (existingItem && 'size' in existingItem && existingItem.size),
    ('material' in item && item.material) ||
      (existingItem && 'material' in existingItem && existingItem.material),
    ('reviews' in item && item.reviews?.map((r) => `${r.title} ${r.text}`).join(' ')) ||
      (existingItem &&
        'reviews' in existingItem &&
        existingItem.reviews?.map((r) => `${r.title} ${r.text}`).join(' ')),
    ('qas' in item &&
      item.qas?.map((q) => `${q.question} ${q.answers.map((a) => a.a).join(' ')}`).join(' ')) ||
      (existingItem &&
        'qas' in existingItem &&
        existingItem.qas
          ?.map((q) => `${q.question} ${q.answers.map((a) => a.a).join(' ')}`)
          .join(' ')),
    ('faqs' in item && item.faqs?.map((f) => `${f.question} ${f.answer}`).join(' ')) ||
      (existingItem &&
        'faqs' in existingItem &&
        existingItem.faqs?.map((f) => `${f.question} ${f.answer}`).join(' ')),
  ]
    .filter(Boolean)
    .join('\n');

  return embeddingInput;
}
