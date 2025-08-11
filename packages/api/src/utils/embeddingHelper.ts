import type { CatalogItem, PackItem } from '../db/schema';

type ItemForEmbedding = Partial<CatalogItem> | Partial<PackItem>;

export const getEmbeddingText = (
  item: ItemForEmbedding,
  existingItem?: Partial<CatalogItem> | Partial<PackItem>,
): string => {
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
    ('variants' in item &&
      item.variants?.map((v) => `${v.attribute}: ${v.values.join(', ')}`).join('; ')) ||
      (existingItem &&
        'variants' in existingItem &&
        existingItem.variants?.map((v) => `${v.attribute}: ${v.values.join(', ')}`).join('; ')),
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
};
