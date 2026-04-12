import type { NewCatalogItem } from '@packrat/api/db/schema';
import type { ValidationError } from './validation';

export type { ValidationError } from './validation';

export interface ValidatedCatalogItem {
  item: Partial<NewCatalogItem>;
  isValid: boolean;
  errors: ValidationError[];
}
