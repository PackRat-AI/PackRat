import { encoding_for_model } from 'tiktoken';
import type { CatalogItem, PackItem } from '../db/schema';
import { DEFAULT_MODELS } from './ai/models';

type ItemForEmbedding = Partial<CatalogItem> | Partial<PackItem>;

const MAX_TOKENS = DEFAULT_MODELS.EMBEDDING.MAX_TOKENS;

const encoder = encoding_for_model(DEFAULT_MODELS.EMBEDDING.NAME);

export const getEmbeddingText = (
  item: ItemForEmbedding,
  existingItem?: Partial<CatalogItem> | Partial<PackItem>,
): string => {
  let embeddingInput = [
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

  let tokens = encoder.encode(embeddingInput);

  if (tokens.length > MAX_TOKENS) {
    // Truncate if necessary
    tokens = tokens.slice(0, MAX_TOKENS);
    embeddingInput = new TextDecoder().decode(encoder.decode(tokens));
  }

  encoder.free();

  return embeddingInput;
};
